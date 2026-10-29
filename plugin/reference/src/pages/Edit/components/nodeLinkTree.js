import { getTextFromHtml } from 'simple-mind-map/src/utils'

function getNodeData(tree) {
  if (!tree || typeof tree !== 'object') return null
  const value = tree.data || tree.nodeData || tree
  if (value && value.data && !value.uid) return value.data
  return value
}

function getNodeText(data) {
  if (!data) return ''
  const value = data.text == null ? data.richText : data.text
  if (value == null) return ''
  const text = data.richText ? getTextFromHtml(String(value)) : String(value)
  return text.replace(/\s+/g, ' ').trim()
}

function buildTreeNode(tree, options, path) {
  const data = getNodeData(tree)
  const uid = data && data.uid != null ? String(data.uid) : ''
  if (!data || !uid) return null
  const children = (tree.children || [])
    .map((child, index) => buildTreeNode(child, options, `${path}-${index}`))
    .filter(Boolean)
  const isRoot = path.split('-').length === 1
  const name = getNodeText(data) || `未命名节点 ${uid.slice(0, 8)}`
  const prefix = isRoot
    ? options.isFreeRoot
      ? `游离树 ${options.freeIndex}：`
      : '主结构：'
    : ''
  return {
    uid,
    label: `${prefix}${name}`,
    children,
    disabled: uid === options.excludeUid,
    isFreeRoot: Boolean(options.isFreeRoot),
    depth: path.split('-').length - 1,
    data
  }
}

/**
 * 从渲染器的原始树生成节点跳转选择器所需的数据。
 * 使用原始树而不是已渲染节点，因此折叠节点和游离树都可被选择。
 */
export function buildNodeLinkTree(renderer, excludeUid = '') {
  const trees =
    renderer && typeof renderer.getAllRenderTree === 'function'
      ? renderer.getAllRenderTree()
      : []
  return trees
    .map((tree, index) =>
      buildTreeNode(tree, {
        excludeUid: String(excludeUid || ''),
        isFreeRoot: index > 0,
        freeIndex: index
      }, `${index}`)
    )
    .filter(Boolean)
}

export function filterNodeLinkTree(value, data) {
  if (!value) return true
  const keyword = String(value).toLowerCase()
  return (
    String(data.label || '').toLowerCase().includes(keyword) ||
    String(data.uid || '').toLowerCase().includes(keyword)
  )
}
