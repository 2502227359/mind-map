import {
  addIcon,
  Plugin,
  TFile,
  TFolder,
  Notice,
  MarkdownView,
  WorkspaceLeaf,
  Workspace,
  getLanguage
} from 'obsidian'
import './style.css'
import SmmEditView from './SmmEditView.js'
import {
  SMM_VIEW_TYPE,
  SIDE_BAR_ICON,
  SMM_TAG,
  SMM_FILE_EXTENSION,
  DEFAULT_NODE_FONT,
  DEFAULT_SETTINGS,
  IGNORE_CHECK_SMM,
  normalizePositiveInteger,
  normalizeCodeBlockHeight
} from './ob/constant.js'
import {
  createDefaultText,
  createDefaultMindMapData,
  parseMarkdownText
} from './ob/metadataAndMarkdown.js'
import { around, dedupe } from 'monkey-around'
import { getUidFromSource, formatFileName } from './ob/utils.js'
import MarkdownPostProcessor from './ob/MarkdownPostProcessor.js'
import SmmSettingTab from './ob/SmmSettingTab.js'
import { langList } from './src/config/zh'
import i18n from 'i18next'
import enTranslations from './locales/en.json'
import zhTranslations from './locales/zh.json'
import viTranslations from './locales/vi.json'
import zhtwTranslations from './locales/zhtw.json'
import Commands from './ob/Commands.js'
import markdown from 'simple-mind-map/src/parse/markdown.js'
import Menus from './ob/Menus.js'
import LZString from 'lz-string'
import { SuggestionModal } from './ob/SuggestionModal.js'
import { registerCodeBlocks } from '../src/code-blocks.js'
import { parseDocument } from '../src/document/format.js'
import { MarkdownMapPreviewView, MARKDOWN_MAP_PREVIEW } from '../src/markdown-preview-view.js'

export default class SimpleMindMapPlugin extends Plugin {
  async onload() {
    await this._addSetting()

    await i18n.init({
      lng: this.settings.lang === 'zhtw' ? 'zh-TW' : this.settings.lang,
      fallbackLng: 'en',
      resources: {
        en: { translation: enTranslations },
        zh: { translation: zhTranslations },
        vi: { translation: viTranslations },
        ['zh-TW']: { translation: zhtwTranslations }
      }
    })

    addIcon('smm-icon', SIDE_BAR_ICON)

    this.registerView(SMM_VIEW_TYPE, leaf => new SmmEditView(leaf, this))
    this.registerView(MARKDOWN_MAP_PREVIEW, leaf => new MarkdownMapPreviewView(leaf, this))
    this.registerHoverLinkSource('personal-mindmap', { display: '个人思维导图内链', defaultMod: false })

    this._createSmmFile = this._createSmmFile.bind(this)
    this.addRibbonIcon(
      'smm-icon',
      this._t('action.createMindMap'),
      this._createSmmFile
    )

    this.commands = new Commands(this)

    this.menus = new Menus(this)

    registerCodeBlocks(this)

    this._registerMonkeyPatches()

    this._switchToSmmAfterLoad()

    this._initStatusBar()

    this.markdownPostProcessor = new MarkdownPostProcessor(this)
    this.markdownPostProcessor.register()

    this.fileToSubpathMap = {}
    this.noSaveOnClose = false
  }

  async _createSmmFile(folderPath = '', callback) {
    try {
      if (typeof folderPath !== 'string' || folderPath === '/') {
        folderPath = ''
      }
      const { fileNameFormat, templatePath } = this.settings
      folderPath = this._getCreateFolderPath(folderPath)
      await this._ensureDirectoryExists(folderPath)
      const { vault } = this.app
      const filePath = `${
        folderPath ? folderPath + '/' : ''
      }${formatFileName(fileNameFormat, { ignores: ['notename'] })}.smm.md`
      const fileContent = await this._getFileContentWithTemplate(
        templatePath,
        filePath
      )
      if (fileContent == null) return
      const existingFile = vault.getFileByPath(filePath)
      if (existingFile) {
        new Notice(this._t('tip.fileExist'))
      } else {
        await vault.create(filePath, fileContent)
        if (callback && typeof callback === 'function') {
          callback(filePath)
        } else {
          await this.app.workspace.openLinkText(filePath, '', true)
        }
      }
    } catch (error) {
      this._reportError(this._t('tip.createMindMapFail'), error)
    }
  }

  async _getFileContentWithTemplate(templatePath, filePath) {
    const defaultContent = createDefaultText(
      filePath,
      this._getCreateDefaultMindMapOptions()
    )
    const path = String(templatePath || '').trim()
    if (!path) return defaultContent

    const abstract = this.app.vault.getAbstractFileByPath(path)
    if (abstract instanceof TFile) {
      return this._readAndApplyTemplate(abstract, filePath)
    }
    if (!(abstract instanceof TFolder)) {
      throw new Error('模板路径不存在，或不是模板文件/目录')
    }

    const templateFiles = this._findTemplateFiles(abstract)
    if (templateFiles.length === 0) {
      throw new Error('模板目录中没有 .smm.md 文件')
    }
    const selected = await this._chooseTemplateFile(templateFiles)
    if (!selected) return null
    return this._readAndApplyTemplate(selected, filePath)
  }

  _findTemplateFiles(folder) {
    const result = []
    const pending = [folder]
    while (pending.length) {
      const current = pending.shift()
      for (const child of current.children || []) {
        if (child instanceof TFile && /\.smm\.md$/i.test(child.path)) {
          result.push(child)
        } else if (child instanceof TFolder) {
          pending.push(child)
        }
      }
    }
    return result.sort((a, b) => a.path.localeCompare(b.path))
  }

  async _chooseTemplateFile(files) {
    return new Promise(resolve => {
      let modal
      let settled = false
      const finish = value => {
        settled = true
        modal?.close()
        resolve(value)
      }
      modal = new SuggestionModal({
        plugin: this,
        app: this.app,
        type: 'file',
        getSuggestions: query => {
          const target = String(query || '').toLowerCase()
          return files
            .filter(file => file.path.toLowerCase().includes(target))
            .map(file => file.path)
        },
        onSelect: path => finish(files.find(file => file.path === path) || null)
      })
      const originalOnClose = modal.onClose.bind(modal)
      modal.onClose = () => {
        originalOnClose()
        if (!settled) resolve(null)
      }
      modal.open()
    })
  }

  async _readAndApplyTemplate(file, filePath) {
    const content = await this.app.vault.cachedRead(file)
    this._validateTemplateContent(content)
    return this._replaceTemplatePath(content, filePath)
  }

  _validateTemplateContent(content) {
    parseDocument(String(content || ''))
    const parsed = parseMarkdownText(String(content || ''))
    if (!parsed.metadata.tags.includes(SMM_TAG)) {
      throw new Error('模板缺少 simplemindmap 标签')
    }
    if (!/^path\s*:/m.test(content)) {
      throw new Error('模板缺少 frontmatter path')
    }
    const compressed = String(parsed.metadata.content || '').trim()
    const json = LZString.decompressFromBase64(compressed) || compressed
    let data
    try {
      data = JSON.parse(json)
    } catch (error) {
      throw new Error(`模板 metadata 无法解析：${error.message}`)
    }
    if (!data?.root?.data || !Array.isArray(data.root.children)) {
      throw new Error('模板 metadata 不是有效导图数据')
    }
    return parsed
  }

  _replaceTemplatePath(content, filePath) {
    return String(content).replace(/^path\s*:\s*.*$/m, () => `path: ${filePath}`)
  }

  async _validateTemplatePath(templatePath) {
    const path = String(templatePath || '').trim()
    if (!path) return true
    const abstract = this.app.vault.getAbstractFileByPath(path)
    if (abstract instanceof TFile) {
      await this._readAndApplyTemplate(abstract, abstract.path)
      return true
    }
    if (abstract instanceof TFolder) {
      const files = this._findTemplateFiles(abstract)
      if (!files.length) throw new Error('模板目录中没有 .smm.md 文件')
      await this._readAndApplyTemplate(files[0], files[0].path)
      return true
    }
    throw new Error('模板路径不存在，或不是模板文件/目录')
  }

  _getCreateFolderPath(folderPath) {
    if (folderPath) return folderPath
    const { filePathType, filePath } = this.settings
    switch (filePathType) {
      case 'root':
        return ''
      case 'custom':
        return filePath
      case 'currentFileFolder':
        return this._getActiveFileDirectory()
      default:
        return ''
    }
  }

  async _getAvailableFilaName(filePath, extCount = 1) {
    let counter = 1
    while (await this.app.vault.adapter.exists(filePath)) {
      const parts = filePath.split('.')
      const extList = []
      for (let i = 0; i < extCount; i++) {
        extList.push(parts.pop())
      }
      const ext = extList.reverse().join('.')
      filePath = `${parts.join('.')}_${counter}.${ext}`
      counter++
    }
    return filePath
  }

  async _addSetting() {
    await this._loadSettings()
    this.addSettingTab(new SmmSettingTab(this.app, this))
  }

  async _loadSettings() {
    try {
      const data = await this.loadData()
      this.settings = Object.assign({}, DEFAULT_SETTINGS, data || {})
      this.settings.autoSaveTime = normalizePositiveInteger(
        this.settings.autoSaveTime,
        DEFAULT_SETTINGS.autoSaveTime
      )
      this.settings.codeBlockInitHeight = normalizeCodeBlockHeight(
        this.settings.codeBlockInitHeight,
        DEFAULT_SETTINGS.codeBlockInitHeight
      )
      this.settings.codeBlockBgIsTransparent =
        this.settings.codeBlockBgIsTransparent === true
      this.settings.langFollowOb = this.settings.langFollowOb !== false
      this.settings.formulaRenderMode = ['mathml', 'html'].includes(
        this.settings.formulaRenderMode
      )
        ? this.settings.formulaRenderMode
        : DEFAULT_SETTINGS.formulaRenderMode
      this.settings.defaultNodeFont =
        typeof this.settings.defaultNodeFont === 'string'
          ? this.settings.defaultNodeFont.trim()
          : DEFAULT_NODE_FONT
      this.settings.addedFonts = Array.isArray(this.settings.addedFonts)
        ? this.settings.addedFonts.filter(font => typeof font === 'string')
        : []
      this.settings.useImgHosting = false
      this._applyLanguageSetting()
    } catch (error) {
      this._reportError('初始化思维导图设置失败', error)
      throw error
    }
  }

  _applyLanguageSetting() {
    if (!this.settings.langFollowOb) {
      const manual = langList.find(item => item.value === this.settings.lang)
      this.settings.lang = manual ? manual.value : DEFAULT_SETTINGS.lang
      return
    }
    const obLang = getLanguage()
    const target = langList.find(
      item => item.value === obLang || item.alias === obLang
    )
    this.settings.lang = target ? target.value : 'en'
  }

  async _saveSettings() {
    await this.saveData(this.settings)
    const language = this.settings.lang === 'zhtw' ? 'zh-TW' : this.settings.lang
    if (i18n.language !== language) await i18n.changeLanguage(language)
  }

  _registerMonkeyPatches() {
    const key = this.manifest.id
    this.register(
      around(Workspace.prototype, {
        getActiveViewOfType(old) {
          return dedupe(key, old, function(...args) {
            const result = old && old.apply(this, args)
            if (args[1] === IGNORE_CHECK_SMM) {
              return result
            }
            const currentView = this.app?.workspace?.activeLeaf?.view
            if (!currentView || !(currentView instanceof SmmEditView))
              return result
          })
        }
      })
    )
    if (!this.app.plugins?.plugins?.['obsidian-hover-editor']) {
      this.register(
        around(WorkspaceLeaf.prototype, {
          getRoot(old) {
            return function() {
              const top = old.call(this)
              return top.getRoot === this.getRoot ? top : top.getRoot()
            }
          }
        })
      )
    }
    const self = this
    this.register(
      around(WorkspaceLeaf.prototype, {
        detach(next) {
          return function() {
            return next.apply(this)
          }
        },
        setViewState(next) {
          return function(state, ...rest) {
            if (
              (state.state?.isSwitchToMarkdownViewFromSmmView ||
                ['preview', 'source'].includes(state.state?.mode)) &&
              !state.state?.isPreviewToMindMapViewFromMdView
            ) {
              return next.apply(this, [state, ...rest])
            }
            if (
              self._loaded &&
              state.type === 'markdown' &&
              state.state?.file
            ) {
              const curFilePath = state.state.file
              if (self._isSmmFile(curFilePath)) {
                let isStop = false
                if (rest && rest[0]) {
                  if (rest[0].subpath) {
                    self.fileToSubpathMap[curFilePath] = rest[0].subpath
                  } else if (
                    rest[0].match &&
                    rest[0].match.matches.length > 0
                  ) {
                    const uid = getUidFromSource(rest[0])
                    if (uid) {
                      const existLeaf = this.app.workspace
                        .getLeavesOfType(SMM_VIEW_TYPE)
                        .find(leaf => {
                          const file = leaf.view.file
                            ? leaf.view.file.path
                            : leaf.view.state.file
                          return file && file === curFilePath
                        })
                      if (existLeaf) {
                        if (
                          existLeaf.view instanceof SmmEditView &&
                          existLeaf.view.jumpToNodeByUid
                        ) {
                          existLeaf.view.jumpToNodeByUid(uid)
                        } else {
                          self.fileToSubpathMap[curFilePath] = uid
                        }
                        this.app.workspace.setActiveLeaf(existLeaf)
                        isStop = true
                      } else {
                        self.fileToSubpathMap[curFilePath] = uid
                      }
                    }
                  }
                }
                if (isStop) return
                const newState = {
                  ...state,
                  type: SMM_VIEW_TYPE
                }
                return next.apply(this, [newState, ...rest])
              }
            }
            return next.apply(this, [state, ...rest])
          }
        }
      })
    )
    this.menus.addMarkdownFileMenus()
  }

  _switchToSmmAfterLoad() {
    this.app.workspace.onLayoutReady(async () => {
      let leaf
      const markdownLeaf = this.app.workspace.getLeavesOfType('markdown')
      for (leaf of markdownLeaf) {
        if (
          leaf.view instanceof MarkdownView &&
          leaf.view.file &&
          this._isSmmFile(leaf.view.file)
        ) {
          this._setSmmView(leaf)
        }
      }
    })
  }

  async _setSmmView(leaf) {
    await leaf.setViewState({
      type: SMM_VIEW_TYPE,
      state: leaf.view.getState(),
      popstate: true
    })
  }

  _getActiveSmmView() {
    return this.app.workspace.getActiveViewOfType(SmmEditView, IGNORE_CHECK_SMM)
  }

  _isSmmFile(file) {
    if (!file) {
      return false
    }
    const isString = typeof file === 'string'
    const filePath = isString ? file : file.path
    if (filePath.endsWith('.smm.md')) {
      return true
    }
    let cache = null
    if (isString) {
      cache = this.app.metadataCache.getCache(file)
    } else {
      if (file.extension === SMM_FILE_EXTENSION) {
        return true
      }
      cache = this.app.metadataCache.getFileCache(file)
    }
    const tags = cache?.frontmatter?.tags
    const tagList = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
        ? [tags]
        : []
    if (tagList.some(tag => String(tag).replace(/^#/, '') === SMM_TAG)) {
      return true
    }
    if (/\.smm.*\.md$/.test(filePath)) {
      return true
    }
    return false
  }

  _initStatusBar() {
    this.statusBarItem = this.addStatusBarItem()
    this.statusBarItem.empty()
    this.statusBarItem.style.display = 'none'

    this.smmFileStatus = this.statusBarItem.createEl('div', {
      cls: 'smm-file-status'
    })

    this.registerEvent(
      this.app.workspace.on('file-open', this._updateStatusBar.bind(this))
    )

    this.registerEvent(
      this.app.workspace.on(
        'active-leaf-change',
        this._updateStatusBar.bind(this)
      )
    )

    this._updateStatusBar()
  }

  _updateStatusBar() {
    const activeFile = this.app.workspace.getActiveFile()

    const isSmmFile = activeFile && this._isSmmFile(activeFile)

    const statusBar = this.app.statusBar.containerEl

    if (isSmmFile) {
      this.statusBarItem.style.display = 'block'
      statusBar.classList.add('smm-file-status-active')
    } else {
      this.statusBarItem.style.display = 'none'
      statusBar.classList.remove('smm-file-status-active')
    }
  }

  async _ensureDirectoryExists(dirPath) {
    if (!dirPath) return
    const { vault } = this.app
    const exist = await vault.exists(dirPath)
    if (!exist) {
      await vault.createFolder(dirPath)
    }
  }

  _t(val) {
    return i18n.t(val)
  }

  _getCreateDefaultMindMapOptions() {
    const { defaultTheme, defaultThemeDark, defaultLayout } = this.settings
    return {
      theme: this._getObIsDark() ? defaultThemeDark : defaultTheme,
      layout: defaultLayout,
      themeConfig: this._getDefaultNodeThemeConfig(),
      rootNodeDefaultText: this._t('common.rootNodeDefaultText'),
      secondNodeDefaultText: this._t('common.secondNodeDefaultText'),
      branchNodeDefaultText: this._t('common.branchNodeDefaultText')
    }
  }

  _getDefaultNodeThemeConfig() {
    const fontFamily = String(this.settings.defaultNodeFont ?? '').trim()
    if (!fontFamily) return {}
    return {
      root: { fontFamily },
      second: { fontFamily },
      node: { fontFamily },
      generalization: { fontFamily }
    }
  }

  _createDefaultMindMapData() {
    return createDefaultMindMapData(
      this._getCreateDefaultMindMapOptions(),
      false
    )
  }

  _getActiveFileDirectory() {
    const activeFile = this.app.workspace.getActiveFile()
    if (!activeFile) {
      return null
    }
    if (activeFile instanceof TFolder) {
      return null
    }
    const parent = activeFile.parent
    if (!parent) {
      return null
    }
    return parent.path.replace(/\/$/, '')
  }

  _getObIsDark() {
    return document.body.classList.contains('theme-dark')
  }

  _reportError(scope, error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[${this.manifest.id}] ${scope}`, error)
    new Notice(`${scope}: ${message}`)
  }

  async _mdToMindmapData(md) {
    const frontMatterRegex = /^---\n[\s\S]*?\n---\n/
    const cleanedMd = md.replace(frontMatterRegex, '')
    if (!cleanedMd.trim()) {
      return null
    }
    const data = await markdown.transformMarkdownTo(cleanedMd, false)
    if (!data) {
      return null
    }
    const { defaultTheme, defaultThemeDark, defaultLayout } = this.settings
    return {
      root: data,
      layout: defaultLayout,
      theme: {
        template: this._getObIsDark() ? defaultThemeDark : defaultTheme,
        config: this._getDefaultNodeThemeConfig()
      }
    }
  }

  onunload() {
    this.markdownPostProcessor.destroy()
    this.statusBarItem?.remove()
    this.commands.clear()
  }
}
