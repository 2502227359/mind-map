import {
  extendNodeDataKeys,
  normalizeNodeList,
  readNumberType,
  setNodeData
} from './NodeFeatureUtils'
import { formatNumberStr } from './NodeNumbers'

export function formatParagraphNumber(number, type) {
  return formatNumberStr({
    num: number,
    type: readNumberType(type),
    parentNumberStr: ''
  })
}

// 节点内段落编号插件，兼容普通文本和富文本节点。
class NodeTextNumber {
  constructor({ mindMap, pluginOpt } = {}) {
    this.mindMap = mindMap
    this.pluginOpt = { margin: 6, ...pluginOpt }
    this.nodeDataName = 'nodeTextNumber'
    this.originalRichTextHandler = mindMap.opt.handleRichTextEl
    this.originalTextHandler = mindMap.opt.handleNodeText
    extendNodeDataKeys(mindMap, this.nodeDataName)
    this.bindEvent()
  }

  bindEvent() {
    this.setNumber = this.setNumber.bind(this)
    this.handleRichTextEl = this.handleRichTextEl.bind(this)
    this.handleNodeText = this.handleNodeText.bind(this)
    this.mindMap.command.add('SET_NODE_TEXT_NUMBER', this.setNumber)
    this.mindMap.opt.handleRichTextEl = this.handleRichTextEl
    this.mindMap.opt.handleNodeText = this.handleNodeText
  }

  unBindEvent() {
    this.mindMap.command.remove('SET_NODE_TEXT_NUMBER', this.setNumber)
    if (this.mindMap.opt.handleRichTextEl === this.handleRichTextEl) {
      this.mindMap.opt.handleRichTextEl = this.originalRichTextHandler
    }
    if (this.mindMap.opt.handleNodeText === this.handleNodeText) {
      this.mindMap.opt.handleNodeText = this.originalTextHandler
    }
  }

  setNumber(nodes, value) {
    if (this.mindMap.opt.readonly) return
    const nodeList = normalizeNodeList(nodes, this.mindMap)
    const numberType =
      value == null || value === '' ? '' : readNumberType(value)
    nodeList.forEach(node => {
      setNodeData(this.mindMap, node, { [this.nodeDataName]: numberType })
    })
    if (nodeList.length > 0) this.mindMap.render()
  }

  getType(node) {
    return readNumberType(node.getData(this.nodeDataName))
  }

  handleNodeText(node, text) {
    if (typeof this.originalTextHandler === 'function') {
      text = this.originalTextHandler(node, text)
    }
    if (!node.getData(this.nodeDataName)) return text
    return String(text || '')
      .split(/\r?\n/g)
      .map(
        (line, index) =>
          `${formatParagraphNumber(index + 1, this.getType(node))} ${line}`
      )
      .join('\n')
  }

  handleRichTextEl(node, element) {
    if (typeof this.originalRichTextHandler === 'function') {
      this.originalRichTextHandler(node, element)
    }
    if (!node.getData(this.nodeDataName) || !element || !element.children)
      return
    const type = this.getType(node)
    Array.from(element.children).forEach((child, index) => {
      if (child.tagName !== 'P') return
      const prefix = document.createElement('span')
      prefix.contentEditable = 'false'
      prefix.textContent = `${formatParagraphNumber(index + 1, type)} `
      prefix.style.marginRight = `${this.pluginOpt.margin}px`
      child.insertBefore(prefix, child.firstChild)
    })
  }

  beforePluginRemove() {
    this.unBindEvent()
  }

  beforePluginDestroy() {
    this.unBindEvent()
  }
}

NodeTextNumber.instanceName = 'nodeTextNumber'

export default NodeTextNumber
