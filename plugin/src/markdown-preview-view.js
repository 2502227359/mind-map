import { ItemView, Notice } from 'obsidian'
import { initPreviewModeApp } from '../reference/src/main'

export const MARKDOWN_MAP_PREVIEW = 'personal-mindmap-markdown-preview'

// 普通 Markdown 的只读投影，独立于导图文件的读写、转换和保存协调器。
export class MarkdownMapPreviewView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf)
    this.plugin = plugin
    this.path = ''
    this.generation = 0
    this.previewApp = null
    this.closed = false
  }

  getViewType() { return MARKDOWN_MAP_PREVIEW }
  getDisplayText() { return `${this.path.split('/').pop() || 'Markdown'} · 导图预览` }
  getIcon() { return 'smm-icon' }
  getState() { return { file: this.path } }

  async setState(state, result) {
    this.path = state.file || ''
    await super.setState(state, result)
    await this.renderPreview()
    if (!this.closed) this.leaf.updateHeader()
  }

  async onOpen() {
    this.addAction('refresh-cw', '刷新导图预览', () => this.renderPreview())
    this.registerEvent(this.app.vault.on('modify', file => {
      if (file.path === this.path) this.renderPreview()
    }))
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (oldPath === this.path) {
        this.path = file.path
        this.leaf.updateHeader()
        this.renderPreview()
      }
    }))
    this.registerEvent(this.app.vault.on('delete', file => {
      if (file.path === this.path) { this.generation++; this.clearPreview(); this.contentEl.setText('源文件已删除') }
    }))
    const observer = new ResizeObserver(() => this.previewApp?.$bus.$emit('windowResize'))
    observer.observe(this.contentEl)
    this.register(() => observer.disconnect())
  }

  clearPreview() {
    this.previewApp?.$destroy()
    this.previewApp = null
    this.contentEl.empty()
  }

  async renderPreview() {
    const generation = ++this.generation
    try {
      const file = this.app.vault.getFileByPath(this.path)
      if (!file || file.extension !== 'md' || this.plugin._isSmmFile(file)) {
        this.clearPreview()
        this.contentEl.setText('请选择普通 Markdown 文件预览')
        return
      }
      const content = await this.app.vault.read(file)
      const data = await this.plugin._mdToMindmapData(content)
      if (this.closed || generation !== this.generation) return
      this.clearPreview()
      const wrap = this.contentEl.createDiv()
      this.contentEl.style.cssText = 'padding:0;overflow:hidden;position:relative;'
      this.previewApp = initPreviewModeApp(wrap, {
        getInitMindMapData: () => data,
        getIsTabPreview: () => true,
        getMindMapOptions: () => ({ readonly: true, fit: true }),
        getSettings: () => this.plugin.settings,
        getMindMapLocalConfig: () => ({ ...this.plugin.settings.mindMapLocalConfig, isDark: this.plugin._getObIsDark() }),
        isActive: () => this.app.workspace.activeLeaf === this.leaf
      })
      this.previewApp.$bus.$on('closePreviewMode', () => this.leaf.detach())
    } catch (error) {
      if (!this.closed && generation === this.generation) new Notice(`导图预览失败：${error.message}`)
    }
  }

  async onClose() {
    this.closed = true
    this.generation++
    this.clearPreview()
  }
}

export async function openMarkdownMapPreview(plugin, file, split = false) {
  const leaf = plugin.app.workspace.getLeaf(split ? 'split' : 'tab')
  await leaf.setViewState({ type: MARKDOWN_MAP_PREVIEW, state: { file: file.path }, active: true })
  await plugin.app.workspace.revealLeaf(leaf)
  return leaf
}
