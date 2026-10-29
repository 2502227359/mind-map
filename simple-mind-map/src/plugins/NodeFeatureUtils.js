// 节点扩展插件共用的小工具。

export function normalizeNodeList(nodes, mindMap) {
  const list =
    nodes == null || nodes === '' ? [] : Array.isArray(nodes) ? nodes : [nodes]
  const activeList =
    mindMap && mindMap.renderer && mindMap.renderer.activeNodeList
  const result = list.length > 0 ? list : activeList || []
  return result.filter(node => node && !node.isGeneralization)
}

export function setNodeData(mindMap, node, data) {
  if (!mindMap || mindMap.opt?.readonly || !node || !data || typeof mindMap.execCommand !== 'function') {
    return false
  }
  mindMap.execCommand('SET_NODE_DATA', node, data)
  return true
}

export function extendNodeDataKeys(mindMap, keys) {
  const ctor = mindMap && mindMap.constructor
  if (!ctor || typeof ctor.extendNodeDataNoStylePropList !== 'function') {
    return
  }
  const list = Array.isArray(keys) ? keys : [keys]
  const available = list.filter(key => typeof key === 'string' && key)
  if (available.length > 0) ctor.extendNodeDataNoStylePropList(available)
}

export function getNodeColor(node, fallback = '#3f9cfc') {
  if (!node || typeof node.getStyle !== 'function') return fallback
  return node.getStyle('color') || node.getStyle('lineColor') || fallback
}

export function readNumberType(value, fallback = 1) {
  const source = value && typeof value === 'object' ? value.type : value
  const number = Number(source)
  return Number.isInteger(number) && number >= 1 && number <= 8
    ? number
    : fallback
}

export function toBoolean(value) {
  return value === true || value === 1 || value === 'true'
}
