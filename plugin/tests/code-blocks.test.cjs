const test = require('node:test')
const assert = require('node:assert/strict')
const { replaceCodeBlock } = require('../src/document/code-block.js')

test('代码块保存保留外围正文及换行，并按行号区分相同导图', () => {
  const raw = '开头\r\n```smm\r\n{"root":1}\r\n```\r\n中间\r\n```smm\r\n{"root":1}\r\n```\r\n结尾'
  const next = replaceCodeBlock(raw, { source: '{"root":1}', lineStart: 5 }, '{"root":2}')
  assert.equal(next, raw.replace('中间\r\n```smm\r\n{"root":1}', '中间\r\n```smm\r\n{"root":2}'))
})

test('代码块发生外部修改或定位歧义时拒绝写入', () => {
  assert.throws(() => replaceCodeBlock('```smm\nchanged\n```', { source: 'old', lineStart: 0 }, 'new'), /修改/)
  assert.throws(() => replaceCodeBlock('```smm\na\n```\n```smm\na\n```', { source: 'a' }, 'new'), /定位/)
  assert.throws(() => replaceCodeBlock('```smm\na\n```\n```smm\na\n```', { source: 'a', lineStart: 8 }, 'new'), /定位/)
  assert.throws(() => replaceCodeBlock('```smm\na\n```', {
    source: 'a', lineStart: 0, document: '```smm\na\n```\n```smm\na\n```'
  }, 'new'), /定位/)
})

test('嵌套围栏不被误认作可写导图，唯一目标移动后可安全保存', () => {
  const raw = '````text\n```smm\nfake\n```\n````\n正文\n~~~smm\nreal\n~~~\n'
  assert.throws(() => replaceCodeBlock(raw, { source: 'fake' }, 'x'), /修改/)
  assert.equal(replaceCodeBlock(raw, { source: 'real', lineStart: 0 }, 'new'), raw.replace('real', 'new'))
})
