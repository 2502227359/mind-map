import {
  extendNodeDataKeys,
  normalizeNodeList,
  setNodeData,
  toBoolean
} from './NodeFeatureUtils'

// 节点描述和正文隐藏插件。描述由节点核心渲染在正文下方。
class NodeDescription {
  constructor({ mindMap } = {}) {
    this.mindMap = mindMap
    this.nodeDataName = 'desc'
    extendNodeDataKeys(mindMap, ['desc', 'descStyle', 'hideText'])
    this.bindEvent()
  }

  bindEvent() {
    this.setDesc = this.setDesc.bind(this)
    this.setHideText = this.setHideText.bind(this)
    this.mindMap.command.add('SET_NODE_DESC', this.setDesc)
    this.mindMap.command.add('SET_NODE_HIDE_TEXT', this.setHideText)
  }

  unBindEvent() {
    this.mindMap.command.remove('SET_NODE_DESC', this.setDesc)
    this.mindMap.command.remove('SET_NODE_HIDE_TEXT', this.setHideText)
  }

  setDesc(nodes, text, style) {
    if (this.mindMap.opt.readonly) return
    const nodeList = normalizeNodeList(nodes, this.mindMap)
    const value = text == null ? '' : String(text)
    const nextStyle =
      style && typeof style === 'object' ? { ...style } : undefined
    nodeList.forEach(node => {
      const data = { desc: value }
      if (nextStyle) {
        data.descStyle = {
          ...(node.getData('descStyle') || {}),
          ...nextStyle
        }
      }
      setNodeData(this.mindMap, node, data)
    })
    if (nodeList.length > 0) this.mindMap.render()
  }

  setHideText(nodes, value) {
    if (this.mindMap.opt.readonly) return
    const nodeList = normalizeNodeList(nodes, this.mindMap)
    nodeList.forEach(node => {
      setNodeData(this.mindMap, node, { hideText: toBoolean(value) })
    })
    if (nodeList.length > 0) this.mindMap.render()
  }

  beforePluginRemove() {
    this.unBindEvent()
  }

  beforePluginDestroy() {
    this.unBindEvent()
  }
}

NodeDescription.instanceName = 'nodeDescription'

export default NodeDescription
