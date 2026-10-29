import {
  extendNodeDataKeys,
  normalizeNodeList,
  readNumberType,
  setNodeData
} from './NodeFeatureUtils'

const alphabet = (value, upper) => {
  let result = ''
  let current = value
  while (current > 0) {
    const remainder = (current - 1) % 26
    result = String.fromCharCode((upper ? 65 : 97) + remainder) + result
    current = Math.floor((current - 1) / 26)
  }
  return result
}

const roman = (value, upper) => {
  const table = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I']
  ]
  let result = ''
  let current = value
  table.forEach(([unit, symbol]) => {
    while (current >= unit) {
      result += symbol
      current -= unit
    }
  })
  return upper ? result : result.toLowerCase()
}

const chinese = value => {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  const units = ['', '十', '百', '千', '万', '十', '百', '千', '亿']
  if (value === 0) return digits[0]
  let result = ''
  let current = value
  let position = 0
  let zero = false
  while (current > 0) {
    const digit = current % 10
    if (digit === 0) zero = result !== ''
    else {
      result = digits[digit] + units[position] + result
      if (zero) result = digits[0] + result
      zero = false
    }
    current = Math.floor(current / 10)
    position += 1
  }
  return result.replace(/^一十/, '十').replace(/零$/, '')
}

export function formatNumberStr({ num, type = 1, parentNumberStr = '' }) {
  const parent = parentNumberStr || ''
  const parentWithoutDot = parent.replace(/\.$/, '')
  switch (readNumberType(type)) {
    case 2:
      return `${parent ? `${parentWithoutDot}.` : ''}${num}.`
    case 3:
      return `(${parent ? `${parentWithoutDot}.` : ''}${num})`
    case 4:
      return `${parent}${alphabet(num, false)}.`
    case 5:
      return `${parent}${alphabet(num, true)}.`
    case 6:
      return `${parent}${roman(num, false)}.`
    case 7:
      return `${parent}${roman(num, true)}.`
    case 8:
      return `${parent}${chinese(num)}、`
    default:
      return `${parent ? `${parentWithoutDot}.` : ''}${num}`
  }
}

// 子节点编号插件。编号配置保存在启用编号的节点上，子孙节点按层级计算显示值。
class NodeNumbers {
  constructor({ mindMap } = {}) {
    this.mindMap = mindMap
    this.name = 'numbers'
    this.nodeDataName = 'number'
    this.formatNumberStr = formatNumberStr
    extendNodeDataKeys(mindMap, this.nodeDataName)
    this.bindEvent()
  }

  bindEvent() {
    this.mindMap.nodeInnerPrefixList.push({
      name: this.name,
      createContent: node => this.createNumberContent(node)
    })
    this.setNumber = this.setNumber.bind(this)
    this.mindMap.command.add('SET_NUMBER', this.setNumber)
  }

  unBindEvent() {
    const index = this.mindMap.nodeInnerPrefixList.findIndex(
      item => item.name === this.name
    )
    if (index !== -1) this.mindMap.nodeInnerPrefixList.splice(index, 1)
    this.mindMap.command.remove('SET_NUMBER', this.setNumber)
  }

  setNumber(nodes, config) {
    if (this.mindMap.opt.readonly) return
    const nodeList = normalizeNodeList(nodes, this.mindMap)
    nodeList.forEach(node => {
      let value = null
      if (config != null) {
        const previous = node.getData(this.nodeDataName) || {}
        value = {
          type: readNumberType(
            config.type === undefined ? previous.type : config.type,
            1
          ),
          level: this.normalizeLevel(
            config.level === undefined ? previous.level : config.level
          )
        }
      }
      setNodeData(this.mindMap, node, { [this.nodeDataName]: value })
    })
    if (nodeList.length > 0) this.mindMap.render()
  }

  normalizeLevel(value) {
    const level = Number(value)
    return Number.isInteger(level) && level >= 0 ? level : 1
  }

  getNumberConfig(node) {
    let current = node && node.parent
    while (current) {
      const config = current.getData(this.nodeDataName)
      if (config) return { node: current, config }
      current = current.parent
    }
    return null
  }

  getNodeNumber(node) {
    const source = this.getNumberConfig(node)
    if (!source) return ''
    const distance = node.layerIndex - source.node.layerIndex
    const level = this.normalizeLevel(source.config.level)
    if (level !== 0 && distance > level) return ''
    const parts = []
    let current = node
    while (current && current.uid !== source.node.uid) {
      const index = current.getIndexInBrothers()
      if (index < 0) return ''
      parts.unshift(index + 1)
      current = current.parent
    }
    let parentNumberStr = ''
    return parts
      .map(num => {
        const result = formatNumberStr({
          num,
          type: source.config.type,
          parentNumberStr
        })
        parentNumberStr = result
        return result
      })
      .pop()
  }

  createNumberContent(node) {
    const number = this.getNodeNumber(node)
    if (!number) return null
    const text = node.createSvgTextNode(number)
    node.style.text(text)
    const { width, height } = text.bbox()
    return { node: text, width: Math.ceil(width), height: Math.ceil(height) }
  }

  beforePluginRemove() {
    this.unBindEvent()
  }

  beforePluginDestroy() {
    this.unBindEvent()
  }
}

NodeNumbers.instanceName = 'numbers'

export default NodeNumbers
