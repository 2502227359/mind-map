import { TFile, TFolder, Notice, MarkdownView } from 'obsidian'
import { assembleMarkdownText } from './metadataAndMarkdown.js'
import { hideTargetMenu } from './utils.js'
import { PreviewMindMap } from './PreviewMindMap.js'
import LZString from 'lz-string'
import { SMM_VIEW_TYPE, SMM_TAG } from './constant.js'
import { around } from 'monkey-around'
import markdown from 'simple-mind-map/src/parse/markdown.js'
import { showConfirmationDialog } from './ConfirmDialog.js'
import { parseDocument } from '../../src/document/format.js'
import { openMarkdownMapPreview } from '../../src/markdown-preview-view.js'

export default class Menus {
  constructor(plugin) {
    this.plugin = plugin
    this.app = plugin.app

    this._addFileMenus()
  }

  _t(key) {
    return this.plugin._t(key)
  }

  _addFileMenus() {
    this.plugin.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (file instanceof TFolder) {
          menu.addItem(item => {
            item
              .setTitle(this._t('action.createMindMap'))
              .setIcon('smm-icon')
              .onClick(() => {
                this.plugin._createSmmFile(file.path)
              })
          })
        } else if (file instanceof TFile) {
          if (this.plugin._isSmmFile(file)) {
            hideTargetMenu(menu, '在新窗口中打开')
            hideTargetMenu(menu, '移动至新窗口')
            menu.addItem(item =>
              item
                .setTitle(this._t('action.openAsMd'))
                .setIcon('document')
                .setSection('open')
                .onClick(async () => {
                  await this.app.workspace.openLinkText(file.path, '')
                  const leaf = this.app.workspace.getLeaf(false)
                  const mdViewType = this.app.viewRegistry.getTypeByExtension(
                    'md'
                  )
                  await leaf.setViewState({
                    type: mdViewType,
                    state: {
                      ...leaf.getViewState().state,
                      isSwitchToMarkdownViewFromSmmView: true
                    },
                    active: true
                  })
                  this.app.workspace.revealLeaf(leaf)
                })
            )
            menu.addItem(item =>
              item
                .setTitle(this._t('action.changeToMdFile'))
                .setIcon('refresh-cw')
                .setSection('open')
                .onClick(() =>
                  this._confirmAndConvert(file, 'smm-to-md', 'copy')
                )
            )
            menu.addItem(item =>
              item
                .setTitle(`${this._t('action.changeToMdFile')}（覆盖）`)
                .setIcon('refresh-cw')
                .setSection('open')
                .onClick(() =>
                  this._confirmAndConvert(file, 'smm-to-md', 'overwrite')
                )
            )
          }
        }
      })
    )
  }

  addMarkdownFileMenus() {
    const self = this
    this.plugin.register(
      around(MarkdownView.prototype, {
        onPaneMenu(next) {
          return function(menu, source) {
            const res = next.apply(this, [menu, source])
            if (self.plugin._isSmmFile(this.file)) {
              if (source === 'more-options') {
                menu.addItem(item =>
                  item
                    .setTitle(self._t('action.openAsMindMap'))
                    .setIcon('document')
                    .setSection('pane')
                    .onClick(() => {
                      self.plugin._setSmmView(this.leaf)
                    })
                )
              }
            } else if (source === 'more-options') {
              ;[false, true].forEach(split => menu.addItem(item => item
                .setTitle(split ? '在分屏中预览为思维导图' : '在新标签页预览为思维导图')
                .setIcon('smm-icon')
                .setSection('pane')
                .onClick(() => openMarkdownMapPreview(self.plugin, this.file, split))))
              menu.addItem(item =>
                item
                  .setTitle(self._t('action.previewAsMindMap'))
                  .setIcon('smm-icon')
                  .setSection('pane')
                  .onClick(() => self.previewMarkdownFile(this.file))
              )
              menu.addItem(item =>
                item
                  .setTitle(self._t('action.changeToMindMapFile'))
                  .setIcon('refresh-cw')
                  .setSection('pane')
                  .onClick(() =>
                    self._confirmAndConvert(this.file, 'md-to-smm', 'copy')
                  )
              )
              menu.addItem(item =>
                item
                  .setTitle(`${self._t('action.changeToMindMapFile')}（覆盖）`)
                  .setIcon('refresh-cw')
                  .setSection('pane')
                  .onClick(() =>
                    self._confirmAndConvert(
                      this.file,
                      'md-to-smm',
                      'overwrite'
                    )
                  )
              )
            }
            return res
          }
        }
      })
    )
  }

  previewMarkdownFile(file) {
    let previewMindMap = null
    previewMindMap = new PreviewMindMap({
      plugin: this.plugin,
      file,
      onClose: () => {
        previewMindMap = null
      }
    })
    return previewMindMap
  }

  async _confirmAndConvert(file, direction, mode) {
    const contentKey =
      direction === 'smm-to-md' ? 'tip.mindMapToMdTip' : 'tip.mdToMindMapTip'
    const suffix = mode === 'overwrite' ? '（覆盖原文件）' : '（新建副本）'
    const confirmed = await showConfirmationDialog(this.app, {
      content: `${this._t(contentKey)}\n${suffix}`,
      confirmText: this._t('tip.confirm'),
      cancelText: this._t('tip.cancel'),
      danger: mode === 'overwrite'
    })
    if (!confirmed) return

    try {
      if (direction === 'smm-to-md') {
        await this._convertSmmToMarkdown(file, mode)
      } else {
        await this._convertMarkdownToSmm(file, mode)
      }
      new Notice(this._t('tip.changeSuccess'))
    } catch (error) {
      console.error(`[${this.plugin.manifest.id}] 文件转换失败`, error)
      new Notice(`转换失败：${error instanceof Error ? error.message : error}`)
    }
  }

  async _convertSmmToMarkdown(file, mode) {
    await this._flushOpenEditors(file)
    const sourcePath = file.path
    const sourceRaw = await this.app.vault.read(file)
    const parsed = parseDocument(sourceRaw)
    const mindMapData = parsed.data

    const tags = parsed.metadata.tags.filter(tag => tag !== SMM_TAG)
    const frontmatter = this._assembleMarkdownFrontmatter(
      tags,
      parsed.metadata.yaml
    )
    const maxLevel = Number.parseInt(
      this.plugin.settings.nodeTextToMarkdownTitleMaxLevel,
      10
    )
    const body = markdown.transformToMarkdown(
      mindMapData.root,
      Number.isInteger(maxLevel) && maxLevel > 0 ? maxLevel : 3
    )
    const converted = `${frontmatter}${body}`
    const basePath = sourcePath.replace(/\.smm\.md$/i, '.md')
    const targetPath =
      mode === 'copy'
        ? await this.plugin._getAvailableFilaName(basePath, 1)
        : basePath
    await this._commitConversion(file, sourceRaw, targetPath, converted, mode)
    await this._finishConversion(sourcePath, targetPath, 'markdown')
  }

  async _convertMarkdownToSmm(file, mode) {
    await this._flushOpenEditors(file)
    const sourcePath = file.path
    const sourceRaw = await this.app.vault.read(file)
    const frontmatter = this._parseMarkdownFrontmatter(sourceRaw)
    const mindMapData = await this.plugin._mdToMindmapData(
      sourceRaw.replace(/\r\n?/g, '\n')
    )
    if (!mindMapData) {
      throw new Error(this._t('tip.mdToMindMapFail'))
    }

    const tags = frontmatter.tags.filter(tag => tag !== SMM_TAG)
    tags.push(SMM_TAG)
    const basePath = sourcePath.replace(/\.md$/i, '.smm.md')
    const targetPath =
      mode === 'copy'
        ? await this.plugin._getAvailableFilaName(basePath, 2)
        : basePath
    const converted = assembleMarkdownText({
      metadata: {
        path: targetPath,
        tags,
        yaml: frontmatter.yaml,
        content: LZString.compressToBase64(JSON.stringify(mindMapData))
      },
      svgdata: '',
      linkdata: []
    })
    parseDocument(converted)
    parseDocument(converted)
    await this._commitConversion(file, sourceRaw, targetPath, converted, mode)
    await this._finishConversion(sourcePath, targetPath, 'smm')
  }

  _assembleMarkdownFrontmatter(tags, yaml) {
    let result = '---\n'
    result += 'tags:\n'
    for (const tag of tags) result += `  - ${tag}\n`
    if (yaml) result += yaml.endsWith('\n') ? yaml : `${yaml}\n`
    return `${result}---\n\n`
  }

  _parseMarkdownFrontmatter(content) {
    const normalized = String(content).replace(/\r\n?/g, '\n')
    if (!normalized.startsWith('---\n')) return { tags: [], yaml: '' }
    const end = normalized.indexOf('\n---\n', 4)
    if (end < 0) return { tags: [], yaml: '' }

    const headerLines = normalized.slice(4, end).split('\n')
    const tags = []
    const yamlLines = []
    let readingTags = false
    for (const line of headerLines) {
      const tagsMatch = line.match(/^tags\s*:\s*(.*)$/i)
      if (tagsMatch) {
        readingTags = true
        const inline = tagsMatch[1].trim()
        if (inline.startsWith('[') && inline.endsWith(']')) {
          tags.push(
            ...inline
              .slice(1, -1)
              .split(',')
              .map(tag => tag.trim().replace(/^['"]|['"]$/g, ''))
              .filter(Boolean)
          )
        } else if (inline) {
          tags.push(inline.replace(/^['"]|['"]$/g, ''))
        }
        continue
      }
      if (readingTags && /^\s*-\s*/.test(line)) {
        const tag = line.replace(/^\s*-\s*/, '').trim()
        if (tag) tags.push(tag.replace(/^['"]|['"]$/g, ''))
        continue
      }
      readingTags = false
      yamlLines.push(line)
    }
    return {
      tags: [...new Set(tags)],
      yaml: yamlLines.length ? yamlLines.join('\n') + '\n' : ''
    }
  }

  async _commitConversion(file, sourceRaw, targetPath, convertedRaw, mode) {
    const latestSource = await this.app.vault.read(file)
    if (latestSource !== sourceRaw) {
      throw new Error('源文件在转换前发生变化，请重试')
    }
    if (mode === 'copy') {
      if (this.app.vault.getFileByPath(targetPath)) {
        throw new Error(`目标文件已存在：${targetPath}`)
      }
      await this.app.vault.create(targetPath, convertedRaw)
      return
    }

    if (this.app.vault.getFileByPath(targetPath)) {
      throw new Error(
        `目标文件已存在：${targetPath}；请改用新建副本或先重命名目标文件`
      )
    }
    const previousNoSaveOnClose = this.app.noSaveOnClose
    this.app.noSaveOnClose = true
    try {
      await this.app.vault.create(targetPath, convertedRaw)
      const latestBeforeDelete = await this.app.vault.read(file)
      if (latestBeforeDelete !== sourceRaw) {
        try {
          await this.app.vault.delete(this.app.vault.getFileByPath(targetPath))
        } catch (rollbackError) {
          throw new Error(`源文件发生变化且目标回滚失败：${rollbackError.message}`)
        }
        throw new Error('源文件在转换过程中发生变化，请重试')
      }
      try {
        await this.app.vault.delete(file)
      } catch (error) {
        try {
          await this.app.vault.delete(this.app.vault.getFileByPath(targetPath))
        } catch (rollbackError) {
          error.message += `；目标文件回滚失败：${rollbackError.message}`
        }
        throw error
      }
    } finally {
      this.app.noSaveOnClose = previousNoSaveOnClose
    }
  }

  async _flushOpenEditors(file) {
    const sameFile = view => view?.file?.path === file.path
    for (const leaf of this.app.workspace.getLeavesOfType(SMM_VIEW_TYPE)) {
      if (sameFile(leaf.view) && typeof leaf.view.forceSave === 'function') {
        await leaf.view.forceSave(true)
      }
    }
    const markdownViews = this.app.workspace
      .getLeavesOfType('markdown')
      .map(leaf => leaf.view)
      .filter(sameFile)
    const editorValues = markdownViews
      .map(view => view.editor?.getValue?.())
      .filter(value => typeof value === 'string')
    if (new Set(editorValues).size > 1) {
      throw new Error('同一文件的多个编辑器内容不同，请先完成保存')
    }
    for (const view of markdownViews) {
      if (typeof view.save === 'function') await view.save()
    }
    if (editorValues.length) {
      const vaultRaw = await this.app.vault.read(file)
      if (editorValues[0] !== vaultRaw) {
        throw new Error('打开的编辑器仍有未保存内容，请先保存后再转换')
      }
    }
  }

  async _finishConversion(sourcePath, targetPath, targetType) {
    const leaves = this.app.workspace.getLeavesOfType(
      targetType === 'smm' ? SMM_VIEW_TYPE : 'markdown'
    )
    for (const leaf of leaves) {
      if (
        leaf.view?.file &&
        (leaf.view.file.path === sourcePath || leaf.view.file.path === targetPath)
      ) {
        leaf.detach()
        break
      }
    }
    await this.app.workspace.openLinkText(targetPath, '', true)
  }
}
