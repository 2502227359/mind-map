import { nodeRichTextToTextWithWrap } from '../utils'

const mermaidLabelEntities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '#39;',
  '(': '#40;',
  ')': '#41;',
  '[': '#91;',
  ']': '#93;',
  '{': '#123;',
  '}': '#125;',
  '%': '#37;',
  '#': '#35;',
  '\\': '#92;',
  '`': '#96;',
  '\n': '#10;'
}

const escapeMermaidLabel = value => {
  return String(value == null ? '' : value).replace(/\r\n?/g, '\n').replace(
    /[&<>"'()[\]{}%#\\`\n]/g,
    char => mermaidLabelEntities[char]
  )
}

const getNodeText = data => {
  if (!data) return ''
  const text = data.text == null ? '' : data.text
  return data.richText ? nodeRichTextToTextWithWrap(text) : text
}

const getNodeId = path => {
  return path.length > 0 ? `n0_${path.join('_')}` : 'n0'
}

const assertNoFreeNodeTrees = node => {
  if (!node || typeof node !== 'object') return
  const data = node.data || {}
  const freeNodeTrees = data.freeNodeTrees
  const hasFreeNodeTrees = Array.isArray(freeNodeTrees)
    ? freeNodeTrees.length > 0
    : Boolean(freeNodeTrees)
  if (hasFreeNodeTrees) {
    throw new Error('Mermaid 导出暂不支持自由节点树，请使用 SMM/JSON')
  }
  if (Array.isArray(node.children)) {
    node.children.forEach(assertNoFreeNodeTrees)
  }
}

const renderNode = (node, path, depth, lines) => {
  if (!node || typeof node !== 'object') return
  const data = node.data || {}
  const indent = '  '.repeat(depth + 1)
  lines.push(`${indent}${getNodeId(path)}["${escapeMermaidLabel(getNodeText(data))}"]`)
  if (!Array.isArray(node.children)) return
  node.children.forEach((child, index) => {
    renderNode(child, [...path, index], depth + 1, lines)
  })
}

// 转换成 Mermaid mindmap 格式，节点 id 只由树路径决定，重复导出结果稳定。
export const transformToMermaid = root => {
  assertNoFreeNodeTrees(root)
  const lines = ['mindmap']
  renderNode(root, [], 0, lines)
  return lines.join('\n')
}
