import { G, Path, Text } from '@svgdotjs/svg.js'
import {
  extendNodeDataKeys,
  normalizeNodeList,
  setNodeData
} from './NodeFeatureUtils'

const defaultStyle = {
  paddingX: 10,
  paddingY: 5,
  radius: 5,
  strokeWidth: 1,
  strokeColor: '#0984e3',
  fill: 'rgba(9,132,227,0.05)',
  fontSize: 14,
  color: '#0984e3',
  lineHeight: 1.2
}

const escapePathNumber = value => (Number.isFinite(value) ? value : 0)

function createBubblePath(x, y, width, height, radius, tipX, tipY) {
  const right = x + width
  const bottom = y + height
  const safeRadius = Math.min(radius, width / 2, height / 2)
  const pointerX = Math.max(x + safeRadius, Math.min(right - safeRadius, tipX))
  return [
    `M ${escapePathNumber(x + safeRadius)} ${escapePathNumber(y)}`,
    `H ${escapePathNumber(right - safeRadius)}`,
    `Q ${escapePathNumber(right)} ${escapePathNumber(y)} ${escapePathNumber(
      right
    )} ${escapePathNumber(y + safeRadius)}`,
    `V ${escapePathNumber(bottom - safeRadius)}`,
    `Q ${escapePathNumber(right)} ${escapePathNumber(
      bottom
    )} ${escapePathNumber(right - safeRadius)} ${escapePathNumber(bottom)}`,
    `H ${escapePathNumber(pointerX + 8)}`,
    `L ${escapePathNumber(pointerX)} ${escapePathNumber(tipY)}`,
    `L ${escapePathNumber(pointerX - 8)} ${escapePathNumber(bottom)}`,
    `H ${escapePathNumber(x + safeRadius)}`,
    `Q ${escapePathNumber(x)} ${escapePathNumber(bottom)} ${escapePathNumber(
      x
    )} ${escapePathNumber(bottom - safeRadius)}`,
    `V ${escapePathNumber(y + safeRadius)}`,
    `Q ${escapePathNumber(x)} ${escapePathNumber(y)} ${escapePathNumber(
      x + safeRadius
    )} ${escapePathNumber(y)}`,
    'Z'
  ].join(' ')
}

// 节点气泡插件。数据保存在节点 chatDialog 字段，渲染在同一 SVG 画布内。
class NodeCallout {
  constructor({ mindMap, pluginOpt } = {}) {
    this.mindMap = mindMap
    this.pluginOpt = { ...defaultStyle, ...(pluginOpt || {}) }
    this.activeChatDialog = null
    extendNodeDataKeys(mindMap, 'chatDialog')
    this.draw = mindMap.nodeDraw
      .group()
      .addClass('smm-node-chat-dialog-container')
    this.draw.front()
    this.bindEvent()
  }

  bindEvent() {
    this.renderChatDialogs = this.renderChatDialogs.bind(this)
    this.addChatDialog = this.addChatDialog.bind(this)
    this.removeActiveChatDialog = this.removeActiveChatDialog.bind(this)
    this.mindMap.on('node_tree_render_end', this.renderChatDialogs)
    this.mindMap.command.add('ADD_CHAT_DIALOG', this.addChatDialog)
    this.mindMap.command.add('REMOVE_CHAT_DIALOG', this.removeActiveChatDialog)
  }

  unBindEvent() {
    this.mindMap.off('node_tree_render_end', this.renderChatDialogs)
    this.mindMap.command.remove('ADD_CHAT_DIALOG', this.addChatDialog)
    this.mindMap.command.remove(
      'REMOVE_CHAT_DIALOG',
      this.removeActiveChatDialog
    )
    this.activeChatDialog = null
    this.draw.remove()
  }

  addChatDialog(nodes, config = {}) {
    if (this.mindMap.opt.readonly) return
    const nodeList = normalizeNodeList(nodes, this.mindMap)
    const value = typeof config === 'string' ? { text: config } : { ...config }
    nodeList.forEach(node => {
      this.updateNodeData(node, value)
    })
    if (nodeList.length > 0) this.mindMap.render()
  }

  getNodeData(node) {
    return (node && node.getData('chatDialog')) || {}
  }

  getText(node) {
    return (
      this.getNodeData(node).text ||
      this.mindMap.opt.defaultChatDialogText ||
      ''
    )
  }

  updateNodeData(node, config) {
    if (!node) return null
    const value =
      config == null ? null : { ...this.getNodeData(node), ...config }
    setNodeData(this.mindMap, node, { chatDialog: value })
    return value
  }

  getActiveChatDialog() {
    return this.activeChatDialog ? { node: this.activeChatDialog } : null
  }

  clearActiveChatDialog() {
    this.activeChatDialog = null
  }

  updateActiveChatDialog(config = {}) {
    if (!this.activeChatDialog || this.mindMap.opt.readonly) return
    this.updateNodeData(this.activeChatDialog, config)
    this.mindMap.render()
  }

  removeActiveChatDialog(nodes) {
    if (this.mindMap.opt.readonly) return
    const nodeList = normalizeNodeList(nodes, this.mindMap)
    const targets = nodeList.length
      ? nodeList
      : this.activeChatDialog
      ? [this.activeChatDialog]
      : []
    if (targets.length === 0) return
    targets.forEach(node => {
      setNodeData(this.mindMap, node, { chatDialog: null })
    })
    this.activeChatDialog = null
    this.mindMap.render()
    this.mindMap.emit('chat_dialog_delete')
  }

  getRoots() {
    const renderer = this.mindMap.renderer
    if (renderer && typeof renderer.getAllRenderRoot === 'function') {
      return renderer.getAllRenderRoot()
    }
    return renderer && renderer.root ? [renderer.root] : []
  }

  walk(node, callback) {
    if (!node) return
    callback(node)
    ;(node.children || []).forEach(child => this.walk(child, callback))
  }

  getTextLines(text, maxWidth, fontSize) {
    const result = []
    String(text || '')
      .split(/\r?\n/g)
      .forEach(line => {
        const chars = Math.max(1, Math.floor(maxWidth / (fontSize * 0.65)))
        for (let index = 0; index < line.length; index += chars) {
          result.push(line.slice(index, index + chars) || '\uFEFF')
        }
      })
    return result.length > 0 ? result : ['\uFEFF']
  }

  createChatDialog(node, data) {
    const style = { ...this.pluginOpt, ...data }
    const text = String(this.getText(node) || data.content || '').trim()
    if (!text) return null
    const maxWidth = Number(style.maxWidth) > 0 ? Number(style.maxWidth) : 260
    const lines = this.getTextLines(text, maxWidth, style.fontSize)
    const lineHeight = style.fontSize * style.lineHeight
    const width = Math.min(
      maxWidth,
      Math.max(...lines.map(line => line.length * style.fontSize * 0.65)) +
        style.paddingX * 2
    )
    const height = lines.length * lineHeight + style.paddingY * 2
    const offsetX = Number(data.offsetX) || 0
    const offsetY = Number(data.offsetY) || 0
    const x = node.left + node.width / 2 - width / 2 + offsetX
    const y = node.top - height - 20 + offsetY
    const group = new G().addClass('smm-node-chat-dialog')
    const bubble = new Path()
      .plot(
        createBubblePath(
          x,
          y,
          width,
          height,
          style.radius,
          node.left + node.width / 2,
          node.top
        )
      )
      .fill({ color: style.fill })
      .stroke({
        color: style.strokeColor,
        width: style.strokeWidth,
        dasharray: style.strokeDasharray || 'none'
      })
    group.add(bubble)
    lines.forEach((line, index) => {
      const textNode = new Text().text(line)
      textNode
        .font({
          family: style.fontFamily,
          size: style.fontSize,
          weight: style.fontWeight,
          style: style.fontStyle
        })
        .fill(style.color)
        .x(x + style.paddingX)
        .y(y + style.paddingY + lineHeight * index)
      group.add(textNode)
    })
    group.on('click', event => {
      event.stopPropagation()
      this.activeChatDialog = node
      this.mindMap.emit('chat_dialog_click', event, { el: group, node })
    })
    group.on('dblclick', event => {
      event.stopPropagation()
      this.mindMap.emit('chat_dialog_dblclick', event, node)
    })
    return group
  }

  renderChatDialogs() {
    if (!this.draw || this.mindMap._isDestroyed) return
    // setData/reRender 会清空 nodeDraw，插件自有图层也需要重新挂载。
    if (!this.mindMap.nodeDraw.has(this.draw)) this.mindMap.nodeDraw.add(this.draw)
    this.draw.clear()
    this.getRoots().forEach(root => {
      this.walk(root, node => {
        const data = node.getData('chatDialog')
        if (!data || !node.group) return
        const group = this.createChatDialog(node, data)
        if (group) this.draw.add(group)
      })
    })
    this.draw.front()
  }

  beforePluginRemove() {
    this.unBindEvent()
  }

  beforePluginDestroy() {
    this.unBindEvent()
  }
}

NodeCallout.instanceName = 'chatDialog'
NodeCallout.defaultStyle = defaultStyle

export { createBubblePath }
export default NodeCallout
