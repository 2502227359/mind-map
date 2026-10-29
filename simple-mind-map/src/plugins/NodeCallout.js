import { G, Path, Text } from '@svgdotjs/svg.js'
import {
  extendNodeDataKeys,
  normalizeNodeList,
  setNodeData
} from './NodeFeatureUtils'
import { transformInnerElsPosition } from '../utils'

const defaultStyle = {
  paddingX: 10,
  paddingY: 5,
  radius: 5,
  strokeWidth: 1,
  strokeColor: '#0984e3',
  strokeDasharray: 'none',
  fill: 'rgba(9,132,227,0.05)',
  fontSize: 14,
  fontFamily: '',
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#0984e3',
  lineHeight: 1.2,
  maxWidth: 260
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
    this.activeChatDialogEl = null
    this.dragState = null
    this.inlineEditor = null
    this.inlineEditorNode = null
    this.inlineEditorTarget = null
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
    this.updateChatDialog = this.updateChatDialog.bind(this)
    this.removeActiveChatDialog = this.removeActiveChatDialog.bind(this)
    this.onDrawClick = this.onDrawClick.bind(this)
    this.onKeydown = this.onKeydown.bind(this)
    this.onMousemove = this.onMousemove.bind(this)
    this.onMouseup = this.onMouseup.bind(this)
    this.onScale = this.onScale.bind(this)
    this.mindMap.on('node_tree_render_end', this.renderChatDialogs)
    this.mindMap.on('draw_click', this.onDrawClick)
    this.mindMap.on('node_click', this.onDrawClick)
    this.mindMap.on('scale', this.onScale)
    this.mindMap.command.add('ADD_CHAT_DIALOG', this.addChatDialog)
    this.mindMap.command.add('UPDATE_CHAT_DIALOG', this.updateChatDialog)
    this.mindMap.command.add('REMOVE_CHAT_DIALOG', this.removeActiveChatDialog)
    window.addEventListener('keydown', this.onKeydown, true)
    window.addEventListener('mousemove', this.onMousemove)
    window.addEventListener('mouseup', this.onMouseup)
  }

  unBindEvent() {
    this.mindMap.off('node_tree_render_end', this.renderChatDialogs)
    this.mindMap.off('draw_click', this.onDrawClick)
    this.mindMap.off('node_click', this.onDrawClick)
    this.mindMap.off('scale', this.onScale)
    this.mindMap.command.remove('ADD_CHAT_DIALOG', this.addChatDialog)
    this.mindMap.command.remove('UPDATE_CHAT_DIALOG', this.updateChatDialog)
    this.mindMap.command.remove(
      'REMOVE_CHAT_DIALOG',
      this.removeActiveChatDialog
    )
    window.removeEventListener('keydown', this.onKeydown, true)
    window.removeEventListener('mousemove', this.onMousemove)
    window.removeEventListener('mouseup', this.onMouseup)
    this.dragState = null
    this.hideInlineEditor(false)
    this.emitDeactivate()
    this.activeChatDialog = null
    this.activeChatDialogEl = null
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

  updateChatDialog(nodes, config = {}) {
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
    return this.activeChatDialog
      ? { node: this.activeChatDialog, el: this.activeChatDialogEl }
      : null
  }

  clearActiveChatDialog() {
    this.emitDeactivate()
    this.activeChatDialog = null
    this.activeChatDialogEl = null
  }

  emitDeactivate() {
    if (!this.activeChatDialog) return
    this.mindMap.emit('chat_dialog_deactivate', this.activeChatDialogEl, {
      node: this.activeChatDialog,
      el: this.activeChatDialogEl
    })
    this.setChatDialogActiveState(this.activeChatDialogEl, false)
  }

  setChatDialogActiveState(group, active) {
    if (!group) return
    if (active) {
      group.addClass('active')
    } else {
      group.removeClass('active')
    }
    const bubble = group._chatDialogBubble
    if (bubble) {
      const width = Number(group._chatDialogStrokeWidth) || 0
      bubble.stroke({ width: active ? width + 1 : width })
    }
  }

  setActiveChatDialog(node, group, event) {
    if (!this.mindMap.opt.readonly) this.mindMap.renderer.clearActiveNodeList()
    if (this.activeChatDialogEl && this.activeChatDialogEl !== group) {
      this.setChatDialogActiveState(this.activeChatDialogEl, false)
    }
    this.activeChatDialog = node
    this.activeChatDialogEl = group
    this.setChatDialogActiveState(group, true)
    this.mindMap.emit('chat_dialog_active', event, {
      node,
      el: group
    })
  }

  updateActiveChatDialog(config = {}) {
    if (!this.activeChatDialog || this.mindMap.opt.readonly) return
    this.updateNodeData(this.activeChatDialog, config)
    this.mindMap.render()
  }

  onDrawClick() {
    if (this.dragState) return
    this.clearActiveChatDialog()
  }

  isEditableTarget(target) {
    if (!target || typeof target.closest !== 'function') return false
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
  }

  onKeydown(event) {
    if (
      !this.activeChatDialog ||
      this.mindMap.opt.readonly ||
      (this.mindMap.opt.customCheckEnableShortcut && !this.mindMap.opt.customCheckEnableShortcut(event)) ||
      this.isEditableTarget(event.target) ||
      (event.key !== 'Delete' && event.key !== 'Backspace')
    ) {
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    this.removeActiveChatDialog([this.activeChatDialog])
  }

  getCanvasPoint(event) {
    const { x, y } = this.mindMap.toPos(event.clientX, event.clientY)
    const transform = this.mindMap.draw.transform()
    const scaleX = Number(transform.scaleX) || 1
    const scaleY = Number(transform.scaleY) || 1
    return {
      x: (x - (Number(transform.translateX) || 0)) / scaleX,
      y: (y - (Number(transform.translateY) || 0)) / scaleY
    }
  }

  onMousemove(event) {
    const drag = this.dragState
    if (!drag) return
    const point = this.getCanvasPoint(event)
    const dx = point.x - drag.startX
    const dy = point.y - drag.startY
    drag.group.translate(dx - drag.lastDX, dy - drag.lastDY)
    drag.lastDX = dx
    drag.lastDY = dy
    drag.moved = drag.moved || Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5
    event.preventDefault()
  }

  onMouseup() {
    const drag = this.dragState
    if (!drag) return
    this.dragState = null
    if (!drag.moved || this.mindMap.opt.readonly) return
    this.updateNodeData(drag.node, {
      offsetX: drag.offsetX + drag.lastDX,
      offsetY: drag.offsetY + drag.lastDY
    })
    this.mindMap.render()
  }

  onScale() {
    if (this.inlineEditor) this.hideInlineEditor(true)
  }

  beginChatDialogDrag(node, group, event) {
    if (
      this.mindMap.opt.readonly ||
      (event.which !== undefined && event.which !== 1)
    ) {
      return
    }
    const point = this.getCanvasPoint(event)
    const data = this.getNodeData(node)
    this.dragState = {
      node,
      group,
      startX: point.x,
      startY: point.y,
      offsetX: Number(data.offsetX) || 0,
      offsetY: Number(data.offsetY) || 0,
      lastDX: 0,
      lastDY: 0,
      moved: false
    }
  }

  openInlineEditor(node, group) {
    if (this.mindMap.opt.readonly) return
    this.mindMap.renderer.textEdit.hideEditTextBox()
    this.hideInlineEditor(true)
    const target = this.mindMap.opt.customInnerElsAppendTo || document.body
    const editor = this.createInlineEditor(node, group, target)
    this.bindInlineEditor(editor)
    target.appendChild(editor)
    this.inlineEditor = editor
    this.inlineEditorNode = node
    this.inlineEditorTarget = target
    editor.focus()
    this.mindMap.keyCommand.stopCheckInSvg()
  }

  createInlineEditor(node, group, target) {
    const editor = document.createElement('div')
    const rect = group.node.getBoundingClientRect()
    const position = transformInnerElsPosition(this.mindMap, rect.left, rect.top)
    const scale = Number(this.mindMap.view && this.mindMap.view.scale) || 1
    const style = this.getStyle(this.getNodeData(node))
    editor.className = 'smm-node-chat-dialog-edit'
    editor.setAttribute('contenteditable', 'true')
    editor.setAttribute('spellcheck', 'false')
    editor.style.cssText = `position:${target === document.body ? 'fixed' : 'absolute'};box-sizing:border-box;outline:none;word-break:break-word;white-space:pre-wrap;z-index:${this.mindMap.opt.nodeTextEditZIndex || 1000};`
    editor.style.left = `${position.left}px`
    editor.style.top = `${position.top}px`
    editor.style.minWidth = `${Math.max(80, rect.width)}px`
    editor.style.minHeight = `${Math.max(24, rect.height)}px`
    editor.style.padding = '3px 5px'
    editor.style.fontFamily = style.fontFamily || 'inherit'
    editor.style.fontSize = `${Number(style.fontSize) * scale}px`
    editor.style.lineHeight = String(style.lineHeight)
    editor.style.color = style.color
    editor.style.background = style.fill
    editor.textContent = this.getText(node)
    return editor
  }

  bindInlineEditor(editor) {
    editor.addEventListener('mousedown', event => event.stopPropagation())
    editor.addEventListener('click', event => event.stopPropagation())
    editor.addEventListener('keyup', event => event.stopPropagation())
    editor.addEventListener('keydown', event => {
      event.stopPropagation()
      if (event.key === 'Escape') {
        event.preventDefault()
        this.hideInlineEditor(false)
      } else if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        this.hideInlineEditor(true)
      }
    })
    editor.addEventListener('blur', () => this.hideInlineEditor(true))
  }

  hideInlineEditor(save = true) {
    if (!this.inlineEditor) return
    const editor = this.inlineEditor
    const node = this.inlineEditorNode
    const target = this.inlineEditorTarget
    this.inlineEditor = null
    this.inlineEditorNode = null
    this.inlineEditorTarget = null
    if (save && node && !this.mindMap.opt.readonly) {
      const text = editor.textContent || ''
      this.updateNodeData(node, { text })
      this.mindMap.render()
    }
    if (target && target.contains(editor)) target.removeChild(editor)
    this.mindMap.keyCommand.recoveryCheckInSvg()
  }

  getStyle(data = {}) {
    const style = { ...this.pluginOpt, ...data }
    style.paddingX = Math.max(0, Number(style.paddingX) || 0)
    style.paddingY = Math.max(0, Number(style.paddingY) || 0)
    style.radius = Math.max(0, Number(style.radius) || 0)
    style.strokeWidth = Math.max(0, Number(style.strokeWidth) || 0)
    style.fontSize = Math.max(1, Number(style.fontSize) || defaultStyle.fontSize)
    style.lineHeight = Math.max(0.1, Number(style.lineHeight) || defaultStyle.lineHeight)
    style.maxWidth = Math.max(1, Number(style.maxWidth) || defaultStyle.maxWidth)
    return style
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
    if (this.inlineEditorNode && targets.includes(this.inlineEditorNode)) {
      this.hideInlineEditor(false)
    }
    const activeRemoved =
      this.activeChatDialog && targets.includes(this.activeChatDialog)
    if (activeRemoved) {
      this.emitDeactivate()
      this.activeChatDialog = null
      this.activeChatDialogEl = null
    }
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
    const style = this.getStyle(data)
    const text = String(this.getText(node) || data.content || '').trim()
    if (!text) return null
    const maxWidth = style.maxWidth
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
    group._chatDialogBubble = null
    group._chatDialogStrokeWidth = style.strokeWidth
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
    group._chatDialogBubble = bubble
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
    group.on('mousedown', event => {
      event.stopPropagation()
      event.preventDefault()
      this.setActiveChatDialog(node, group, event)
      this.beginChatDialogDrag(node, group, event)
    })
    group.on('click', event => {
      event.stopPropagation()
      this.setActiveChatDialog(node, group, event)
      this.mindMap.emit('chat_dialog_click', event, { el: group, node })
    })
    group.on('dblclick', event => {
      event.stopPropagation()
      this.setActiveChatDialog(node, group, event)
      this.openInlineEditor(node, group)
      this.mindMap.emit('chat_dialog_dblclick', event, node)
    })
    group.on('contextmenu', event => {
      event.stopPropagation()
      event.preventDefault()
      this.setActiveChatDialog(node, group, event)
      this.mindMap.emit('chat_dialog_contextmenu', event, { el: group, node })
    })
    return group
  }

  renderChatDialogs() {
    if (!this.draw || this.mindMap._isDestroyed) return
    // setData/reRender 会清空 nodeDraw，插件自有图层也需要重新挂载。
    if (!this.mindMap.nodeDraw.has(this.draw)) this.mindMap.nodeDraw.add(this.draw)
    const activeNode = this.activeChatDialog
    this.activeChatDialogEl = null
    this.draw.clear()
    this.getRoots().forEach(root => {
      this.walk(root, node => {
        const data = node.getData('chatDialog')
        if (!data || !node.group) return
        const group = this.createChatDialog(node, data)
        if (group) {
          this.draw.add(group)
          if (node === activeNode) {
            this.activeChatDialogEl = group
            this.setChatDialogActiveState(group, true)
          }
        }
      })
    })
    if (activeNode && !this.activeChatDialogEl) this.activeChatDialog = null
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
