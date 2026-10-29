import xmlConvert from 'xml-js'

const isElement = (item, name) => {
  const itemName = item && item.type === 'element' ? item.name : ''
  return Boolean(itemName) && (!name || itemName.toLowerCase() === name)
}

const getElements = element => {
  return (element && element.elements ? element.elements : []).filter(item => {
    return item && item.type === 'element'
  })
}

const getAttribute = (attributes, names) => {
  const source = attributes || {}
  const keys = Object.keys(source)
  for (const name of names) {
    const key = keys.find(item => item.toLowerCase() === name.toLowerCase())
    if (key) return source[key]
  }
  return undefined
}

const normalizeLink = value => {
  if (value === undefined || value === null) return ''
  const link = String(value).trim()
  if (/[\u0000-\u001f\u007f]/.test(link)) return ''
  if (/^(?:javascript|vbscript|data):/i.test(link)) return ''
  return link
}

const escapeXml = value => {
  const text = String(value == null ? '' : value)
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    throw new Error('FreeMind 无法保存 XML 1.0 禁止的控制字符')
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\r/g, '&#13;')
    .replace(/\n/g, '&#10;')
    .replace(/\t/g, '&#9;')
}

const stripHtml = value => {
  return String(value == null ? '' : value)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

const getNodeText = data => {
  const text = data && data.text !== undefined ? data.text : ''
  return data && data.richText ? stripHtml(text) : String(text == null ? '' : text)
}

const getFreeNodeTrees = root => {
  const freeNodeTrees = root && root.data ? root.data.freeNodeTrees : undefined
  if (freeNodeTrees === undefined || freeNodeTrees === null) return []
  if (!Array.isArray(freeNodeTrees)) {
    throw new Error('FreeMind 自由节点树必须是数组')
  }
  return freeNodeTrees
}

const getNoteText = (data, options) => {
  if (!data || data.note === undefined || data.note === null) return ''
  const transformed =
    options && typeof options.transformNote === 'function'
      ? options.transformNote(data.note)
      : data.note
  return stripHtml(transformed)
}

const serializeNode = (node, depth, isTopLevel, options) => {
  if (!node || typeof node !== 'object') {
    throw new Error('FreeMind 节点格式错误')
  }
  const data = node.data && typeof node.data === 'object' ? node.data : {}
  if (data.freeNodeTrees && (!Array.isArray(data.freeNodeTrees) || data.freeNodeTrees.length)) {
    throw new Error('FreeMind 自由节点树只能位于根节点')
  }
  const children = Array.isArray(node.children) ? node.children : []
  const attrs = ['TEXT="' + escapeXml(getNodeText(data)) + '"']
  const hyperlink = normalizeLink(data.hyperlink)
  if (hyperlink) attrs.push('LINK="' + escapeXml(hyperlink) + '"')
  if (isTopLevel) attrs.push('POSITION="right"')
  if (data.expand === false && children.length > 0) attrs.push('FOLDED="true"')

  const indent = '  '.repeat(depth)
  const note = getNoteText(data, options)
  const childParts = children.map(child => {
    return serializeNode(child, depth + 1, false, options)
  })
  if (note) {
    const noteIndent = '  '.repeat(depth + 1)
    childParts.unshift(
      noteIndent +
        '<richcontent TYPE="NOTE"><html><head/><body><p>' +
        escapeXml(note) +
        '</p></body></html></richcontent>'
    )
  }
  const start = indent + '<node ' + attrs.join(' ')
  if (childParts.length === 0) return start + '/>'
  return start + '>\n' + childParts.join('\n') + '\n' + indent + '</node>'
}

// 将 SMM 节点树转换为 FreeMind .mm XML。根节点的自由节点树会成为并列根节点。
export const transformToFreemind = (root, options = {}) => {
  if (!root || typeof root !== 'object') {
    throw new Error('FreeMind 根节点格式错误')
  }
  const rootWithoutFreeTrees = {
    ...root,
    data: { ...(root.data || {}) }
  }
  delete rootWithoutFreeTrees.data.freeNodeTrees
  const trees = [rootWithoutFreeTrees, ...getFreeNodeTrees(root)]
  const nodes = trees.map(tree => {
    return serializeNode(tree, 1, true, options)
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<map version="1.0.1">',
    nodes.join('\n'),
    '</map>',
    ''
  ].join('\n')
}

const collectText = element => {
  if (!element) return ''
  if (element.type === 'text') return element.text || ''
  if (element.type === 'cdata') return element.cdata || ''
  if (element.type !== 'element') return ''
  const name = element.name.toLowerCase()
  if (name === 'br') return '\n'
  const text = (element.elements || []).map(collectText).join('')
  return ['p', 'div', 'li'].includes(name) ? text + '\n' : text
}

const getRichContent = (element, type) => {
  const content = getElements(element).find(item => {
    return (
      isElement(item, 'richcontent') &&
      String(getAttribute(item.attributes, ['type']) || '').toUpperCase() === type
    )
  })
  if (!content) return ''
  return collectText(content)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

const parseNode = element => {
  if (!isElement(element, 'node')) throw new Error('FreeMind 节点必须是 node')
  const attributes = element.attributes || {}
  const text = getAttribute(attributes, ['text', 'title'])
  const richNode = getRichContent(element, 'NODE')
  const data = {
    text: text === undefined ? richNode : String(text)
  }
  const hyperlink = normalizeLink(getAttribute(attributes, ['link', 'url']))
  if (hyperlink) data.hyperlink = hyperlink
  const note = getAttribute(attributes, ['note'])
  const richNote = getRichContent(element, 'NOTE')
  if (note !== undefined) data.note = String(note)
  else if (richNote) data.note = richNote
  if (String(getAttribute(attributes, ['folded']) || '').toLowerCase() === 'true') {
    data.expand = false
  }
  const children = getElements(element)
    .filter(item => isElement(item, 'node'))
    .map(parseNode)
  return { data, children }
}

const parseXml = xml => {
  if (typeof xml !== 'string' || xml.trim() === '') {
    throw new Error('FreeMind 内容为空')
  }
  if (/<\s*!\s*(?:doctype|entity)\b/i.test(xml)) {
    throw new Error('FreeMind 不支持 DOCTYPE 或实体声明')
  }
  let parsed
  try {
    parsed = xmlConvert.xml2js(xml, { compact: false, nativeType: false })
  } catch (error) {
    throw new Error('FreeMind XML 格式错误')
  }
  const items = parsed && Array.isArray(parsed.elements) ? parsed.elements : []
  const roots = items.filter(item => item && item.type === 'element')
  if (roots.length !== 1 || !isElement(roots[0], 'map')) {
    throw new Error('FreeMind 根元素必须是 map')
  }
  return roots[0]
}

// 解析 FreeMind .mm XML。多根文件保留为 root.data.freeNodeTrees。
export const parseFreemind = xml => {
  const map = parseXml(xml)
  const nodes = getElements(map)
    .filter(item => isElement(item, 'node'))
    .map(parseNode)
  if (nodes.length === 0) throw new Error('FreeMind 没有根节点')
  const root = nodes[0]
  if (nodes.length > 1) root.data.freeNodeTrees = nodes.slice(1)
  return root
}

export const transformToFreeMind = transformToFreemind
export const parseFreeMind = parseFreemind

export default {
  transformToFreemind,
  transformToFreeMind,
  parseFreemind,
  parseFreeMind
}
