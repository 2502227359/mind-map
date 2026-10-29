// 手绘风格插件，使用 roughjs 生成节点和连线的草绘路径。
import rough from 'roughjs/bin/rough'

const DEFAULT_STYLE = {
  fill: 'inherit',
  fillStyle: 'solid',
  stroke: 'inherit',
  strokeWidth: 'inherit'
}

class HandDrawnLikeStyle {
  constructor({ mindMap, pluginOpt = {} }) {
    this.mindMap = mindMap
    this.roughSvg = rough.svg(this.mindMap.svg.node)
    this.style = { ...DEFAULT_STYLE, ...(pluginOpt.style || {}) }
    this.originConfig = {
      customCreateNodePath: mindMap.opt.customCreateNodePath,
      customCreateNodePolygon: mindMap.opt.customCreateNodePolygon,
      customTransformNodeLinePath: mindMap.opt.customTransformNodeLinePath
    }
    this.enabled = false
    this.createPath = this.createPath.bind(this)
    this.createPolygon = this.createPolygon.bind(this)
    this.transformPath = this.transformPath.bind(this)
    this.syncTheme = this.syncTheme.bind(this)
    this.mindMap.on('node_tree_render_start', this.syncTheme)
    this.syncTheme()
  }

  syncTheme() {
    const config = this.mindMap.themeConfig.handDrawnLikeStyle || {}
    this.style = { ...DEFAULT_STYLE, roughness: config.roughness ?? 1.5, seed: 1 }
    const enabled = !!config.enabled
    if (enabled === this.enabled) return
    this.setEnabled(enabled)
  }

  install() {
    this.mindMap.updateConfig({
      customCreateNodePath: this.createPath,
      customCreateNodePolygon: this.createPolygon,
      customTransformNodeLinePath: this.transformPath
    })
  }

  getStyle() {
    return { ...this.style }
  }

  createPath(path) {
    return this.roughSvg.path(path, this.getStyle())
  }

  createPolygon(points) {
    return this.roughSvg.polygon(points, this.getStyle())
  }

  transformPath(path) {
    const group = this.roughSvg.path(path, this.getStyle())
    const paths = group && group.getElementsByTagName
      ? group.getElementsByTagName('path')
      : []
    return paths.length ? paths[0].getAttribute('d') : path
  }

  updateStyle(style = {}) {
    this.style = { ...this.style, ...style }
    if (this.enabled) this.mindMap.reRender()
  }

  reset() {
    this.mindMap.updateConfig({ ...this.originConfig })
  }

  setEnabled(enabled) {
    this.enabled = !!enabled
    if (this.enabled) this.install()
    else this.reset()
  }

  cleanup(shouldRender) {
    const wasEnabled = this.enabled
    this.mindMap.off('node_tree_render_start', this.syncTheme)
    this.enabled = false
    this.reset()
    // 移除插件不会自动重绘；否则当前画布仍会保留 roughjs 生成的路径。
    if (shouldRender && wasEnabled && typeof this.mindMap.reRender === 'function') {
      this.mindMap.reRender()
    }
  }

  beforePluginRemove() {
    this.cleanup(true)
  }

  beforePluginDestroy() {
    this.cleanup(false)
  }
}

HandDrawnLikeStyle.instanceName = 'handDrawnLikeStyle'

export default HandDrawnLikeStyle
