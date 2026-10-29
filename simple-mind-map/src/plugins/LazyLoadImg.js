// 节点图片按可视区域加载插件

const EMPTY_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const getImageUrl = node => {
  if (!node) return ''
  if (node._smmImageUrl) return node._smmImageUrl
  if (typeof node.getImageUrl === 'function') return node.getImageUrl() || ''
  return typeof node.getData === 'function' ? node.getData('image') || '' : ''
}

const walkNodes = (root, callback) => {
  if (!root) return
  callback(root)
  if (Array.isArray(root.children)) root.children.forEach(child => walkNodes(child, callback))
}

class LazyLoadImg {
  constructor({ mindMap, pluginOpt = {} }) {
    this.mindMap = mindMap
    this.padding = Number(pluginOpt.padding) || 0
    this.enabled =
      pluginOpt.enabled === undefined
        ? !!mindMap.opt.onlyLoadClientRectImg
        : !!pluginOpt.enabled
    this.bound = false
    this.updateTimer = null
    this.onConfigUpdate = this.onConfigUpdate.bind(this)
    this.scheduleUpdate = this.scheduleUpdate.bind(this)
    this.handleBeforeGetSvgData = this.handleBeforeGetSvgData.bind(this)
    this.handleAfterGetSvgData = this.handleAfterGetSvgData.bind(this)
    this.mindMap.on('after_update_config', this.onConfigUpdate)
    if (this.enabled) this.bindEvent()
  }

  getRoots() {
    const renderer = this.mindMap.renderer || {}
    if (typeof renderer.getAllRenderRoot === 'function') {
      const roots = renderer.getAllRenderRoot()
      if (Array.isArray(roots) && roots.length) return roots
    }
    if (renderer.root) return [renderer.root]
    return renderer.renderTree ? [renderer.renderTree] : []
  }

  bindEvent() {
    if (this.bound) return
    this.bound = true
    this.mindMap.on('view_data_change', this.scheduleUpdate)
    this.mindMap.on('node_tree_render_end', this.scheduleUpdate)
    this.mindMap.on('before_get_svg_data', this.handleBeforeGetSvgData)
    this.mindMap.on('after_get_svg_data', this.handleAfterGetSvgData)
  }

  unBindEvent() {
    if (!this.bound) return
    this.bound = false
    this.mindMap.off('view_data_change', this.scheduleUpdate)
    this.mindMap.off('node_tree_render_end', this.scheduleUpdate)
    this.mindMap.off('before_get_svg_data', this.handleBeforeGetSvgData)
    this.mindMap.off('after_get_svg_data', this.handleAfterGetSvgData)
    if (this.updateTimer !== null) {
      clearTimeout(this.updateTimer)
      this.updateTimer = null
    }
  }

  onConfigUpdate(opt, lastOpt) {
    if (!lastOpt || opt.onlyLoadClientRectImg === lastOpt.onlyLoadClientRectImg) return
    this.setEnabled(!!opt.onlyLoadClientRectImg, false)
  }

  scheduleUpdate() {
    if (!this.enabled || this.updateTimer !== null) return
    this.updateTimer = setTimeout(() => {
      this.updateTimer = null
      this.updateImg()
    }, 0)
  }

  isInClient(node) {
    return (
      typeof node.checkIsInClient !== 'function' ||
      node.checkIsInClient(this.padding)
    )
  }

  loadNodeImg(node) {
    const imgData = node && node._imgData
    if (!imgData || !imgData.node || typeof imgData.node.load !== 'function') {
      return false
    }
    const shouldLoad = !this.enabled || this.isInClient(node)
    const url = getImageUrl(node)
    if (!url) return false
    const nextSrc = shouldLoad ? url : EMPTY_IMAGE
    if (node._lazyLoadImgSrc === nextSrc) return true
    node._lazyLoadImgSrc = nextSrc
    node._isLoadedImg = shouldLoad
    imgData.node.load(nextSrc)
    return true
  }

  updateImg() {
    if (!this.enabled) return
    this.getRoots().forEach(root => walkNodes(root, node => this.loadNodeImg(node)))
  }

  showAllImg() {
    this.getRoots().forEach(root =>
      walkNodes(root, node => {
        const imgData = node && node._imgData
        const url = getImageUrl(node)
        if (!imgData || !url || !imgData.node || typeof imgData.node.load !== 'function') {
          return
        }
        node._lazyLoadImgSrc = url
        node._isLoadedImg = true
        imgData.node.load(url)
      })
    )
  }

  handleBeforeGetSvgData() {
    if (this.enabled) this.showAllImg()
  }

  handleAfterGetSvgData() {
    if (this.enabled) this.scheduleUpdate()
  }

  setEnabled(enabled, updateConfig = true) {
    this.enabled = !!enabled
    if (updateConfig && this.mindMap.opt.onlyLoadClientRectImg !== this.enabled) {
      this.mindMap.updateConfig({ onlyLoadClientRectImg: this.enabled })
    }
    if (this.enabled) {
      this.bindEvent()
      this.scheduleUpdate()
    } else {
      this.unBindEvent()
      this.showAllImg()
    }
  }

  beforePluginRemove() {
    this.mindMap.off('after_update_config', this.onConfigUpdate)
    this.setEnabled(false, false)
  }

  beforePluginDestroy() {
    this.beforePluginRemove()
  }
}

LazyLoadImg.instanceName = 'lazyLoadImg'

export default LazyLoadImg
