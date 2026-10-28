const { Plugin, MarkdownView, Notice, TFile, normalizePath } = require('obsidian')
const { createDocument, isMindMapDocument } = require('./document/format')
const MindMapView = require('./view')
const MindMapSettings = require('./settings')
require('../styles.css')

const VIEW = 'personal-mindmap'

class PersonalMindMap extends Plugin {
  async onload() {
    this.settings = { folder: '', ...(await this.loadData() || {}) }
    this.views = new Map()
    this.opening = new Map()
    this.markdownMode = new WeakMap()
    this.routing = new WeakSet()
    this.stopping = false
    this.registerView(VIEW, leaf => new MindMapView(leaf, this))
    this.addSettingTab(new MindMapSettings(this.app, this))
    this.registerCommands()
    this.registerEvents()
    this.app.workspace.onLayoutReady(() => {
      if (this.stopping) return
      for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
        void this.autoOpen(leaf.view.file, leaf)
      }
    })
  }

  registerCommands() {
    this.addRibbonIcon('git-fork', '新建思维导图', () => this.newDocument())
    this.addCommand({ id: 'new-map', name: '新建思维导图', callback: () => this.newDocument() })
    this.addCommand({ id: 'open-map', name: '用思维导图打开当前文件',
      checkCallback: checking => {
        const file = this.app.workspace.getActiveFile()
        if (!file || !this.isCandidate(file)) return false
        if (!checking) void this.openMap(file).catch(error => new Notice(error.message))
        return true
      } })
    this.addCommand({ id: 'save-map', name: '保存当前导图',
      checkCallback: checking => this.runOnActive(checking, view => view.save()) })
    this.addCommand({ id: 'copy-map', name: '将当前导图另存副本',
      checkCallback: checking => this.runOnActive(checking, view => view.saveCopy()) })
    this.addCommand({ id: 'show-markdown', name: '用 Markdown 打开当前导图',
      checkCallback: checking => this.runOnActive(checking, view => this.showMarkdown(view)) })
  }

  runOnActive(checking, action) {
    const view = this.app.workspace.activeLeaf?.view
    if (!(view instanceof MindMapView)) return false
    if (!checking) void Promise.resolve(action(view)).catch(error => new Notice(error.message))
    return true
  }

  registerEvents() {
    this.registerEvent(this.app.workspace.on('file-open', file => {
      void this.autoOpen(file, this.app.workspace.activeLeaf)
    }))
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file, source, leaf) => {
      if (!(file instanceof TFile) || !this.isCandidate(file)) return
      menu.addItem(item => item.setTitle('用思维导图打开').setIcon('git-fork')
        .onClick(() => this.openMap(file, leaf).catch(error => new Notice(error.message))))
    }))
    this.registerEvent(this.app.vault.on('modify', file => {
      const view = this.views.get(file)
      if (view) void view.readExternal().catch(error => view.reportError(error))
    }))
    this.registerEvent(this.app.vault.on('delete', file => this.views.get(file)?.deleted()))
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
      for (const view of this.views.values()) view.updateActivity()
    }))
    this.registerEvent(this.app.workspace.on('css-change', () => {
      for (const view of this.views.values()) view.editor?.setDark(this.isDark())
    }))
  }

  isCandidate(file) {
    return file.extension === 'md' && (file.name.endsWith('.mindmap.md') ||
      this.app.metadataCache.getFileCache(file)?.frontmatter?.personal_mindmap === true)
  }

  async autoOpen(file, leaf) {
    if (this.stopping || !file || !leaf || !this.isCandidate(file)) return
    if (this.markdownMode.get(leaf) === file || this.routing.has(leaf)) return
    if (!(leaf.view instanceof MarkdownView) || leaf.view.file !== file) return
    try {
      const raw = await this.app.vault.read(file)
      if (!isMindMapDocument(raw) || leaf.view.file !== file) return
      if (this.markdownMode.get(leaf) === file || this.routing.has(leaf) ||
          !(leaf.view instanceof MarkdownView)) return
      if (leaf.view.editor.getValue().replace(/\r\n/g, '\n') !== raw.replace(/\r\n/g, '\n')) return
      await this.openMap(file, leaf)
    } catch (error) {
      console.error('思维导图自动打开失败', error)
    }
  }

  async openMap(file, requestedLeaf) {
    if (this.opening.has(file)) return this.opening.get(file)
    const operation = this.performOpen(file, requestedLeaf)
    this.opening.set(file, operation)
    try { return await operation }
    finally { this.opening.delete(file) }
  }

  async performOpen(file, requestedLeaf) {
    const existing = this.views.get(file)
    if (existing) {
      this.app.workspace.setActiveLeaf(existing.leaf, { focus: true })
      return
    }
    const leaf = requestedLeaf || this.app.workspace.getLeaf(false)
    const other = this.app.workspace.getLeavesOfType('markdown')
      .some(item => item !== leaf && item.view.file === file)
    if (other) throw new Error('请先关闭此文件的其他 Markdown 编辑标签，避免同时写入')
    const raw = await this.app.vault.read(file)
    if (leaf.view instanceof MarkdownView && leaf.view.file === file &&
        leaf.view.editor.getValue().replace(/\r\n/g, '\n') !== raw.replace(/\r\n/g, '\n')) {
      throw new Error('Markdown 中还有未保存的文字，请保存后再切换导图')
    }
    this.markdownMode.delete(leaf)
    this.routing.add(leaf)
    try {
      await leaf.setViewState({ type: VIEW, state: { file: file.path }, active: true })
    } finally {
      this.routing.delete(leaf)
    }
  }

  async showMarkdown(view) {
    await view.save()
    if (view.session?.dirty) throw new Error('导图尚未保存，已取消视图切换')
    this.markdownMode.set(view.leaf, view.file)
    await view.leaf.setViewState({ type: 'markdown', state: { file: view.file.path, mode: 'source' } })
  }

  defaultData() {
    return { root: { data: { text: '中心主题' }, children: [] },
      layout: 'logicalStructure', theme: { template: 'default', config: {} }, view: null }
  }

  async newDocument() {
    try {
      const folder = this.settings.folder || this.app.workspace.getActiveFile()?.parent?.path || ''
      const raw = createDocument(this.defaultData())
      const file = await this.createUnique(raw, folder, '未命名导图')
      await this.openMap(file, this.app.workspace.getLeaf('tab'))
    } catch (error) { new Notice(`新建导图失败：${error.message}`) }
  }

  async createUnique(raw, folder, stem) {
    const prefix = folder && folder !== '/' ? normalizePath(folder) + '/' : ''
    if (prefix && !this.app.vault.getAbstractFileByPath(prefix.slice(0, -1))) {
      await this.app.vault.createFolder(prefix.slice(0, -1))
    }
    let number = 0
    while (true) {
      const path = `${prefix}${stem}${number ? ' ' + number : ''}.mindmap.md`
      if (!this.app.vault.getAbstractFileByPath(path)) return this.app.vault.create(path, raw)
      number++
    }
  }

  isDark() { return document.body.classList.contains('theme-dark') }
  saveSettings() { return this.saveData(this.settings) }

  onunload() {
    this.stopping = true
    for (const view of this.views.values()) {
      void view.closeSafely().finally(() => {
        if (view.leaf.view === view && view.file) {
          void view.leaf.setViewState({ type: 'markdown', state: { file: view.file.path } })
        }
      })
    }
  }
}

module.exports = PersonalMindMap
