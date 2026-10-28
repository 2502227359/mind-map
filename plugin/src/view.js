const { TextFileView, Notice, Scope } = require('obsidian')
const { parseDocument, serializeDocument } = require('./document/format')
const { SaveCoordinator, SaveConflictError } = require('./document/save')
const { pickNote, confirmDiscard, chooseAction, openLink } = require('./host')
const mountEditor = require('../../web/src/obsidian/createEditor').default

class MindMapView extends TextFileView {
  constructor(leaf, plugin) {
    super(leaf)
    this.plugin = plugin
    this.editor = null
    this.session = null
    this.mountToken = 0
    this.loading = true
    this.closePromise = null
    this.externalRead = 0
    this.scope = new Scope(this.app.scope)
    this.scope.register(['Mod'], 'f', event => {
      event.preventDefault()
      this.editor?.search()
      return false
    })
    this.scope.register(['Mod'], 's', event => {
      event.preventDefault()
      void this.save().catch(error => this.reportError(error))
      return false
    })
  }

  getViewType() { return 'personal-mindmap' }
  getDisplayText() { return this.file?.basename.replace(/\.mindmap$/, '') || '思维导图' }
  getIcon() { return 'git-fork' }
  getViewData() { return this.session?.currentRaw || this.data || '' }

  async onOpen() {
    this.contentEl.addClass('pmind-view')
    this.statusBar = this.contentEl.createDiv('pmind-save-bar')
    this.statusText = this.statusBar.createSpan({ text: '正在加载' })
    this.addButton('保存', () => this.save())
    this.addButton('另存副本', () => this.saveCopy())
    this.addButton('重新加载', () => this.reloadDisk())
    this.editorEl = this.contentEl.createDiv('pmind-editor')
    this.addAction('file-text', '用 Markdown 打开', () => {
      void this.plugin.showMarkdown(this).catch(error => this.reportError(error))
    })
    this.observer = new ResizeObserver(() => this.resizeEditor())
    this.observer.observe(this.editorEl)
    this.registerDomEvent(this.contentEl, 'keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        event.stopPropagation()
        void this.save().catch(error => this.reportError(error))
      }
    }, true)
  }

  addButton(text, action) {
    const button = this.statusBar.createEl('button', { text })
    button.onclick = () => { void Promise.resolve(action()).catch(error => this.reportError(error)) }
  }

  async onLoadFile(file) {
    this.file = file
    this.closePromise = null
    const other = this.plugin.views.get(file)
    if (other && other !== this) {
      this.editorEl.setText('此导图已在其他标签页打开，请使用已有编辑器。')
      return
    }
    this.plugin.views.set(file, this)
    await this.loadRaw(await this.app.vault.read(file))
  }

  async setViewData(raw) {
    if (this.closePromise) return
    if (this.session) await this.handleExternal(raw)
    else await this.loadRaw(raw)
  }

  async loadRaw(raw) {
    const token = ++this.mountToken
    this.loading = true
    this.editor?.destroy()
    this.editor = null
    this.session?.dispose()
    this.session = null
    this.editorEl.empty()
    this.data = raw
    try {
      this.snapshot = parseDocument(raw).data
      this.session = this.createSession(raw)
      this.pendingMount = { token, data: this.snapshot }
      await this.mountWhenVisible()
    } catch (error) {
      this.pendingMount = null
      this.editorEl.setText(`${error.message}\n原文件未被修改，可切换 Markdown 检查。`)
      this.reportError(error)
    }
  }

  createSession(raw) {
    const file = this.file
    return new SaveCoordinator({ raw,
      write: async (expected, next) => {
        if (this.app.vault.getAbstractFileByPath(file.path) !== file) {
          throw new Error('原文件已被删除，不能写入；请另存副本')
        }
        return this.app.vault.process(file, current => {
          if (current !== expected) throw new SaveConflictError()
          return next
        })
      },
      onState: (state, error) => this.showState(state, error)
    })
  }

  async mountWhenVisible() {
    const pending = this.pendingMount
    if (!pending || this.mounting || !this.editorEl.isConnected) return
    const rect = this.editorEl.getBoundingClientRect()
    if (rect.width < 20 || rect.height < 20) return
    this.mounting = true
    try {
      await new Promise(resolve => setTimeout(resolve, 0))
      const current = this.editorEl.getBoundingClientRect()
      if (current.width < 20 || current.height < 20 || this.closePromise) return
      const editor = await mountEditor(this.editorEl, this.editorHost(pending.data))
      if (pending.token !== this.mountToken || this.closePromise) { editor.destroy(); return }
      this.editor = editor
      this.pendingMount = null
      this.loading = false
      this.showState('ready')
    } finally {
      this.mounting = false
      if (this.pendingMount && this.pendingMount !== pending) void this.mountWhenVisible()
    }
  }

  editorHost(data) {
    return { data, preferences: { isDark: this.plugin.isDark() },
      onChange: snapshot => this.changed(snapshot),
      onSave: () => this.save().catch(error => this.reportError(error)),
      onSaveAs: () => this.saveCopy().catch(error => this.reportError(error)),
      onNewFile: () => this.plugin.newDocument(),
      onPickNote: () => pickNote(this.app),
      onConfirm: options => chooseAction(this.app, options),
      onOpenLink: link => openLink(this, link).catch(error => this.reportError(error)),
      isActive: () => this.app.workspace.activeLeaf === this.leaf && !this.closePromise
    }
  }

  changed(snapshot) {
    if (this.loading || !this.session || this.closePromise) return
    this.snapshot = { ...this.snapshot, ...snapshot }
    this.session.update(serializeDocument(this.session.currentRaw, this.snapshot))
  }

  capture() {
    if (this.editor && !this.loading) this.changed(this.editor.getData())
  }

  async save() {
    this.capture()
    if (!this.session) return
    if (this.session.state === 'deleted') throw new Error('文件已删除，请另存副本')
    await this.session.flush()
    this.data = this.session.currentRaw
  }

  async readExternal() {
    if (this.closePromise || !this.file || !this.session) return
    const sequence = ++this.externalRead
    const file = this.file
    const raw = await this.app.vault.read(file)
    if (sequence !== this.externalRead || this.file !== file || this.closePromise) return
    await this.handleExternal(raw)
  }

  async handleExternal(raw) {
    if (!this.session || this.closePromise) return
    if (raw !== this.session.currentRaw && raw !== this.session.baseRaw) this.capture()
    const result = this.session.acceptExternal(raw)
    if (result === 'reload') await this.loadRaw(raw)
    if (result === 'conflict') this.showState('conflict')
  }

  async reloadDisk() {
    if (this.session?.state === 'saving') {
      new Notice('正在保存，请完成后再重新加载')
      return
    }
    if (this.session?.dirty && !await confirmDiscard(this.app)) return
    if (this.session?.state === 'saving') {
      new Notice('保存已经开始，请完成后再重新加载')
      return
    }
    this.externalRead++
    await this.loadRaw(await this.app.vault.read(this.file))
  }

  async saveCopy(recovery = false) {
    this.capture()
    const raw = this.session?.currentRaw || this.data
    parseDocument(raw)
    const stem = this.file.basename.replace(/\.mindmap$/, '') + (recovery ? ' 恢复' : ' 副本')
    const file = await this.plugin.createUnique(raw, this.file.parent?.path || '', stem)
    new Notice(`已保存${recovery ? '恢复' : ''}副本：${file.path}`)
    return file
  }

  deleted() {
    this.capture()
    this.session?.setDeleted()
  }

  showState(state, error) {
    const labels = { ready: '已保存', dirty: '未保存', saving: '正在保存',
      conflict: '外部修改冲突，请重新加载或另存副本', error: '保存失败，请重试或另存副本',
      deleted: '原文件已删除，请另存副本', disposed: '已关闭' }
    this.statusText?.setText(labels[state] || state)
    this.statusBar?.setAttribute('data-state', state)
    if (error) this.reportError(error)
  }

  reportError(error) {
    this.statusText?.setText(error.message)
    new Notice(`思维导图：${error.message}`)
    console.error(`个人思维导图：${error.message}`, error)
  }

  resizeEditor() {
    const rect = this.editorEl.getBoundingClientRect()
    if (rect.width < 20 || rect.height < 20) return
    if (this.editor) this.editor.resize()
    else void this.mountWhenVisible().catch(error => this.reportError(error))
  }

  updateActivity() {
    if (this.app.workspace.activeLeaf === this.leaf) this.resizeEditor()
    else if (this.session?.dirty) void this.save().catch(error => this.reportError(error))
  }

  async onUnloadFile() { await this.closeSafely() }
  async onClose() { await this.closeSafely(); this.observer?.disconnect() }

  closeSafely() {
    if (this.closePromise) return this.closePromise
    this.capture()
    this.closePromise = this.finishClose()
    return this.closePromise
  }

  async finishClose() {
    try {
      if (this.session?.dirty) await this.session.flush()
      if (this.session?.dirty) throw new Error('当前内容尚未写入，尝试保存恢复副本')
    } catch (error) {
      this.reportError(error)
      try { await this.saveCopy(true) }
      catch (recoveryError) { this.reportError(new Error(`恢复副本也未能写入：${recoveryError.message}`)) }
    } finally {
      this.clear()
      this.session?.dispose()
      if (this.plugin.views.get(this.file) === this) this.plugin.views.delete(this.file)
    }
  }

  clear() {
    this.mountToken++
    this.pendingMount = null
    this.editor?.destroy()
    this.editor = null
    this.editorEl?.empty()
  }
}

module.exports = MindMapView
