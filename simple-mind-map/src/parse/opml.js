import xmlConvert from 'xml-js'
import { getTextFromHtml } from '../utils/index'

const DEFAULT_ROOT_TEXT = 'OPML'

const isElement = (item, name) => {
  return item && item.type === 'element' && (!name || item.name === name)
}

const getElements = element => {
  return (element && element.elements ? element.elements : []).filter(item => {
    return isElement(item)
  })
}

const getCharacterData = item => {
  if (item.type === 'text') return item.text || ''
  if (item.type === 'cdata') return item.cdata || ''
  return ''
}

const hasUnexpectedText = item => {
  return getCharacterData(item).trim() !== ''
}

const getElementText = element => {
  return (element && element.elements ? element.elements : []).reduce(
    (text, item) => {
      const characterData = getCharacterData(item)
      if (characterData) return text + characterData
      if (item.type === 'element') {
        return text + getElementText(item)
      }
      return text
    },
    ''
  )
}

const getAttribute = (attributes, names) => {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(attributes, name)) {
      return attributes[name]
    }
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

const getSafeLink = (attributes, names) => {
  return names.map(name => normalizeLink(attributes[name])).find(Boolean) || ''
}

const escapeXml = value => {
  const text = String(value)
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    throw new Error('OPML 无法保存 XML 1.0 禁止的控制字符')
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

const getNodeText = data => {
  const text =
    data && data.text !== undefined && data.text !== null
      ? String(data.text)
      : ''
  if (!data || !data.richText) return text
  return getTextFromHtml(text) || ''
}

const serializeOutline = (node, depth) => {
  if (!node || typeof node !== 'object') {
    throw new Error('OPML 节点格式错误')
  }
  const data = node.data && typeof node.data === 'object' ? node.data : {}
  if (data.freeNodeTrees && (!Array.isArray(data.freeNodeTrees) || data.freeNodeTrees.length)) {
    throw new Error('OPML 导出暂不支持自由节点树，请使用 SMM/JSON')
  }
  const attrs = [`text="${escapeXml(getNodeText(data))}"`]
  const hyperlink = normalizeLink(data.hyperlink)
  if (hyperlink) attrs.push(`url="${escapeXml(hyperlink)}"`)
  if (data.hyperlinkTitle !== undefined && data.hyperlinkTitle !== null) {
    attrs.push(`title="${escapeXml(data.hyperlinkTitle)}"`)
  }
  if (data.note !== undefined && data.note !== null) {
    attrs.push(`_note="${escapeXml(data.note)}"`)
  }

  const indent = '  '.repeat(depth)
  const children = Array.isArray(node.children) ? node.children : []
  const start = `${indent}<outline ${attrs.join(' ')}`
  if (children.length === 0) return `${start}/>`

  const childText = children
    .map(child => serializeOutline(child, depth + 1))
    .join('\n')
  return `${start}>\n${childText}\n${indent}</outline>`
}

const parseOutline = element => {
  if (!isElement(element, 'outline')) {
    throw new Error('OPML 节点必须是 outline')
  }
  const attributes = element.attributes || {}
  const textValue = getAttribute(attributes, ['text', 'title'])
  const data = { text: textValue === undefined ? '' : String(textValue) }
  const title = getAttribute(attributes, ['title'])
  if (attributes.text !== undefined && title !== undefined) {
    data.hyperlinkTitle = String(title)
  }

  const hyperlink = getSafeLink(attributes, ['url', 'xmlUrl'])
  if (hyperlink) data.hyperlink = hyperlink

  const note = getAttribute(attributes, ['_note', 'note'])
  if (note !== undefined) data.note = String(note)

  const childItems = element.elements || []
  const unsupported = childItems.find(item => {
    return item.type === 'element' && item.name !== 'outline'
  })
  if (unsupported) throw new Error('OPML outline 含有不支持的子元素')
  if (childItems.some(hasUnexpectedText)) {
    throw new Error('OPML outline 含有无效文本')
  }

  return {
    data,
    children: childItems
      .filter(item => isElement(item, 'outline'))
      .map(parseOutline)
  }
}

const parseXml = xml => {
  if (typeof xml !== 'string' || xml.trim() === '') {
    throw new Error('OPML 内容为空')
  }
  if (/<\s*!\s*(?:doctype|entity)\b/i.test(xml)) {
    throw new Error('OPML 不支持 DOCTYPE 或实体声明')
  }

  let parsed
  try {
    parsed = xmlConvert.xml2js(xml, { compact: false, nativeType: false })
  } catch (error) {
    throw new Error('OPML XML 格式错误')
  }

  const topItems =
    parsed && Array.isArray(parsed.elements) ? parsed.elements : []
  const rootElements = topItems.filter(item => isElement(item))
  if (rootElements.length !== 1 || !isElement(rootElements[0], 'opml')) {
    throw new Error('OPML 根元素必须是 opml')
  }
  if (topItems.some(hasUnexpectedText)) {
    throw new Error('OPML 根元素外存在无效内容')
  }
  return rootElements[0]
}

const parseHeadTitle = head => {
  const title = getElements(head).find(item => item.name === 'title')
  return title ? getElementText(title).trim() : ''
}

// 将 SMM 节点树转换为 OPML XML 字符串
export const transformToOpml = (root, title = '') => {
  if (!root || typeof root !== 'object') {
    throw new Error('OPML 根节点格式错误')
  }
  const headTitle = title === undefined || title === null ? '' : String(title)
  const outline = serializeOutline(root, 2)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    '  <head>',
    `    <title>${escapeXml(headTitle)}</title>`,
    '  </head>',
    '  <body>',
    outline,
    '  </body>',
    '</opml>',
    ''
  ].join('\n')
}

// 将 OPML XML 字符串解析为 SMM 节点树
export const parseOpml = xml => {
  const opml = parseXml(xml)
  const sections = getElements(opml)
  const unsupportedSection = sections.find(item => {
    return !['head', 'body'].includes(item.name)
  })
  if (unsupportedSection) throw new Error('OPML 只支持 head 和 body')
  const heads = sections.filter(item => item.name === 'head')
  if (heads.length > 1) throw new Error('OPML 只能有一个 head')
  const bodies = sections.filter(item => item.name === 'body')
  if (bodies.length !== 1) throw new Error('OPML 缺少唯一的 body')

  const bodyItems = bodies[0].elements || []
  const outlines = bodyItems.filter(item => isElement(item, 'outline'))
  const unsupportedBodyItem = bodyItems.find(item => {
    return item.type === 'element' && item.name !== 'outline'
  })
  if (unsupportedBodyItem) throw new Error('OPML body 含有不支持的元素')
  if (bodyItems.some(hasUnexpectedText)) {
    throw new Error('OPML body 含有无效文本')
  }
  if (outlines.length === 0) throw new Error('OPML body 没有 outline')

  const nodes = outlines.map(parseOutline)
  if (nodes.length === 1) return nodes[0]

  const head = heads[0]
  return {
    data: { text: parseHeadTitle(head) || DEFAULT_ROOT_TEXT },
    children: nodes
  }
}

export default {
  transformToOpml,
  parseOpml
}
