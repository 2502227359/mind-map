'use strict'

const LZString = require('../../vendor/lz-string')

const SIMPLE_MIND_MAP_TAG = 'simplemindmap'
const MODIFY_TIP = '请勿修改除YAML外的任何信息'
const SECTION_NAMES = ['metadata', 'svgdata', 'linkdata', 'textdata']

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
  if (node.data.freeNodeTrees !== undefined) {
    if (!Array.isArray(node.data.freeNodeTrees)) {
      throw formatError(`${path}.data.freeNodeTrees 必须是数组`)
    }
    node.data.freeNodeTrees.forEach((child, index) => {
      validateNode(child, `${path}.data.freeNodeTrees[${index}]`)
    })
  }
}

function normalizeLineEndings(raw) {
  return raw.replace(/\r\n?/g, '\n')
}

function parseFrontmatter(lines) {
  if (lines[0] !== '---') throw formatError('缺少 frontmatter')
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (close < 0) throw formatError('frontmatter 未闭合')

  let path = ''
  const tags = []
  const yaml = []
  let readingTags = false
  for (const line of lines.slice(1, close)) {
    if (/^path\s*:/.test(line)) {
      path = line.replace(/^path\s*:\s*/, '').trim()
      readingTags = false
    } else if (line.trim() === 'tags:') {
      readingTags = true
    } else if (readingTags && /^\s{2}-/.test(line)) {
      tags.push(line.replace(/^\s{2}-\s*/, '').trim())
    } else {
      readingTags = false
      yaml.push(line)
    }
  }

  return {
    bodyStart: close + 1,
    metadata: { path, tags, yaml: yaml.length ? `${yaml.join('\n')}\n` : '' }
  }
}

function findSectionHeadings(lines, bodyStart) {
  const headings = {}
  for (const name of SECTION_NAMES) headings[name] = []
  let inFence = false
  for (let index = bodyStart; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (inFence) {
      if (line === '```') inFence = false
      continue
    }
    if (line.startsWith('```')) {
      inFence = true
      continue
    }
    for (const name of SECTION_NAMES) {
      if (line === `# ${name}`) headings[name].push(index)
    }
    if (line === '# textdata') break
  }
  for (const name of SECTION_NAMES) {
    if (headings[name].length !== 1) throw formatError(`${name} 区标题必须出现一次`)
  }
  const ordered = SECTION_NAMES.map(name => headings[name][0])
  if (ordered.some((value, index) => index > 0 && value <= ordered[index - 1])) {
    throw formatError('四段结构顺序无效')
  }
  return headings
}

function parseMetadataContent(lines, heading, nextHeading) {
  if (lines[heading + 1]?.trim() !== '```metadata') {
    throw formatError('metadata 区必须包含 metadata 代码块')
  }
  const close = findClosingFence(lines, heading + 2, nextHeading)
  return lines.slice(heading + 2, close).join('\n')
}

function findClosingFence(lines, start, end) {
  for (let index = start; index < end; index += 1) {
    if (lines[index].trim() === '```') return index
  }
  throw formatError('代码块未闭合')
}

function parseSvgdata(lines, heading, nextHeading) {
  const body = lines.slice(heading + 1, nextHeading)
  while (body.length && body[body.length - 1].trim() === '') body.pop()
  if (body.length === 0) return { svgdata: '', svgdataUpdateAt: '' }

  const first = body[0].trim()
  if (first.startsWith('![[')) {
    const updateLine = body.find(line => line.trim().startsWith('> updateAt:'))
    return {
      svgdata: first,
      svgdataUpdateAt: updateLine ? updateLine.replace(/^\s*> updateAt:\s*/, '') : ''
    }
  }
  if (first !== '```svgData') throw formatError('svgdata 区格式无效')
  const close = findClosingFence(body, 1, body.length)
  if (body.slice(close + 1).some(line => line.trim() !== '')) {
    throw formatError('svgdata 区包含无效内容')
  }
  return { svgdata: body.slice(1, close).join('\n'), svgdataUpdateAt: '' }
}

function parseLinkdata(lines, heading, nextHeading) {
  const linkdata = []
  for (const line of lines.slice(heading + 1, nextHeading)) {
    if (!line.trim()) continue
    if (!line.startsWith('- ')) throw formatError('linkdata 区格式无效')
    linkdata.push(line.slice(2).trim())
  }
  return linkdata
}

function parseTextdata(lines, heading) {
  const body = lines.slice(heading + 1).join('\n').trim()
  if (!body) return []
  return body.split(/\n\n+/).map(entry => entry.replace(/\n+$/g, ''))
}

function decodeMindMapContent(content) {
  const value = content.trim()
  if (!value) throw formatError('metadata.content 为空')
  try {
    return validateData(JSON.parse(value))
  } catch (jsonError) {
    let decompressed
    try {
      decompressed = LZString.decompressFromBase64(value)
    } catch (error) {
      throw formatError(`metadata.content 无法解压：${error.message}`)
    }
    if (!decompressed) throw formatError('metadata.content 无法解压')
    try {
      return validateData(JSON.parse(decompressed))
    } catch (error) {
      throw formatError(`metadata.content 不是有效导图 JSON：${error.message}`)
    }
  }
}

function parseDocument(raw) {
  if (typeof raw !== 'string' || raw.length === 0) throw formatError('文件内容为空')
  const normalized = normalizeLineEndings(raw)
  const lines = normalized.split('\n')
  const { bodyStart, metadata } = parseFrontmatter(lines)
  const headings = findSectionHeadings(lines, bodyStart)
  if (headings.metadata[0] < bodyStart) throw formatError('导图区不能位于 frontmatter')

  const metadataHeading = headings.metadata[0]
  const svgdataHeading = headings.svgdata[0]
  const linkdataHeading = headings.linkdata[0]
  const textdataHeading = headings.textdata[0]
  metadata.content = parseMetadataContent(lines, metadataHeading, svgdataHeading)
  const svg = parseSvgdata(lines, svgdataHeading, linkdataHeading)
  const data = decodeMindMapContent(metadata.content)
  const linkdata = parseLinkdata(lines, linkdataHeading, textdataHeading)
  if (applyLinkDataUpdates(data, linkdata)) metadata.content = JSON.stringify(data)
  return {
    data,
    raw,
    metadata,
    svgdata: svg.svgdata,
    svgdataUpdateAt: svg.svgdataUpdateAt,
    linkdata,
    textdata: parseTextdata(lines, textdataHeading)
  }
}

function normalizeMetadata(metadata) {
  const path = metadata.path == null ? '' : String(metadata.path)
  const yaml = metadata.yaml == null ? '' : String(metadata.yaml)
  const tags = Array.isArray(metadata.tags) ? metadata.tags.map(tag => String(tag)) : []
  if (/\r|\n/.test(path)) throw formatError('metadata.path 不能包含换行')
  if (tags.some(tag => /\r|\n/.test(tag))) throw formatError('metadata.tags 不能包含换行')
  return {
    path,
    tags: Array.from(new Set([SIMPLE_MIND_MAP_TAG, ...tags])),
    yaml
  }
}

function resolveOption(options, key, fallback) {
  return Object.prototype.hasOwnProperty.call(options, key) ? options[key] : fallback
}

function isExternalResource(value) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(String(value || '').trim())
}

function internalTarget(value) {
  const raw = String(value == null ? '' : value).trim()
  if (!raw || isExternalResource(raw)) return ''
  const wrapped = raw.match(/^!?\[\[([^\]]+)\]\]$/)
  const target = wrapped ? wrapped[1] : raw
  return target.split('|', 1)[0].trim()
}

function plainText(value) {
  return String(value == null ? '' : value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n$/g, '')
}

function walkNodes(data, callback) {
  const roots = [data.root]
  if (Array.isArray(data.root.data.freeNodeTrees)) roots.push(...data.root.data.freeNodeTrees)
  const stack = [...roots].reverse()
  while (stack.length) {
    const node = stack.pop()
    callback(node)
    if (node.children) stack.push(...[...node.children].reverse())
  }
}

function collectLinkData(data) {
  const links = new Set()
  const images = new Set()
  walkNodes(data, node => {
    const nodeData = node.data || {}
    const hyperlink = internalTarget(nodeData.hyperlink)
    if (hyperlink) links.add(`[[${hyperlink}]]_[${hyperlink}]`)
    const text = String(nodeData.text == null ? '' : nodeData.text)
    const anchorPattern = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi
    let match
    while ((match = anchorPattern.exec(text))) {
      const target = internalTarget(match[1])
      if (target) links.add(`[[${target}]]_[${target}]`)
    }
    const image = internalTarget(nodeData.image)
    if (image) images.add(image)
  })
  return [
    ...links,
    ...Array.from(images, image => `![[${image}]]_[${image}]`)
  ]
}

function parseLinkDataChange(entry) {
  const value = String(entry || '').trim()
  const imageMatch = value.match(/^!\[\[([^\]]+)\]\]_\[([^\]]+)\]$/)
  const linkMatch = value.match(/^\[\[([^\]]+)\]\]_\[([^\]]+)\]$/)
  const match = imageMatch || linkMatch
  if (!match) return null
  const next = internalTarget(match[1])
  const original = match[2].trim()
  if (!next || !original || isExternalResource(next) || isExternalResource(original)) return null
  return { kind: imageMatch ? 'image' : 'link', next, original }
}

function setLinkMapping(map, conflicts, original, next) {
  if (conflicts.has(original) || original === next) return
  const previous = map.get(original)
  if (previous && previous !== next) {
    map.delete(original)
    conflicts.add(original)
    return
  }
  map.set(original, next)
}

function collectLinkMappings(linkdata) {
  const mappings = {
    links: new Map(),
    images: new Map(),
    linkConflicts: new Set(),
    imageConflicts: new Set()
  }
  for (const entry of linkdata || []) {
    const change = parseLinkDataChange(entry)
    if (!change) continue
    const map = change.kind === 'image' ? mappings.images : mappings.links
    const conflicts = change.kind === 'image' ? mappings.imageConflicts : mappings.linkConflicts
    setLinkMapping(map, conflicts, change.original, change.next)
  }
  return mappings
}

function replaceAnchorHrefs(text, mappings) {
  return text.replace(/(<a\b[^>]*\bhref\s*=\s*)(["'])([^"']+)\2/gi,
    (full, prefix, quote, href) => mappings.has(href)
      ? `${prefix}${quote}${mappings.get(href)}${quote}`
      : full)
}

function applyLinkDataUpdates(data, linkdata) {
  const mappings = collectLinkMappings(linkdata)
  let changed = false
  walkNodes(data, node => {
    const nodeData = node.data || {}
    if (mappings.links.has(nodeData.hyperlink)) {
      nodeData.hyperlink = mappings.links.get(nodeData.hyperlink)
      changed = true
    }
    if (mappings.images.has(nodeData.image)) {
      nodeData.image = mappings.images.get(nodeData.image)
      changed = true
    }
    if (typeof nodeData.text === 'string') {
      const text = replaceAnchorHrefs(nodeData.text, mappings.links)
      if (text !== nodeData.text) {
        nodeData.text = text
        changed = true
      }
    }
  })
  return changed
}

function collectTextData(data, supportObSearch) {
  if (!supportObSearch) return []
  const textdata = []
  walkNodes(data, node => {
    const nodeData = node.data || {}
    textdata.push(`${plainText(nodeData.text)} ^${nodeData.uid}`)
  })
  return textdata
}

function buildDocument(data, metadata, options) {
  const content = LZString.compressToBase64(JSON.stringify(data))
  const svgdata = String(options.svgdata == null ? '' : options.svgdata)
  const svgdataUpdateAt = String(options.svgdataUpdateAt == null ? '' : options.svgdataUpdateAt)
  const linkdata = collectLinkData(data)
  const textdata = collectTextData(data, options.supportObSearch !== false)
  const safeMetadata = normalizeMetadata(metadata)

  let output = '---\n'
  output += `path: ${safeMetadata.path}\n`
  output += 'tags:\n'
  safeMetadata.tags.forEach(tag => { output += `  - ${tag}\n` })
  if (safeMetadata.yaml) {
    output += safeMetadata.yaml
    if (!output.endsWith('\n')) output += '\n'
  }
  output += '---\n'
  output += `> ${MODIFY_TIP}\n`
  output += '# metadata\n'
  output += '```metadata\n'
  output += content
  output += '\n```\n'
  output += '# svgdata\n'
  if (svgdata && /^!\[\[/.test(svgdata)) {
    output += `${svgdata}\n`
    output += `> updateAt: ${svgdataUpdateAt}\n`
  } else {
    output += '```svgData\n'
    output += `${svgdata}\n`
    output += '```\n'
  }
  output += '# linkdata\n'
  linkdata.forEach(link => { output += `- ${link}\n` })
  output += '# textdata\n'
  output += textdata.join('\n\n')
  return output
}

function createDocument(data, options = {}) {
  const safeData = validateData(data)
  return buildDocument(safeData, { path: options.path || '', tags: [], yaml: '' }, {
    svgdata: options.svgdata,
    svgdataUpdateAt: options.svgdataUpdateAt,
    supportObSearch: options.supportObSearch !== false
  })
}

function serializeDocument(raw, data, options = {}) {
  const parsed = parseDocument(raw)
  const safeData = validateData(data)
  const metadata = {
    ...parsed.metadata,
    path: resolveOption(options, 'path', parsed.metadata.path),
    tags: parsed.metadata.tags,
    yaml: parsed.metadata.yaml
  }
  return buildDocument(safeData, metadata, {
    svgdata: resolveOption(options, 'svgdata', parsed.svgdata),
    svgdataUpdateAt: resolveOption(options, 'svgdataUpdateAt', parsed.svgdataUpdateAt),
    supportObSearch: resolveOption(options, 'supportObSearch', true)
  })
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
  createDocument,
  parseDocument,
  serializeDocument,
  isMindMapDocument
}
