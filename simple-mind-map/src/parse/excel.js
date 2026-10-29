const LINK_HEADERS = /^(?:链接|link|url|hyperlink)$/i
const NOTE_HEADERS = /^(?:备注|note)$/i
const NODE_HEADER = /^(?:节点|node|level|层级)\s*[_ -]?\s*\d+$/i

const getNodeText = data => {
  const text = data && data.text !== undefined ? data.text : ''
  if (!data || !data.richText) return String(text == null ? '' : text)
  return String(text == null ? '' : text)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
}

const getTopTrees = root => {
  if (!root || typeof root !== 'object') {
    throw new Error('Excel 根节点格式错误')
  }
  const freeNodeTrees = root.data && root.data.freeNodeTrees
  if (freeNodeTrees === undefined || freeNodeTrees === null) return [root]
  if (!Array.isArray(freeNodeTrees)) {
    throw new Error('Excel 自由节点树必须是数组')
  }
  return [root, ...freeNodeTrees]
}

const getNodeMeta = node => {
  const data = node && node.data ? node.data : {}
  return {
    hyperlink: data.hyperlink == null ? '' : String(data.hyperlink),
    note: data.note == null ? '' : String(data.note)
  }
}

// 将节点树转成带路径的表格行。每一行的 path 是从根到当前节点的文本数组。
export const mindMapToRows = root => {
  const rows = []
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return
    const data = node.data || {}
    const text = getNodeText(data)
    rows.push({
      path: [...path, text],
      ...getNodeMeta(node)
    })
    if (Array.isArray(node.children)) {
      node.children.forEach(child => walk(child, [...path, text]))
    }
  }
  getTopTrees(root).forEach(tree => walk(tree, []))
  return rows
}

// 生成可直接交给 xlsx.utils.aoa_to_sheet 的二维表，首行是列名。
export const mindMapToExcelTable = root => {
  const rows = mindMapToRows(root)
  const depth = rows.reduce((max, row) => Math.max(max, row.path.length), 1)
  const headers = Array.from({ length: depth }, (_, index) => {
    return '节点' + (index + 1)
  })
  headers.push('链接', '备注')
  return [
    headers,
    ...rows.map(row => {
      return [
        ...row.path,
        ...Array(Math.max(0, depth - row.path.length)).fill(''),
        row.hyperlink,
        row.note
      ]
    })
  ]
}

const normalizeCell = value => {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

const normalizeLink = value => {
  const link = normalizeCell(value)
  if (/[\x00-\x1f\x7f]/.test(link)) return ''
  if (/^(?:javascript|vbscript|data):/i.test(link)) return ''
  return link
}

const getColumnIndexes = (headers, options = {}) => {
  const headerList = Array.isArray(headers) ? headers : []
  const linkIndex = headerList.findIndex(value => LINK_HEADERS.test(normalizeCell(value)))
  const noteIndex = headerList.findIndex(value => NOTE_HEADERS.test(normalizeCell(value)))
  const inferredNodeIndexes = headerList
    .map((value, index) => (NODE_HEADER.test(normalizeCell(value)) ? index : -1))
    .filter(index => index >= 0)
  const nodeIndexes =
    Array.isArray(options.nodeIndexes) && options.nodeIndexes.length > 0
      ? options.nodeIndexes
      : inferredNodeIndexes.length > 0
        ? inferredNodeIndexes
        : Array.from({ length: headerList.length }, (_, index) => index).filter(index => {
            return index !== linkIndex && index !== noteIndex
          })
  return { nodeIndexes, linkIndex, noteIndex }
}

const rowsToEntries = (rows, options = {}) => {
  const source = Array.isArray(rows) ? rows : []
  const hasHeader = options.hasHeader !== false
  const body = hasHeader ? source.slice(1) : source
  const width = body.reduce((max, row) => {
    return Math.max(max, Array.isArray(row) ? row.length : 0)
  }, 0)
  const headers = hasHeader && source.length > 0
    ? source[0]
    : Array.from({ length: width }, (_, index) => '节点' + (index + 1))
  const columns = getColumnIndexes(headers, options)
  return body
    .filter(row => Array.isArray(row) || (row && typeof row === 'object'))
    .map(row => {
      const getValue = index => {
        if (Array.isArray(row)) return row[index]
        const key = headers[index]
        return key === undefined ? undefined : row[key]
      }
      const path = columns.nodeIndexes.map(getValue).map(normalizeCell)
      while (path.length > 0 && !path[path.length - 1]) path.pop()
      return {
        path,
        hyperlink: normalizeLink(getValue(columns.linkIndex)),
        note: normalizeCell(getValue(columns.noteIndex))
      }
    })
    .filter(row => row.path.length > 0)
}

const createNode = text => ({ data: { text }, children: [] })

const findChild = (parent, text) => {
  return parent.children.find(child => child.data.text === text)
}

const addEntry = (trees, entry) => {
  let current = null
  entry.path.forEach((text, index) => {
    if (index === 0) {
      current = trees.find(tree => tree.data.text === text)
      if (!current) {
        current = createNode(text)
        trees.push(current)
      }
      return
    }
    let child = findChild(current, text)
    if (!child) {
      child = createNode(text)
      current.children.push(child)
    }
    current = child
  })
  if (current) {
    if (entry.hyperlink) current.data.hyperlink = entry.hyperlink
    if (entry.note) current.data.note = entry.note
  }
}

// 解析二维表。多根第一棵树保留为 root，其余树放到 root.data.freeNodeTrees。
export const rowsToMindMap = (rows, options = {}) => {
  const entries = rowsToEntries(rows, options)
  if (entries.length === 0) throw new Error('Excel 没有可用的节点行')
  const trees = []
  entries.forEach(entry => addEntry(trees, entry))
  const root = trees[0]
  if (trees.length > 1) root.data.freeNodeTrees = trees.slice(1)
  return root
}

export const excelTableToMindMap = rowsToMindMap

export default {
  mindMapToRows,
  mindMapToExcelTable,
  rowsToMindMap,
  excelTableToMindMap
}
