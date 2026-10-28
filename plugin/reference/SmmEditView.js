import {
  Notice,
  TextFileView,
  TFile,
  setIcon,
  Platform,
  normalizePath
} from 'obsidian'
import {
  SMM_VIEW_TYPE,
  SAVE_ICON,
  IMPORT_ICON,
  EXPORT_ICON,
  SMM_TAG,
  OUTLINE_ICON,
  MINDMAP_ICON,
  PRINT_ICON,
  getSmmEditViewCount
} from './ob/constant.js'
import { initApp } from './src/main.js'
import {
  assembleMarkdownText,
  parseMarkdownText
} from './ob/metadataAndMarkdown.js'
import {
  hideTargetMenu,
  formatFileName
} from './ob/utils.js'
import LZString from 'lz-string'
import { parseDocument } from '../src/document/format.js'
import { SaveCoordinator, SaveConflictError } from '../src/document/save.js'
import { AssetStore } from '../src/assets.js'
import ModifyFileName from './ob/ModifyFileName.js'
import { createEditorApi } from '../src/editor-api.js'

function decodeSvgDataUrl(value) {
  const source = String(value || '')
  if (!/^data:/i.test(source)) return Promise.resolve(source)
  const comma = source.indexOf(',')
  if (comma < 0) return Promise.reject(new Error('SVG 数据 URL 格式无效'))
  const header = source.slice(0, comma)
  const body = source.slice(comma + 1)
  if (!/image\/svg\+xml/i.test(header)) {
    return Promise.reject(new Error('预览数据不是 SVG'))
  }
  try {
    if (/;base64(?:;|$)/i.test(header)) {
      const binary = atob(body)
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
      return Promise.resolve(new TextDecoder().decode(bytes))
    }
    return Promise.resolve(decodeURIComponent(body))
  } catch (error) {
    return Promise.reject(new Error(`SVG 数据 URL 解码失败：${error.message}`))
  }
}

class SmmEditView extends TextFileView {
  constructor(leaf, plugin) {
    super(leaf)
    this.plugin = plugin
    this.contentEl.style.padding = 0
    this.warpEl = this.contentEl.createDiv('smmMindmapEditContainer')
    this.warpEl.classList.add('smm-common-full-size')
    this.mindMapData = ''
    this.parsedMindMapData = null
    this.mindMapAPP = null
    this.saveCoordinator = null
    this.coordinatorFile = null
    this.loadedFile = null
    this.invalidError = null
    this.assetStore = plugin.assets || new AssetStore(this.app, () => this.plugin.settings)

    this.isActive = true
    this.resizeObserver = null
    this.isUnSave = false
    this.isOuterChange = false
    this.isNotTriggerDataChange = false
    this.isHidden = false
    this.needResize = false
    this.isOutlineEditMode = false
    this.saveButton = null
    this.exportButton = null
    this.importButton = null
    this.printOutlineButton = null
    this.changeToOutlineButton = null
    this.changeToMindmapButton = null
    this.savingTipEl = null
    this.isReadonlyMode = false
    this.toggleReadonlyButton = null
    this.modifyFileName = new ModifyFileName(this)
    this.popScope = null
    this.id = getSmmEditViewCount()
  }

  getViewType() {
    return SMM_VIEW_TYPE
  }

  getIcon() {
    return 'smm-icon'
  }

  onPaneMenu(menu, source) {
    super.onPaneMenu(menu, source)
    hideTargetMenu(menu, '在新窗口中打开')
    hideTargetMenu(menu, '移动至新窗口')
  }

  async switchToMarkdownView() {
    if (!this.file || !this.leaf) return
    const mdViewType = this.app.viewRegistry.getTypeByExtension('md')
    await this.leaf.setViewState({
      type: mdViewType,
      state: {
        ...this.leaf.getViewState().state,
        isSwitchToMarkdownViewFromSmmView: true
      },
      popstate: true
    })
  }

  async onOpen() {
    this.registerEvent(
      this.app.vault.on('modify', this._handleExternalChange.bind(this))
    )
    // 注册激活状态监听
    this.registerEvent(
      this.app.workspace.on(
        'active-leaf-change',
        this._handleActiveChange.bind(this)
      )
    )
    this.registerEvent(
      this.app.workspace.on('resize', this._handleResize.bind(this))
    )

    this._addActionBtns()

    this._initThemeMode()

    this.modifyFileName.setupTitleEditing()
    this._registerHotkeyOverrides()
  }

  getViewData() {
    return this.saveCoordinator?.currentRaw || this.mindMapData || ''
  }

  async setViewData(data, isClear) {
    if (!isClear && this.saveCoordinator) {
      await this._handleExternalText(String(data || ''))
      return
    }
    if (isClear) {
      this.clear()
    }
    const rawData = String(data || '')
    try {
      const parsed = this._parseValidMindMap(rawData)
      this.invalidError = null
      this.mindMapData = rawData
      this.parsedMindMapData = parsed
      if (isClear || !this.saveCoordinator) {
        this._createSaveCoordinator(rawData)
      }
    } catch (error) {
      this.invalidError = error
      if (isClear || !this.saveCoordinator) {
        this.mindMapData = rawData
        this.parsedMindMapData = null
        this.saveCoordinator?.dispose()
        this.saveCoordinator = null
        this._renderLoadError(error)
      }
      return
    }
    if (isClear) {
      this._renderMindMap()
    } else if (this.mindMapAPP) {
      this.isNotTriggerDataChange = true
      this.mindMapAPP.$bus.$emit(
        'updateMindMapDataFromOb',
        this.parsedMindMapData.metadata.content
      )
    }
  }

  _parseValidMindMap(rawData) {
    if (!rawData.trim()) {
      throw new Error(this.plugin._t('tip.fileIsEmpty'))
    }
    const strict = parseDocument(rawData)
    const parsed = parseMarkdownText(rawData)
    if (!parsed.metadata.content || !strict?.data?.root) {
      throw new Error('文件格式错误')
    }
    parsed.metadata = {
      ...parsed.metadata,
      ...strict.metadata,
      content: JSON.stringify(strict.data)
    }
    return parsed
  }

  _createSaveCoordinator(raw) {
    this.saveCoordinator?.dispose()
    const file = this.file
    this.coordinatorFile = file
    this.loadedFile = file
    const delay = Math.max(1, Number(this.plugin.settings.autoSaveTime) || 5) * 1000
    this.saveCoordinator = new SaveCoordinator({
      raw,
      delay,
      maxWait: delay,
      write: async (expectedRaw, nextRaw) => {
        if (!file || this.app.vault.getAbstractFileByPath(file.path) !== file) {
          throw new Error('原文件已被删除，不能写入；请另存副本')
        }
        return this.app.vault.process(file, current => {
          if (current !== expectedRaw) throw new SaveConflictError()
          return nextRaw
        })
      },
      onState: (state, error) => {
        if (state === 'saving') this._showSavingTip()
        if (state === 'ready') this._hideSavingTip()
        this._setIsUnSave(['dirty', 'saving', 'conflict', 'error'].includes(state))
        if (state === 'conflict') this.isOuterChange = true
        if (error && state === 'error') this._reportSaveError(error)
      }
    })
  }

  _renderLoadError(error) {
    if (!this.warpEl) return
    this.warpEl.empty()
    this.warpEl.createDiv({
      cls: 'smm-load-error',
      text: `导图文件无法加载：${error.message}。原文件未被修改。`
    })
  }

  _clearObserver() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
  }

  _renderMindMap() {
    this.warpEl.empty()
    const el = this.warpEl.createDiv('smmMindMapEdit')
    el.classList.add('smm-common-full-size')
    this._clearObserver()
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 10 && height > 10) {
          this._initializeMindMap(el)
          this._clearObserver()
          break
        }
      }
    })
    this.resizeObserver.observe(el)
  }

  _initializeMindMap(el) {
    if (this.mindMapAPP) return
    const filePath = this.file?.path
    let initLocationNodeId = ''
    const { fileToSubpathMap } = this.plugin
    if (fileToSubpathMap && fileToSubpathMap[filePath]) {
      initLocationNodeId = fileToSubpathMap[filePath]
      delete fileToSubpathMap[filePath]
    }
    this.mindMapAPP = initApp(el, createEditorApi({
      app: this.app, plugin: this.plugin, getFile: () => this.file,
      assetStore: this.assetStore,
      saveFileToVault: (...args) => this.saveFileToVault(...args),
      documentApi: {
      isActive: () => this.app.workspace.activeLeaf?.view === this && !this.closePromise,
      getInitMindMapData: () => {
        return this.parsedMindMapData.metadata.content
      },
      getInitLocationNodeId: () => {
        return initLocationNodeId
      },
      getMindMapCurrentData: (content, linkData, textData) => {
        this.parsedMindMapData.metadata.content = content
        const {
          metadata,
          svgdata,
          svgdataUpdateAt,
          linkdata
        } = this.parsedMindMapData
        this.mindMapData = assembleMarkdownText({
          metadata: {
            path: `${this.file?.path}`,
            tags: Array.from(new Set([SMM_TAG, ...metadata.tags])),
            content: LZString.compressToBase64(content),
            yaml: metadata.yaml
          },
          svgdata,
          svgdataUpdateAt,
          linkdata: linkData || linkdata || [],
          textdata: textData || []
        })
        this.saveCoordinator?.update(this.mindMapData)
      },
      saveMindMapData: async (_, svgData) => {
        try {
          this._showSavingTip()
          const { embedImageIsSeparateFile } = this.plugin.settings
          if (svgData) {
            if (embedImageIsSeparateFile) {
              const res = await this._getFileSvgData(svgData)
              if (res) {
                this.parsedMindMapData.svgdata = `![[${res}]]`
                this.parsedMindMapData.svgdataUpdateAt = new Date().toISOString()
              } else {
                new Notice(this.plugin._t('tip.imgCreateFail'))
              }
            } else {
              this.parsedMindMapData.svgdata = LZString.compressToBase64(
                svgData
              )
            }
          }
          await this.forceSave()
        } catch (error) {
          this._reportSaveError(error)
          throw error
        }
      },

      }
    }))
    this.initializeTimer = setTimeout(() => {
      this.initializeTimer = null
      if (this.mindMapAPP) this._listenMindMapEvent()
    }, 100)
  }

  tryGetFileByPath(filePath) {
    let res = this.app.vault.getFileByPath(filePath)
    if (!res) {
      res = this.app.vault.getFileByPath(filePath + '.md')
    }
    if (!res) {
      res = this.app.metadataCache.getFirstLinkpathDest(
        filePath,
        this.file?.path
      )
    }
    return res
  }

  async _getFileSvgData(svgData) {
    const rawSvg = await decodeSvgDataUrl(svgData)
    if (!/<svg\b/i.test(rawSvg)) throw new Error('无法生成有效的 SVG 预览')
    return this.assetStore.saveSvg(rawSvg, this.file)
  }

  async saveFileToVault(file, isImg = true, targetFolder = '', cover = false) {
    try {
      const kind = typeof isImg === 'string'
        ? isImg === 'image' ? 'image' : 'attachment'
        : isImg ? 'image' : 'attachment'
      return await this.assetStore.saveFile(file, this.file, kind)
    } catch (error) {
      console.error('保存附件失败:', error)
      if (typeof this.plugin._reportError === 'function') {
        this.plugin._reportError('保存附件失败', error)
      } else {
        new Notice(`保存附件失败：${error.message || error}`)
      }
      throw error
    }
  }

  jumpToNodeByUid(uid) {
    if (!this.mindMapAPP) {
      return
    }
    this.mindMapAPP.$bus.$emit('jumpToNodeByUid', uid)
  }

  async save(ignoreActiveCheck = false) {
    if (!ignoreActiveCheck && !this.isActive) {
      return
    }
    if (this.app.noSaveOnClose) return
    if (this.mindMapAPP) {
      await this._captureCurrentData()
      this.mindMapAPP.$bus.$emit('clearAutoSave')
    }
    if (!this.saveCoordinator || !this.parsedMindMapData) {
      return
    }
    if (this.invalidError) {
      throw new SaveConflictError()
    }
    if (this.saveCoordinator.state === 'conflict') {
      throw new SaveConflictError()
    }
    await this.saveCoordinator.flush()
    this.mindMapData = this.saveCoordinator.currentRaw
    this._setIsUnSave(false)
    this._hideSavingTip()
  }

  forceSave(ignoreActiveCheck = false) {
    this._showSavingTip()
    const operation = this.save(ignoreActiveCheck)
    if (operation && typeof operation.catch === 'function') {
      operation.catch(error => this._reportSaveError(error))
    }
    return operation
  }

  forceSaveAndUpdateImage() {
    this._showSavingTip()
    this.mindMapAPP.$bus.$emit('saveToLocal', true, true)
  }

  _listenMindMapEvent() {
    this._onDataChange = this._onDataChange.bind(this)
    this.mindMapAPP.$bus.$on('data_change', this._onDataChange)
  }

  _onDataChange() {
    if (this.isNotTriggerDataChange) {
      this.isNotTriggerDataChange = false
      return
    }
    this._setIsUnSave(true)
  }

  _handleResize() {
    if (!this.mindMapAPP || this.needResize) {
      return
    }
    if (this.isHidden) {
      this.needResize = true
      return
    }
    try {
      if (this.mindMapAPP.$updateMindMapSize) {
        const { width, height } = this.warpEl.getBoundingClientRect()
        if (width > 0 && height > 0) {
          this.mindMapAPP.$updateMindMapSize()
        }
      }
    } catch (e) {}
  }

  async _handleActiveChange(leaf) {
    const nowActive = leaf?.view === this
    if (nowActive && !this.isActive) {
      this._registerHotkeyOverrides()
      this.isActive = true
      if (this.mindMapAPP) {
        if (this.isHidden) {
          this.isHidden = false
          this._checkForExternalChanges()
        }
        // 更新尺寸
        if (this.needResize) {
          this.needResize = false
          this._handleResize()
        }
        if (this.isOuterChange) {
          this.isOuterChange = false
        }
      }
    } else if (!nowActive && this.isActive) {
      this._clearPopScope()
      const rect = this.warpEl.getBoundingClientRect()
      this.isHidden = rect.width === 0 || rect.height === 0
      if (this.mindMapAPP) {
        this.mindMapAPP.$bus.$emit('obTabDeactivate')
        this.save().catch(error => this._reportSaveError(error))
        this.mindMapAPP.$clearUpdateMindMapSize()
      }
      this.isActive = false
    }
  }

  async _handleExternalChange(file) {
    if (!file || file.path !== this.file?.path || !this.saveCoordinator) return
    try {
      await this._handleExternalText(await this.app.vault.read(file))
    } catch (error) {
      this._reportSaveError(error)
    }
  }

  async _checkForExternalChanges() {
    if (!this.file) return
    try {
      const data = await this.app.vault.read(this.file)
      await this._handleExternalText(data)
    } catch (error) {
      this._reportSaveError(error)
    }
  }

  async _handleExternalText(raw) {
    if (!this.saveCoordinator || this.closePromise) return
    const current = this.saveCoordinator
    if (raw === current.currentRaw || raw === current.baseRaw) {
      current.acceptExternal(raw)
      this.invalidError = null
      this.isOuterChange = current.state === 'conflict'
      this._setIsUnSave(current.dirty || this.isOuterChange)
      return
    }
    if (this.mindMapAPP) {
      await this._captureCurrentData()
    }
    let parsed
    try {
      parsed = this._parseValidMindMap(raw)
    } catch (error) {
      this.invalidError = error
      this.isOuterChange = true
      this._setIsUnSave(true)
      return
    }
    const result = current.acceptExternal(raw)
    if (result === 'conflict') {
      this.isOuterChange = true
      this._setIsUnSave(true)
      return
    }
    if (result === 'reload') {
      this.invalidError = null
      this.mindMapData = raw
      this.parsedMindMapData = parsed
      if (this.mindMapAPP) {
        this.isNotTriggerDataChange = true
        this.mindMapAPP.$bus.$emit(
          'updateMindMapDataFromOb',
          parsed.metadata.content
        )
      }
    }
  }

  async _captureCurrentData() {
    if (!this.mindMapAPP) return
    if (typeof this.mindMapAPP.$getMindMapCurrentData === 'function') {
      await this.mindMapAPP.$getMindMapCurrentData()
      return
    }
    this.mindMapAPP.$bus.$emit('getMindMapCurrentData')
  }

  clear() {
    clearTimeout(this.initializeTimer)
    this.initializeTimer = null
    this._clearObserver()
    if (this.mindMapAPP) {
      try {
        this.mindMapAPP.$destroy()
      } catch (e) {}
      this.mindMapAPP = null
    }
    this.saveCoordinator?.dispose()
    this.saveCoordinator = null
    this.coordinatorFile = null
    this.loadedFile = null
    this.warpEl.empty()
    this.mindMapData = ''
    this.parsedMindMapData = null
    this.invalidError = null
    this.isUnSave = false
    this.isOuterChange = false
    this.isNotTriggerDataChange = false
    this.isHidden = false
    this.needResize = false
    this._resetOnOutlineEditMode()
  }

  async onClose() {
    this._clearPopScope()
    this.modifyFileName.unload()
    const saveError = await this._flushBeforeUnload()
    this.clear()
    this.saveButton = null
    this.exportButton = null
    this.importButton = null
    this.printOutlineButton = null
    this.changeToOutlineButton = null
    this.changeToMindmapButton = null
    this.toggleReadonlyButton = null
    return saveError
  }

  async onLoadFile(file) {
    const previousFile = this.loadedFile || this.file
    if (previousFile && previousFile.path !== file?.path && this.saveCoordinator) {
      await this.onUnloadFile(this.file)
    }
    this.file = file
    this.loadedFile = file
    this.closePromise = null
    const raw = await this.app.vault.read(file)
    if (this.file === file) await this.setViewData(raw, true)
  }

  async onUnloadFile() {
    if (this.closePromise) return this.closePromise
    this.closePromise = this._flushBeforeUnload().then(() => {
      this.clear()
    })
    return this.closePromise
  }

  async _flushBeforeUnload() {
    let saveError = null
    try {
      await this.save(true)
    } catch (error) {
      saveError = error
      this._reportSaveError(error)
      if (this.saveCoordinator?.dirty) {
        try {
          const recovery = await this._saveRecoveryCopy()
          new Notice(`原文件未覆盖，已保存恢复副本：${recovery.path}`)
        } catch (recoveryError) {
          this._reportSaveError(
            new Error(`恢复副本写入失败：${recoveryError.message}`)
          )
        }
      }
    }
    return saveError
  }

  _reportSaveError(error) {
    if (error instanceof SaveConflictError) {
      new Notice('导图文件已被外部修改，未覆盖原文件；请重新加载或另存副本')
      return
    }
    if (error) new Notice(`保存思维导图失败：${error.message || error}`)
  }

  async _saveRecoveryCopy() {
    const raw = this.saveCoordinator?.currentRaw || this.mindMapData
    const targetFile = this.coordinatorFile || this.file
    if (!raw || !targetFile) throw new Error('没有可恢复的导图内容')
    parseDocument(raw)
    const parentPath = targetFile.parent?.path || ''
    const folder = parentPath === '/' ? '' : parentPath
    const stem = targetFile.basename.replace(/\.smm$/i, '') + ' 恢复'
    const prefix = folder ? `${folder}/` : ''
    const adapter = this.app.vault.adapter
    for (let index = 0; index < 10000; index += 1) {
      const suffix = index ? ` ${index}` : ''
      const path = normalizePath(`${prefix}${stem}${suffix}.smm.md`)
      const indexed = this.app.vault.getAbstractFileByPath(path)
      const exists = indexed || (await adapter.exists?.(path))
      if (exists) continue
      try {
        return await this.app.vault.create(path, raw)
      } catch (error) {
        if (!/(?:already exists|already present|file exists)/i.test(String(error))) {
          throw error
        }
      }
    }
    throw new Error('无法生成唯一恢复副本路径')
  }

  _addActionBtns() {
    const viewActions = this.headerEl.querySelector('.view-actions')

    this.toggleReadonlyButton = this._createActionBtn(
      this.plugin._t('action.changeToReadonly'),
      'book-open',
      viewActions,
      async () => {
        await this.save()
        if (this.isReadonlyMode) {
          this.isReadonlyMode = false
          this.mindMapAPP.$bus.$emit('toggleReadonly', false)
          setIcon(this.toggleReadonlyButton, 'book-open')
          this.toggleReadonlyButton.setAttribute(
            'aria-label',
            this.plugin._t('action.changeToReadonly')
          )
          this._showButtons([
            this.saveButton,
            this.importButton,
            this.exportButton
          ])
        } else {
          this.isReadonlyMode = true
          this.mindMapAPP.$bus.$emit('toggleReadonly', true)
          setIcon(this.toggleReadonlyButton, 'edit-3')
          this.toggleReadonlyButton.setAttribute(
            'aria-label',
            this.plugin._t('action.changeToEdit')
          )
          this._hideButtons([
            this.saveButton,
            this.importButton,
            this.exportButton
          ])
        }
      },
      true
    )

    this.changeToOutlineButton = this._createActionBtn(
      this.plugin._t('action.changeToOutline'),
      OUTLINE_ICON,
      viewActions,
      async () => {
        await this.save()
        this._hideButtons([this.exportButton, this.changeToOutlineButton])
        this._showButtons([this.printOutlineButton, this.changeToMindmapButton])
        // 保存按钮文案修改
        this.saveButton.setAttribute('aria-label', '保存')
        this.mindMapAPP.$bus.$emit('showOutlineEdit')
        this.isOutlineEditMode = true
      }
    )

    this.changeToMindmapButton = this._createActionBtn(
      this.plugin._t('action.changeToMindMap'),
      MINDMAP_ICON,
      viewActions,
      async () => {
        await this.save()
        this.mindMapAPP.$bus.$emit('hideOutlineEdit')
        this._resetOnOutlineEditMode()
      }
    )
    this._hideButtons([this.changeToMindmapButton])

    this.printOutlineButton = this._createActionBtn(
      this.plugin._t('action.printOutline'),
      PRINT_ICON,
      viewActions,
      async () => {
        this.mindMapAPP.$bus.$emit('printOutline')
      }
    )
    this._hideButtons([this.printOutlineButton])

    this.importButton = this._createActionBtn(
      this.plugin._t('action.import'),
      IMPORT_ICON,
      viewActions,
      () => {
        this.mindMapAPP.$bus.$emit('showImport')
      }
    )

    if (!Platform.isMobile) {
      this.exportButton = this._createActionBtn(
        this.plugin._t('action.export'),
        EXPORT_ICON,
        viewActions,
        () => {
          this.mindMapAPP.$bus.$emit('showExport')
        }
      )
    }

    // 保存并更新图像数据
    this.saveButton = this._createActionBtn(
      this.plugin._t('action.saveAndUpdateImage'),
      SAVE_ICON,
      viewActions,
      () => {
        this.forceSaveAndUpdateImage()
      }
    )
    this.saveButton.classList.add('smm-save-button-default')

    this.savingTipEl = this.headerEl.createEl('div', {
      cls: 'smm-save-tip'
    })
    viewActions.insertBefore(this.savingTipEl, viewActions.firstChild)
  }

  _showSavingTip() {
    if (!this.savingTipEl) return
    this.savingTipEl.innerText = this.plugin._t('tip.saving')
  }

  _hideSavingTip() {
    if (!this.savingTipEl) return
    this.savingTipEl.innerText = ''
  }

  _createActionBtn(label, icon, parentEl, onClick, isObIcon = false) {
    const el = this.headerEl.createEl('button', {
      cls: 'clickable-icon'
    })
    el.setAttribute('aria-label', label)
    if (isObIcon) {
      setIcon(el, icon, 24)
    } else {
      el.innerHTML = icon
    }
    parentEl.insertBefore(el, parentEl.firstChild)
    el.addEventListener('click', onClick)
    return el
  }

  _resetOnOutlineEditMode() {
    if (this.isOutlineEditMode) {
      this.saveButton.setAttribute(
        'aria-label',
        this.plugin._t('action.saveAndUpdateImage')
      )
      this._showButtons([this.exportButton, this.changeToOutlineButton])
      this._hideButtons([this.changeToMindmapButton, this.printOutlineButton])
      this.isOutlineEditMode = false
    }
  }

  _showButtons(list) {
    list.forEach(el => {
      if (!el) return
      el.classList.remove('smm-common-hide')
      el.classList.add('smm-common-flex')
    })
  }

  _hideButtons(list) {
    list.forEach(el => {
      if (!el) return
      el.classList.remove('smm-common-flex')
      el.classList.add('smm-common-hide')
    })
  }

  _setIsUnSave(isUnSave) {
    this.isUnSave = isUnSave
    if (!this.saveButton) return
    if (isUnSave) {
      this.saveButton.classList.remove('smm-save-button-default')
      this.saveButton.classList.add('smm-save-button-un-save')
    } else {
      this.saveButton.classList.remove('smm-save-button-un-save')
      this.saveButton.classList.add('smm-save-button-default')
    }
  }

  _initThemeMode() {
    this._updateThemeMode()

    this.registerEvent(
      this.app.workspace.on('css-change', () => {
        this._updateThemeMode()
      })
    )
  }

  _updateThemeMode() {
    if (this.plugin.settings.themeMode === 'follow') {
      const isDarkMode = this.plugin._getObIsDark()
      if (this.mindMapAPP) {
        this.mindMapAPP.$bus.$emit('setIsDark', isDarkMode)
      }
    }
  }

  _getFileSavePath(typeKey, pathKey, subPathKey) {
    const type = this.plugin.settings[typeKey]
    const folder = this.plugin.settings[pathKey] || ''
    const subFolder = this.plugin.settings[subPathKey] || ''
    switch (type) {
      case 'root':
        return ''
      case 'custom':
        return folder
      case 'currentFileFolder':
        return this.plugin._getActiveFileDirectory()
      case 'currentFileFolderSubFolder':
        const activeFileDirectory = this.plugin._getActiveFileDirectory()
        return [activeFileDirectory, subFolder].filter(Boolean).join('/')
      default:
        return ''
    }
  }

  _clearPopScope() {
    if (this.popScope) {
      this.popScope()
      this.popScope = null
    }
  }

  _registerHotkeyOverrides() {
    this._clearPopScope()
    const scope = this.app.keymap.getRootScope()
    const ctrlFHandler = scope.register(['Mod'], 'f', evt => {
      evt.preventDefault()
      return true
    })
    const ctrlSHandler = scope.register(['Mod'], 's', evt => {
      evt.preventDefault()
      const view = this.plugin._getActiveSmmView()
      if (view) {
        view.forceSave()
      }
      return true
    })
    scope.keys.unshift(scope.keys.pop())
    scope.keys.unshift(scope.keys.pop())
    this.popScope = () => {
      scope.unregister(ctrlFHandler)
      scope.unregister(ctrlSHandler)
    }
  }
}

export default SmmEditView
