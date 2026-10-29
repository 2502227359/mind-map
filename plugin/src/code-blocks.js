import { MarkdownRenderChild, MarkdownView, Notice } from 'obsidian'
import { initApp } from '../reference/src/main.js'
import { createEditorApi } from './editor-api.js'
import { createDocument, parseDocument } from './document/format.js'
import { replaceCodeBlock } from './document/code-block.js'
import { AssetStore } from './assets.js'

function readMap(source) {
  const value = JSON.parse(source)
  const map = value.mindMapData || value
  const data = typeof map === 'string' ? JSON.parse(map) : map
  const valid = parseDocument(createDocument(data)).data
  return { layout: 'logicalStructure', ...valid, theme: { template: 'default', config: {}, ...valid.theme } }
}

function sourceViews(app, path) {
  const views = app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view)
    .filter(view => view instanceof MarkdownView && view.file?.path === path && view.getMode() === 'source')
  const values = new Set(views.map(view => view.editor.getValue()))
  if (values.size > 1) throw new Error('同一笔记的多个编辑器内容不同，请先完成笔记保存')
  return views
}

function updateEditor(editor, next) {
  const raw = editor.getValue()
  let start = 0
  let end = raw.length
  let nextEnd = next.length
  while (start < end && raw[start] === next[start]) start++
  while (end > start && nextEnd > start && raw[end - 1] === next[nextEnd - 1]) { end--; nextEnd-- }
  editor.replaceRange(next.slice(start, nextEnd), editor.offsetToPos(start), editor.offsetToPos(end))
}

function mountEditor(container, plugin, file, data, options = {}) {
  const initial = JSON.parse(JSON.stringify(data))
  if (options.readonly && plugin.settings.codeBlockBgIsTransparent) initial.theme.config.backgroundColor = 'transparent'
  const api = createEditorApi({
    app: plugin.app, plugin, getFile: () => file, assetStore: plugin.assets,
    saveFileToVault: (asset, kind = true) => plugin.assets.saveFile(asset, file, kind === true || kind === 'image' ? 'image' : 'attachment'),
    documentApi: {
      isActive: () => !options.readonly && container.isConnected && container.clientWidth > 0 && container.clientHeight > 0 && plugin.app.workspace.activeLeaf?.view?.containerEl.contains(container),
      getIsReadonlyMode: () => Boolean(options.readonly),
      getIsCodeBlock: () => true,
      getInitMindMapData: () => JSON.stringify(initial),
      getInitLocationNodeId: () => '',
      getMindMapCurrentData: content => options.onData?.(content),
      saveMindMapData: () => options.onSave?.()
    }
  })
  const editor = initApp(container.createDiv('smm-common-full-size'), api)
  plugin._codeBlockEditors.add(editor)
  return editor
}

function destroyEditor(editor, plugin) {
  if (!editor) return
  plugin._codeBlockEditors.delete(editor)
  if (editor._isDestroyed) return
  editor.$clearUpdateMindMapSize()
  editor.$destroy()
  editor.$el.remove()
}

class CodeBlockSession {
  constructor(plugin, file, locator, source) {
    this.app = plugin.app
    this.plugin = plugin
    this.file = file
    this.locator = locator
    this.source = source
    this.data = readMap(source)
    this.current = JSON.stringify(this.data)
    this.saved = this.current
    this.pending = Promise.resolve()
    plugin._codeBlockSessions.add(this)
  }

  mount(host, actions) {
    this.host = host
    const save = actions.createEl('button', { text: '保存导图', cls: 'mod-cta' })
    save.onclick = async () => {
      save.disabled = true
      try { await this.capture(); await this.save(); new Notice('代码块导图已保存') }
      catch (error) { this.report(error) }
      finally { save.disabled = false }
    }
    this.editor = mountEditor(host, this.plugin, this.file, this.data, {
      onData: content => { this.current = content },
      onSave: async () => { await this.capture(); await this.save() }
    })
  }

  async capture() {
    if (this.editor?.$getCurrentMindMap?.()) await this.editor.$getMindMapCurrentData()
  }

  save() {
    const operation = this.pending.catch(() => {}).then(async () => {
      if (this.current === this.saved) return
      const snapshot = this.current
      const views = sourceViews(this.app, this.file.path)
      let document
      const transform = raw => {
        const next = replaceCodeBlock(raw, { ...this.locator, source: this.source }, snapshot)
        document = next
        return next
      }
      if (views.length) await this.saveSourceViews(views, transform)
      else await this.app.vault.process(this.file, transform)
      this.source = snapshot
      this.locator.document = document
      this.locator.vaultDocument = await this.app.vault.read(this.file)
      this.saved = snapshot
    })
    this.pending = operation
    return operation
  }

  async saveSourceViews(views, transform) {
    const raw = views[0].editor.getValue()
    const disk = await this.app.vault.read(this.file)
    if (disk !== this.locator.vaultDocument && disk !== raw) {
      throw new Error('笔记磁盘内容已被外部修改，已停止保存')
    }
    const next = transform(raw)
    await this.app.vault.process(this.file, current => {
      if (current !== disk || views.some(view => view.editor.getValue() !== raw)) {
        throw new Error('保存期间笔记发生变化，已停止写入')
      }
      views.forEach(view => updateEditor(view.editor, next))
      return next
    })
    if (await this.app.vault.read(this.file) !== next) {
      throw new Error('笔记编辑器尚未成功写回文件，请重试或关闭以生成恢复副本')
    }
  }

  report(error) { new Notice(`代码块保存失败：${error.message || error}`) }

  async recover(error) {
    this.report(error)
    if (this.current === this.saved) return
    const path = `${this.file.parent.path === '/' ? '' : this.file.parent.path + '/'}${this.file.basename}-导图恢复-${Date.now()}.md`
    try {
      await this.app.vault.create(path, '```smm\n' + this.current + '\n```\n')
      new Notice(`未覆盖原笔记，导图已保存到：${path}`)
    } catch (recoveryError) {
      // 复制文本仍可从控制台取回，不把失败冒充已恢复。
      console.error('导图恢复文件写入失败', recoveryError, this.current)
      new Notice('导图恢复文件也写入失败，请从开发者控制台复制导图数据', 0)
    }
  }

  dispose() {
    if (this.disposed) return this.disposing
    this.disposed = true
    this.disposing = this.capture().then(() => this.save()).catch(error => this.recover(error))
      .finally(() => {
        destroyEditor(this.editor, this.plugin)
        this.editor = null
        this.plugin._codeBlockSessions.delete(this)
      })
    return this.disposing
  }
}

class CodeBlockPreview extends MarkdownRenderChild {
  constructor(container, plugin, source, context) {
    super(container)
    this.plugin = plugin
    this.source = source
    this.context = context
  }

  onload() {
    const { plugin, containerEl, context } = this
    try { this.data = readMap(this.source) }
    catch (error) { containerEl.createEl('p', { text: `导图代码块数据无效：${error.message}` }); return }
    const actions = containerEl.createDiv('personal-mindmap-block-actions')
    this.actions = actions
    this.status = actions.createEl('span', { text: '思维导图' })
    this.host = containerEl.createDiv('smm-common-full-size personal-mindmap-block-preview')
    this.host.style.height = `${Math.max(180, Number(plugin.settings.codeBlockInitHeight) || 300)}px`
    this.disposed = false
    this.resize = new ResizeObserver(() => {
      const visible = this.host.clientWidth > 0 && this.host.clientHeight > 0
      if (!visible && this.wasVisible && this.session) {
        this.session.capture().then(() => this.session.save()).catch(error => this.session.recover(error))
      }
      this.wasVisible = visible
      if (this.session?.editor) this.session.editor.$updateMindMapSize()
      else if (this.editor) this.editor.$updateMindMapSize()
      else if (this.host.clientWidth > 0 && this.host.clientHeight > 0) this.initialize()
    })
    this.resize.observe(this.host)
  }

  initialize() {
    if (this.initializing || this.disposed) return
    this.initializing = true
    // 处理器初次调用时容器尚未挂载，需等到可见后再辨认阅读与编辑模式。
    this.inline = !!this.containerEl.closest('.markdown-source-view')
    this.status.setText(this.inline ? '笔记内编辑 · 修改后点击保存导图' : '思维导图 · 阅读模式')
    if (this.inline) {
      this.openEditor().catch(error => new Notice(error.message))
    } else {
      const file = this.plugin.app.vault.getFileByPath(this.context.sourcePath)
      this.editor = mountEditor(this.host, this.plugin, file, this.data, { readonly: true })
    }
  }

  async openEditor() {
    const { app } = this.plugin
    const file = app.vault.getFileByPath(this.context.sourcePath)
    if (!file) throw new Error('笔记尚未保存或已删除，不能编辑代码块')
    const views = sourceViews(app, file.path)
    const vaultDocument = await app.vault.read(file)
    const raw = views[0] ? views[0].editor.getValue() : vaultDocument
    const locator = { lineStart: this.context.getSectionInfo(this.containerEl)?.lineStart, document: raw, vaultDocument }
    replaceCodeBlock(raw, { ...locator, source: this.source }, this.source)
    if (this.disposed) return
    this.host.classList.add('personal-mindmap-block-inline')
    this.session = new CodeBlockSession(this.plugin, file, locator, this.source)
    this.session.mount(this.host, this.actions)
  }

  onunload() {
    this.disposed = true
    this.resize?.disconnect()
    this.session?.dispose()
    destroyEditor(this.editor, this.plugin)
    this.editor = null
  }
}

export function registerCodeBlocks(plugin) {
  plugin.assets = plugin.assets || new AssetStore(plugin.app, () => plugin.settings)
  plugin._codeBlockEditors = new Set()
  plugin._codeBlockSessions = new Set()
  plugin.register(() => {
    const editing = new Set([...plugin._codeBlockSessions].map(session => session.editor))
    for (const session of [...plugin._codeBlockSessions]) session.dispose()
    for (const editor of [...plugin._codeBlockEditors]) {
      if (!editing.has(editor)) destroyEditor(editor, plugin)
    }
  })
  plugin.registerMarkdownCodeBlockProcessor('smm', (source, element, context) => {
    context.addChild(new CodeBlockPreview(element, plugin, source, context))
  })
  plugin.addCommand({
    id: 'insert-smm-code-block', name: '插入思维导图代码块',
    editorCallback: editor => editor.replaceSelection('```smm\n' + plugin._createDefaultMindMapData() + '\n```\n')
  })
}
