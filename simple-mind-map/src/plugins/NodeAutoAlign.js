// 同级节点宽度自动对齐插件

const ALIGN_COMMAND = 'TO_SAME_LAYERINDEX_NODE_ALIGN'
const REMOVE_COMMAND = 'REMOVE_SAME_LAYERINDEX_NODE_ALIGN'
const AUTO_WIDTH_KEY = 'autoAlignWidth'
const MODIFY_COMMANDS = new Set([
  'SET_NODE_DATA',
  'SET_NODE_TEXT',
  'SET_NODE_STYLE',
  'SET_NODE_STYLES',
  'SET_NODE_IMAGE',
  'SET_NODE_ICON',
  'SET_NODE_HYPERLINK',
  'SET_NODE_NOTE',
  'SET_NODE_ATTACHMENT',
  'SET_NODE_TAG',
  'INSERT_NODE',
  'INSERT_MULTI_NODE',
  'INSERT_CHILD_NODE',
  'INSERT_MULTI_CHILD_NODE',
  'INSERT_PARENT_NODE',
  'PASTE_NODE',
  'REMOVE_NODE',
  'REMOVE_CURRENT_NODE',
  'MOVE_NODE_TO',
  'INSERT_AFTER',
  'INSERT_BEFORE'
])

const getNodeData = node =>
  node && typeof node.getData === 'function' ? node.getData() : node && node.data

const getChildren = node => (Array.isArray(node && node.children) ? node.children : [])

export const collectByLayer = root => {
  const groups = new Map()
  const visit = (node, layerIndex = 0, path = '0') => {
    if (!node) return
    const data = getNodeData(node)
    if (data) {
      const layer = node.layerIndex === undefined ? layerIndex : node.layerIndex
      const list = groups.get(layer) || []
      list.push({ node, data, key: data.uid || path })
      groups.set(layer, list)
    }
    getChildren(node).forEach((child, index) => {
      visit(child, layerIndex + 1, `${path}.${index}`)
    })
  }
  visit(root)
  return groups
}

const getTreeRoots = mindMap => {
  const renderer = mindMap.renderer || {}
  if (typeof renderer.getAllRenderTree === 'function') {
    const trees = renderer.getAllRenderTree()
    if (Array.isArray(trees) && trees.length) return trees
  }
  if (renderer.renderTree) return [renderer.renderTree]
  if (typeof renderer.getAllRenderRoot === 'function') {
    const roots = renderer.getAllRenderRoot()
    if (Array.isArray(roots) && roots.length) return roots
  }
  return renderer.root ? [renderer.root] : []
}

class NodeAutoAlign {
  constructor({ mindMap, pluginOpt = {} }) {
    this.mindMap = mindMap
    mindMap.constructor.extendNodeDataNoStylePropList?.([AUTO_WIDTH_KEY])
    this.pluginOpt = pluginOpt
    this.defaultNodeWidth = Number(pluginOpt.defaultNodeWidth) || 200
    this.minNodeWidth = Math.max(Number(pluginOpt.minNodeWidth) || 50, 1)
    this.enabled = pluginOpt.enabled !== false
    this.auto = !!mindMap.opt.enableAutoNodeAlign
    this.autoWidths = new Map()
    this.isApplying = false
    this.onConfig = opt => {
      this.auto = !!opt.enableAutoNodeAlign
      if (this.auto) this.handleDataOnInit()
    }
    mindMap.on('after_update_config', this.onConfig)
    this.bindEvent()
    this.handleDataOnInit()
  }

  bindEvent() {
    this.onBeforeSetData = this.onBeforeSetData.bind(this)
    this.onAfterExecCommand = this.onAfterExecCommand.bind(this)
    this.onManualWidthChange = this.onManualWidthChange.bind(this)
    this.toAlign = this.toAlign.bind(this)
    this.removeAlignment = this.removeAlignment.bind(this)
    this.mindMap.on('before_set_data', this.onBeforeSetData)
    this.mindMap.on('afterExecCommand', this.onAfterExecCommand)
    this.mindMap.on('dragModifyNodeWidthEnd', this.onManualWidthChange)
    this.mindMap.command.add(ALIGN_COMMAND, this.toAlign)
    this.mindMap.command.add(REMOVE_COMMAND, this.removeAlignment)
    const shortcut = this.mindMap.opt.shortcutKeysMap
      ? this.mindMap.opt.shortcutKeysMap.sameLayerIndexNodeAlign
      : null
    if (
      shortcut &&
      this.mindMap.opt.enableDefaultShortcutKeys !== false &&
      this.mindMap.keyCommand
    ) {
      this.mindMap.keyCommand.addShortcut(shortcut, () =>
        this.mindMap.execCommand(ALIGN_COMMAND)
      )
      this.shortcut = shortcut
    }
  }

  unBindEvent() {
    this.mindMap.off('after_update_config', this.onConfig)
    this.mindMap.off('before_set_data', this.onBeforeSetData)
    this.mindMap.off('afterExecCommand', this.onAfterExecCommand)
    this.mindMap.off('dragModifyNodeWidthEnd', this.onManualWidthChange)
    this.mindMap.command.remove(ALIGN_COMMAND, this.toAlign)
    this.mindMap.command.remove(REMOVE_COMMAND, this.removeAlignment)
    if (this.shortcut && this.mindMap.keyCommand) {
      this.mindMap.keyCommand.removeShortcut(this.shortcut)
    }
  }

  handleDataOnInit() {
    if (!this.enabled || !this.auto || this.mindMap.opt.readonly) return
    getTreeRoots(this.mindMap).forEach(root => this.alignRoot(root, false))
  }

  onBeforeSetData(data) {
    if (
      !this.enabled ||
      !this.auto ||
      this.mindMap.opt.readonly ||
      this.isApplying
    )
      return
    this.alignRoot(data, false)
  }

  onAfterExecCommand(commandName, ...args) {
    this.clearManualWidthMarker(commandName, ...args)
    if (
      !this.enabled ||
      !this.auto ||
      this.mindMap.opt.readonly ||
      this.isApplying ||
      !MODIFY_COMMANDS.has(commandName)
    ) {
      return
    }
    const changed = getTreeRoots(this.mindMap).map(root =>
      this.alignRoot(root, false)
    ).some(Boolean)
    if (changed) {
      this.isApplying = true
      try {
        this.mindMap.render()
      } finally {
        this.isApplying = false
      }
    }
  }

  onManualWidthChange(node) {
    const data = getNodeData(node)
    if (!data) return
    delete data[AUTO_WIDTH_KEY]
    if (data.uid) this.autoWidths.delete(data.uid)
  }

  clearManualWidthMarker(commandName, node, data) {
    if (
      commandName !== 'SET_NODE_DATA' ||
      !data ||
      !Object.prototype.hasOwnProperty.call(data, 'customTextWidth')
    ) {
      return
    }
    const nodeData = getNodeData(node)
    if (!nodeData) return
    delete nodeData[AUTO_WIDTH_KEY]
    if (nodeData.uid) this.autoWidths.delete(nodeData.uid)
  }

  getInitialWidth() {
    return (
      Number(this.mindMap.opt.nodeInitialAutoAlignWidth) || this.defaultNodeWidth
    )
  }

  getIconSize(name) {
    const config = this.mindMap.opt[name]
    const size = config && config.style && config.style.size
    return Number(size) || Number(this.mindMap.themeConfig.iconSize) || 20
  }

  getNodeOtherContentWidth(data) {
    const margin = Number(this.mindMap.opt.textContentMargin) || 0
    const iconSize = Number(this.mindMap.themeConfig.iconSize) || 20
    let width = 0
    if (Array.isArray(data.icon) && data.icon.length) {
      width += data.icon.length * iconSize + (data.icon.length - 1) * margin
    }
    ;['hyperlink', 'note', 'attachmentUrl'].forEach((key, index) => {
      if (!data[key]) return
      const name = ['hyperlinkIcon', 'noteIcon', 'attachmentIcon'][index]
      width += this.getIconSize(name) + margin
    })
    if (data.nodeLink && this.mindMap.nodeLink && this.mindMap.nodeLink.pluginOpt) {
      width += Number(this.mindMap.nodeLink.pluginOpt.width) || 0
    }
    return width
  }

  isManualWidth(item) {
    const width = Number(item.data.customTextWidth)
    const autoWidth = Number(item.data[AUTO_WIDTH_KEY])
    if (!Number.isFinite(width)) {
      delete item.data[AUTO_WIDTH_KEY]
      return false
    }
    if (Number.isFinite(autoWidth)) {
      if (autoWidth === width) return false
      delete item.data[AUTO_WIDTH_KEY]
      this.autoWidths.delete(item.key)
      return true
    }
    return this.autoWidths.get(item.key) !== width
  }

  alignRoot(root, force) {
    const groups = collectByLayer(root)
    let changed = false
    groups.forEach(items => {
      if (items.length <= 1) return
      const manual = items
        .filter(item => force || this.isManualWidth(item))
        .map(item => Number(item.data.customTextWidth))
        .filter(Number.isFinite)
      const target = Math.max(
        this.getInitialWidth(),
        manual.length ? Math.max(...manual) : 0
      )
      items.forEach(item => {
        if (this.isManualWidth(item)) return
        const desired = Math.max(
          this.minNodeWidth,
          Math.round(target - this.getNodeOtherContentWidth(item.data))
        )
        if (Number(item.data.customTextWidth) !== desired) {
          item.data.customTextWidth = desired
          changed = true
        }
        item.data[AUTO_WIDTH_KEY] = desired
        this.autoWidths.set(item.key, desired)
      })
    })
    return changed
  }

  toAlign() {
    if (!this.enabled || this.mindMap.opt.readonly) return
    const changed = getTreeRoots(this.mindMap)
      .map(root => this.alignRoot(root, true))
      .some(Boolean)
    if (changed) this.mindMap.render()
  }

  removeAlignment() {
    if (this.mindMap.opt.readonly) return
    const removeFromRoot = root => {
      let changed = false
      const visit = node => {
        if (!node) return
        const data = getNodeData(node)
        const key = data && (data.uid || null)
        const width = Number(data && data.customTextWidth)
        const markedWidth = Number(data && data[AUTO_WIDTH_KEY])
        const mappedWidth = Number(key && this.autoWidths.get(key))
        const isAutoWidth =
          Number.isFinite(width) &&
          ((Number.isFinite(markedWidth) && markedWidth === width) ||
            (Number.isFinite(mappedWidth) && mappedWidth === width))
        if (isAutoWidth) {
          delete data.customTextWidth
          delete data[AUTO_WIDTH_KEY]
          if (key) this.autoWidths.delete(key)
          changed = true
        } else if (data && Object.prototype.hasOwnProperty.call(data, AUTO_WIDTH_KEY)) {
          delete data[AUTO_WIDTH_KEY]
          changed = true
        }
        getChildren(node).forEach(visit)
      }
      visit(root)
      return changed
    }
    const changed = getTreeRoots(this.mindMap)
      .map(removeFromRoot)
      .some(Boolean)
    if (changed) this.mindMap.render()
  }

  setEnabled(enabled) {
    this.enabled = !!enabled
  }

  setAuto(auto) {
    this.auto = !!auto
  }

  beforePluginRemove() {
    this.unBindEvent()
  }

  beforePluginDestroy() {
    this.unBindEvent()
  }
}

NodeAutoAlign.instanceName = 'nodeAutoAlign'

export default NodeAutoAlign
