import { initPreviewModeApp } from '../src/main'
import { getMindMapLocalConfig } from '../../src/editor-settings.js'
import { Notice } from 'obsidian'

export class PreviewMindMap {
  constructor({ plugin, file, onClose }) {
    this.app = plugin.app
    this.plugin = plugin
    this.file = file
    this.onClose = onClose
    this.closed = false
    this.plugin._markdownOverlays.add(this)

    this.previewModeApp = null
    this.container = document.createElement('div')
    this.wrap = document.createElement('div')
    this.container.appendChild(this.wrap)
    this.container.classList.add('smm-preview-md-to-mindmap-container')
    document.body.appendChild(this.container)
    this._renderView().catch(error => {
      if (this.closed) return
      this._close()
      new Notice(`思维导图预览失败：${error.message}`)
    })
  }

  async _renderView() {
    const content = await this.app.vault.read(this.file)
    const mindMapData = await this.plugin._mdToMindmapData(content)
    if (this.closed) return
    this.previewModeApp = initPreviewModeApp(this.wrap, {
      getInitMindMapData: () => {
        return mindMapData
      },
      getMindMapOptions: () => {
        return {
          readonly: true,
          fit: true
        }
      },
      getFile: () => {
        return this.file
      },
      getSettings: () => {
        return this.plugin.settings || {}
      },
      getMindMapLocalConfig: () => {
        return getMindMapLocalConfig(this.plugin.settings, this.plugin._getObIsDark())
      }
    })
    this.previewModeApp.$bus.$on('closePreviewMode', this._close.bind(this))
  }

  _close() {
    if (this.closed) return
    this.closed = true
    this.plugin._markdownOverlays.delete(this)
    this.previewModeApp?.$destroy()
    this.container?.remove()
    this.previewModeApp = null
    this.container = null
    this.wrap = null
    this.onClose?.()
  }
}
