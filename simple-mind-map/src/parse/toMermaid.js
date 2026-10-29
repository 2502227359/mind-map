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

const getNodeId = (treeIndex, path) => {
  const prefix = `n${treeIndex}`
  return path.length > 0 ? `${prefix}_${path.join('_')}` : prefix
}

const getFreeNodeTrees = root => {
  const freeNodeTrees = root && root.data ? root.data.freeNodeTrees : undefined
  if (freeNodeTrees === undefined || freeNodeTrees === null) return []
  if (!Array.isArray(freeNodeTrees)) {
    throw new Error('Mermaid 自由节点树必须是数组')
  }
  return freeNodeTrees
}

const renderNode = (node, treeIndex, path, depth, lines) => {
  if (!node || typeof node !== 'object') return
  const data = node.data || {}
  const indent = '  '.repeat(depth + 1)
  const id = getNodeId(treeIndex, path)
  lines.push(`${indent}${id}["${escapeMermaidLabel(getNodeText(data))}"]`)
  if (!Array.isArray(node.children)) return
  node.children.forEach((child, index) => {
    const childPath = [...path, index]
    const childId = getNodeId(treeIndex, childPath)
    renderNode(child, treeIndex, childPath, depth + 1, lines)
    lines.push(`${indent}${id} --> ${childId}`)
  })
}

const normalizeDirection = direction => {
  const value = String(direction || 'TD').toUpperCase()
  if (!['TB', 'TD', 'BT', 'RL', 'LR'].includes(value)) return 'TD'
  return value
}

// 转换成 Mermaid flowchart 格式。每棵根树均独立输出，根节点间不虚构连线。
export const transformToMermaid = (root, options = {}) => {
  if (!root || typeof root !== 'object') {
    throw new Error('Mermaid 根节点格式错误')
  }
  const trees = [root, ...getFreeNodeTrees(root)]
  trees.forEach(tree => {
    if (!tree || typeof tree !== 'object') {
      throw new Error('Mermaid 自由节点树格式错误')
    }
  })
  const lines = [`flowchart ${normalizeDirection(options.direction)}`]
  trees.forEach((tree, index) => renderNode(tree, index, [], 0, lines))
  return lines.join('\n')
}
