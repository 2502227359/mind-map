import {
  extendNodeDataKeys,
  getNodeColor,
  normalizeNodeList,
  setNodeData
} from './NodeFeatureUtils'

// 节点待办插件。数据结构与参考插件保持一致：{ done: boolean }。
class NodeTodo {
  constructor({ mindMap, pluginOpt } = {}) {
    this.mindMap = mindMap
    this.pluginOpt = {
      width: 20,
      height: 20,
      color: '#3f9cfc',
      colorIsFollowNode: true,
      ...pluginOpt
    }
    this.name = 'checkbox'
    this.nodeDataName = 'checkbox'
    extendNodeDataKeys(mindMap, this.nodeDataName)
    this.bindEvent()
  }

  bindEvent() {
    this.mindMap.nodeInnerPrefixList.unshift({
      name: this.name,
      createContent: node => this.createCheckboxContent(node)
    })
    this.setCheckbox = this.setCheckbox.bind(this)
    this.setChildrenTodo = this.setChildrenTodo.bind(this)
    this.mindMap.command.add('SET_CHECKBOX', this.setCheckbox)
    this.mindMap.command.add('SET_CHILDREN_TODO', this.setChildrenTodo)
  }

  unBindEvent() {
    const index = this.mindMap.nodeInnerPrefixList.findIndex(
      item => item.name === this.name
    )
    if (index !== -1) this.mindMap.nodeInnerPrefixList.splice(index, 1)
    this.mindMap.command.remove('SET_CHECKBOX', this.setCheckbox)
    this.mindMap.command.remove('SET_CHILDREN_TODO', this.setChildrenTodo)
  }

  setCheckbox(nodes, value) {
    if (this.mindMap.opt.readonly) return
    const nodeList = normalizeNodeList(nodes, this.mindMap)
    nodeList.forEach(node => this.updateNodeData(node, value))
    if (nodeList.length > 0) this.mindMap.render()
  }

  updateNodeData(node, value) {
    const next =
      value == null
        ? null
        : {
            ...(node.getData(this.nodeDataName) || {}),
            ...(typeof value === 'object' ? value : { done: value })
          }
    setNodeData(this.mindMap, node, { [this.nodeDataName]: next })
  }

  setChildrenTodo(nodes, action = 'add') {
    if (this.mindMap.opt.readonly) return
    const nodeList = normalizeNodeList(nodes, this.mindMap)
    let changed = false
    nodeList.forEach(node => {
      ;(node.children || []).forEach(child => {
        const current = child.getData(this.nodeDataName)
        if (action === 'add' && !current) {
          this.updateNodeData(child, { done: false })
          changed = true
        } else if (action === 'complete' && current && !current.done) {
          this.updateNodeData(child, { done: true })
          changed = true
        } else if (action === 'unComplete' && current && current.done) {
          this.updateNodeData(child, { done: false })
          changed = true
        } else if (action === 'delete' && current) {
          this.updateNodeData(child, null)
          changed = true
        }
      })
    })
    if (changed) this.mindMap.render()
  }

  createCheckboxContent(node) {
    const checkbox = node.getData(this.nodeDataName)
    if (!checkbox) return null
    const { SVG, Rect } = node.getSvgObjects()
    const { width, height } = this.pluginOpt
    const color = this.pluginOpt.colorIsFollowNode
      ? getNodeColor(node, this.pluginOpt.color)
      : this.pluginOpt.color
    const wrapper = new SVG()
      .size(width, height)
      .attr('cursor', 'pointer')
      .addClass('smm-node-checkbox')
    wrapper.add(new Rect().size(width, height).fill({ color: 'transparent' }))
    const box = new Rect()
      .size(Math.max(12, width - 2), Math.max(12, height - 2))
      .move(1, 1)
      .radius(3)
      .stroke({ color, width: 1.5 })
      .fill({ color: checkbox.done ? color : 'transparent' })
    wrapper.add(box)
    if (checkbox.done) {
      const check = SVG(
        '<path d="M4 10l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      )
        .size(width, height)
        .attr('color', '#fff')
      wrapper.add(check)
    }
    wrapper.on('click', event => {
      event.stopPropagation()
      if (this.mindMap.opt.readonly) return
      this.updateNodeData(node, { done: !checkbox.done })
      this.mindMap.render()
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

NodeTodo.instanceName = 'checkbox'

export default NodeTodo
