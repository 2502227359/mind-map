'use strict'

const FORMAT = 'personal-mindmap'
const VERSION = 1
const MARKERS = {
  data: ['<!-- personal-mindmap:data:start -->', '<!-- personal-mindmap:data:end -->'],
  links: ['<!-- personal-mindmap:links:start -->', '<!-- personal-mindmap:links:end -->'],
  outline: ['<!-- personal-mindmap:outline:start -->', '<!-- personal-mindmap:outline:end -->']
}

function formatError(message) {
  return new Error(`导图文件格式错误：${message}`)
}

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (error) {
    throw formatError(`数据无法序列化：${error.message}`)
  }
}

function validateData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw formatError('导图数据必须是对象')
  }
  const safeData = cloneJson(data)
  validateNode(safeData.root, 'root')
  return safeData
}

function validateNode(node, path) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw formatError(`${path} 节点必须是对象`)
  }
  if (!node.data || typeof node.data !== 'object' || Array.isArray(node.data)) {
    throw formatError(`${path}.data 必须是对象`)
  }
  if (!Array.isArray(node.children)) {
    throw formatError(`${path}.children 必须是数组`)
  }
  node.children.forEach((child, index) => validateNode(child, `${path}.children[${index}]`))
}

function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw formatError('数据区必须是 JSON 对象')
  }
  if (envelope.format !== FORMAT || envelope.version !== VERSION) {
    throw formatError(`不支持的数据版本（需要 ${FORMAT} v${VERSION}）`)
  }
  return validateData(envelope.data)
}

function markerMatches(raw, marker) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return Array.from(raw.matchAll(new RegExp(`^${escaped}[ \\t]*(?=\\r?$)`, 'gm')))
}

function managedSection(raw, type) {
  const [startMarker, endMarker] = MARKERS[type]
  const starts = markerMatches(raw, startMarker)
  const ends = markerMatches(raw, endMarker)
  if (starts.length !== 1 || ends.length !== 1) {
    throw formatError(`${type} 区边界必须各出现一次`)
  }
  const start = starts[0]
  const end = ends[0]
  if (end.index <= start.index) {
    throw formatError(`${type} 区边界顺序无效`)
  }
  const contentEnd = end.index + end[0].length
  let endExclusive = contentEnd
  const following = raw.slice(contentEnd).match(/^\r?\n/)
  if (following) endExclusive += following[0].length
  return {
    start: start.index,
    contentEnd,
    endExclusive,
    text: raw.slice(start.index, contentEnd),
    startMarker,
    endMarker
  }
}

function readFrontmatter(raw) {
  const lines = raw.split(/\r\n|\n/)
  if (lines[0] !== '---') throw formatError('缺少 frontmatter')
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (close < 0) throw formatError('frontmatter 未闭合')
  const frontmatter = lines.slice(1, close)
  const values = key => frontmatter
    .filter(line => new RegExp(`^${key}[ \\t]*:`).test(line))
    .map(line => line.replace(new RegExp(`^${key}[ \\t]*:[ \\t]*`), '').trim())
  const enabled = values('personal_mindmap')
  const versions = values('personal_mindmap_version')
  if (enabled.length !== 1 || !/^true(?:[ \	]*#.*)?$/.test(enabled[0])) {
    throw formatError('frontmatter 缺少 personal_mindmap: true')
  }
  if (versions.length !== 1 || !/^1(?:[ \	]*#.*)?$/.test(versions[0])) {
    throw formatError('frontmatter 版本不是 1')
  }
  let bodyStart = 0
  for (let index = 0; index <= close; index += 1) {
    bodyStart += lines[index].length
    if (index < lines.length - 1) {
      if (raw.slice(bodyStart, bodyStart + 2) === '\r\n') bodyStart += 2
      else if (raw[bodyStart] === '\n') bodyStart += 1
    }
  }
  return bodyStart
}

function parseDataSection(section) {
  const lines = section.text.replace(/\r\n/g, '\n').split('\n')
  if (lines.length < 5 || lines[0] !== section.startMarker || lines[lines.length - 1] !== section.endMarker) {
    throw formatError('data 区边界内容无效')
  }
  if (lines[1] !== '```json' || lines[lines.length - 2] !== '```') {
    throw formatError('data 区必须包含 JSON 代码块')
  }
  const json = lines.slice(2, -2).join('\n').trim()
  if (!json) throw formatError('data 区 JSON 为空')
  let envelope
  try {
    envelope = JSON.parse(json)
  } catch (error) {
    throw formatError(`data 区 JSON 无法解析：${error.message}`)
  }
  return validateEnvelope(envelope)
}

function parseDocument(raw) {
  if (typeof raw !== 'string' || raw.length === 0) throw formatError('文件内容为空')
  const bodyStart = readFrontmatter(raw)
  const sections = {
    data: managedSection(raw, 'data'),
    links: managedSection(raw, 'links'),
    outline: managedSection(raw, 'outline')
  }
  const orderedSections = Object.values(sections).sort((left, right) => left.start - right.start)
  for (const section of orderedSections) {
    if (section.start < bodyStart) throw formatError('受管区不能位于 frontmatter')
  }
  for (let index = 1; index < orderedSections.length; index += 1) {
    if (orderedSections[index].start < orderedSections[index - 1].endExclusive) {
      throw formatError('受管区不能互相重叠')
    }
  }
  return { data: parseDataSection(sections.data), raw }
}

function textForOutline(value) {
  const text = value == null ? '' : String(value)
  const plain = text.replace(/[\r\n]+/g, ' ').trim() || '（无标题）'
  return plain
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/([`*_{}\[\]()#+.!|>~-])/g, '\\$1')
}

function collectOutline(node, depth, lines, seen) {
  if (!node || typeof node !== 'object' || seen.has(node)) return
  seen.add(node)
  lines.push(`${'  '.repeat(depth)}- ${textForOutline(node.data && node.data.text)}`)
  if (Array.isArray(node.children)) {
    node.children.forEach(child => collectOutline(child, depth + 1, lines, seen))
  }
}

function safeLink(value) {
  if (typeof value !== 'string') return null
  const link = value.trim()
  if (!link || /[\r\n<>]/.test(link) || /^(?:javascript|data|vbscript):/i.test(link)) return null
  if (/^!?\[\[[^\]]+\]\]$/.test(link)) return link
  if (/^(?:https?:\/\/|mailto:)/i.test(link)) return `<${link}>`
  return `[[${link.replace(/\]\]/g, '\\\]\]')}]]`
}

function collectLinks(node, links, seen) {
  if (!node || typeof node !== 'object' || seen.has(node)) return
  seen.add(node)
  const link = safeLink(node.data && node.data.hyperlink)
  if (link) links.add(link)
  if (Array.isArray(node.children)) node.children.forEach(child => collectLinks(child, links, seen))
}

function deriveSections(data) {
  const links = new Set()
  collectLinks(data.root, links, new Set())
  const outline = []
  collectOutline(data.root, 0, outline, new Set())
  return {
    links: [
      MARKERS.links[0],
      '<!-- 由导图自动生成，请勿直接编辑。 -->',
      ...Array.from(links).sort().map(link => `- ${link}`),
      MARKERS.links[1]
    ].join('\n'),
    outline: [
      MARKERS.outline[0],
      '<!-- 由导图自动生成，请勿直接编辑。 -->',
      ...outline,
      MARKERS.outline[1]
    ].join('\n')
  }
}

function dataSection(data) {
  const envelope = { format: FORMAT, version: VERSION, data }
  return [
    MARKERS.data[0],
    '```json',
    JSON.stringify(envelope, null, 2),
    '```',
    MARKERS.data[1]
  ].join('\n')
}

function createDocument(data) {
  const safeData = validateData(data)
  const derived = deriveSections(safeData)
  return [
    '---',
    'personal_mindmap: true',
    'personal_mindmap_version: 1',
    '---',
    '',
    dataSection(safeData),
    '',
    derived.links,
    '',
    derived.outline,
    ''
  ].join('\n')
}

function replaceSection(raw, section, replacement, eol) {
  const trailing = raw.slice(section.contentEnd, section.endExclusive)
  return raw.slice(0, section.start) + replacement.replace(/\n/g, eol) + trailing + raw.slice(section.endExclusive)
}

function serializeDocument(raw, data) {
  parseDocument(raw)
  const safeData = validateData(data)
  const derived = deriveSections(safeData)
  const sections = {
    data: managedSection(raw, 'data'),
    links: managedSection(raw, 'links'),
    outline: managedSection(raw, 'outline')
  }
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const replacements = [
    [sections.data, dataSection(safeData)],
    [sections.links, derived.links],
    [sections.outline, derived.outline]
  ].sort((a, b) => b[0].start - a[0].start)
  return replacements.reduce((current, [section, replacement]) => {
    return replaceSection(current, section, replacement, eol)
  }, raw)
}

function isMindMapDocument(raw) {
  try {
    parseDocument(raw)
    return true
  } catch (_) {
    return false
  }
}

module.exports = {
  FORMAT,
  VERSION,
  createDocument,
  parseDocument,
  serializeDocument,
  isMindMapDocument
}
