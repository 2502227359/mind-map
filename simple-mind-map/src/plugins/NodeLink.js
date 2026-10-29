import {
  extendNodeDataKeys,
  getNodeColor,
  normalizeNodeList,
  setNodeData
} from './NodeFeatureUtils'

const defaultIcon =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 14.5l5-5M7 17H5a4 4 0 0 1 0-8h4M17 7h2a4 4 0 0 1 0 8h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'

// 节点跳转插件。nodeLink 保存目标节点 uid，点击图标后展开并定位目标。
class NodeLink {
  constructor({ mindMap, pluginOpt } = {}) {
    this.mindMap = mindMap
    this.pluginOpt = {
      width: 20,
      height: 20,
      color: '#3f9cfc',
      colorIsFollowNode: true,
      icon: defaultIcon,
      handleIconClick: null,
      ...pluginOpt
    }
    this.name = 'nodeLink'
    this.nodeDataName = 'nodeLink'
    extendNodeDataKeys(mindMap, this.nodeDataName)
    this.bindEvent()
  }

  bindEvent() {
    this.mindMap.nodeInnerPostfixList.push({
      name: this.name,
      createContent: node => this.createNodeLinkContent(node)
    })
    this.setNodeLink = this.setNodeLink.bind(this)
    this.mindMap.command.add('SET_NODE_LINK', this.setNodeLink)
  }

  unBindEvent() {
    const index = this.mindMap.nodeInnerPostfixList.findIndex(
      item => item.name === this.name
    )
    if (index !== -1) this.mindMap.nodeInnerPostfixList.splice(index, 1)
    this.mindMap.command.remove('SET_NODE_LINK', this.setNodeLink)
  }

  setNodeLink(nodes, targetUid, bidirectional = false) {
    if (this.mindMap.opt.readonly) return
    const nodeList = normalizeNodeList(nodes, this.mindMap)
    nodeList.forEach(node => {
      setNodeData(this.mindMap, node, {
        [this.nodeDataName]: targetUid || null
      })
      if (bidirectional && targetUid) {
        const target = this.findNode(targetUid)
        if (target) {
          setNodeData(this.mindMap, target, { [this.nodeDataName]: node.uid })
        } else {
          const targetData = this.findNodeData(targetUid)
          if (targetData && targetData.data) {
            targetData.data[this.nodeDataName] = node.uid
          }
        }
      }
    })
    if (nodeList.length > 0) this.mindMap.render()
  }

  checkTargetExist(uid) {
    return Boolean(uid && (this.findNode(uid) || this.findNodeData(uid)))
  }

  findNode(uid) {
    const renderer = this.mindMap.renderer
    return renderer && typeof renderer.findNodeByUid === 'function'
      ? renderer.findNodeByUid(uid)
      : null
  }

  findNodeData(uid) {
    const renderer = this.mindMap.renderer
    const trees =
      renderer && typeof renderer.getAllRenderTree === 'function'
        ? renderer.getAllRenderTree()
        : []
    const walk = tree => {
      if (!tree) return null
      if (tree.data && tree.data.uid === uid) return tree
      for (const child of tree.children || []) {
        const result = walk(child)
        if (result) return result
      }
      return null
    }
    for (const tree of trees) {
      const result = walk(tree)
      if (result) return result
    }
    return null
  }

  addToLinkNodeData(targetUid, sourceUid) {
    const target = this.findNode(targetUid)
    if (target && sourceUid) {
      setNodeData(this.mindMap, target, { [this.nodeDataName]: sourceUid })
    }
  }

  createNodeLinkContent(node) {
    if (!node.getData(this.nodeDataName)) return null
    const { SVG, Rect } = node.getSvgObjects()
    const { width, height } = this.pluginOpt
    const color = this.pluginOpt.colorIsFollowNode
      ? getNodeColor(node, this.pluginOpt.color)
      : this.pluginOpt.color
    const wrapper = new SVG()
      .size(width, height)
      .attr('cursor', 'pointer')
      .addClass('smm-node-node-link')
    wrapper.add(new Rect().size(width, height).fill({ color: 'transparent' }))
    const icon = SVG(this.pluginOpt.icon)
      .size(width, height)
      .attr('color', color)
    wrapper.add(icon)
    wrapper.on('click', event => {
      event.stopPropagation()
      const link = node.getData(this.nodeDataName)
      if (typeof this.pluginOpt.handleIconClick === 'function') {
        this.pluginOpt.handleIconClick({
          el: wrapper,
          node,
          e: event,
          nodeLinkInstance: this
        })
        return
      }
      if (this.checkTargetExist(link)) {
        this.mindMap.execCommand('GO_TARGET_NODE', link)
      } else this.mindMap.emit('node_link_not_find', node, link)
    })
    return { node: wrapper, width, height }
  }

  beforePluginRemove() {
    this.unBindEvent()
  }

  beforePluginDestroy() {
    this.unBindEvent()
  }
}

NodeLink.instanceName = 'nodeLink'

export default NodeLink
