'use strict'

const normalize = text => String(text).replace(/\r\n/g, '\n').trim()

// 只识别顶层围栏；缩进、引用和列表内的代码块拒绝写入，避免破坏 Markdown 结构。
function findCodeBlocks(raw) {
  const lines = raw.match(/[^\n]*\n|[^\n]+$/g) || []
  const blocks = []
  let open = null
  let offset = 0
  lines.forEach((line, index) => {
    const text = line.replace(/\r?\n$/, '')
    if (!open) {
      const match = text.match(/^(`{3,}|~{3,})([^`]*)$/)
      if (match) open = { fence: match[1], language: match[2].trim(), lineStart: index, start: offset + line.length }
    } else if (new RegExp(`^${open.fence[0]}{${open.fence.length},}\\s*$`).test(text)) {
      if (open.language === 'smm') blocks.push({ ...open, end: offset, source: raw.slice(open.start, offset) })
      open = null
    }
    offset += line.length
  })
  return blocks
}

function replaceCodeBlock(raw, locator, content) {
  const matches = findCodeBlocks(raw).filter(block => normalize(block.source) === normalize(locator.source))
  const previous = locator.document == null ? [] : findCodeBlocks(locator.document)
    .filter(block => normalize(block.source) === normalize(locator.source))
  if (previous.length > 1 && locator.document !== raw) throw new Error('多个相同导图所在笔记已被修改，无法安全定位')
  if (!matches.length) throw new Error('导图代码块已被外部修改或删除，已停止保存')
  const target = matches.length === 1 ? matches[0] : matches.find(block => block.lineStart === locator.lineStart)
  if (!target) throw new Error('存在多个相同导图，无法安全定位保存位置')
  const newline = raw.includes('\r\n') ? '\r\n' : '\n'
  const body = String(content).replace(/\r\n/g, '\n').replace(/\n/g, newline)
  return raw.slice(0, target.start) + body + newline + raw.slice(target.end)
}

module.exports = { findCodeBlocks, replaceCodeBlock }
