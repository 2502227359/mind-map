const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const esbuild = require('../../web/node_modules/esbuild')

test('填空只隐藏渲染答案，逐个显示、导出恢复和退出不会改正文', async () => {
  const result = await esbuild.build({ entryPoints: [path.resolve(__dirname, '../src/blank-mode.js')], bundle: true, platform: 'node', format: 'cjs', write: false })
  const module = { exports: {} }
  new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports)
  const answers = [1, 2].map(() => ({ style: { visibility: '' }, parentElement: { closest: () => null } }))
  const node = { uid: 'a', data: { text: '<u>答案一</u><u>答案二</u>' }, _textData: { node: { node: { querySelectorAll: () => answers } } }, children: [] }
  const before = JSON.stringify(node.data)
  const events = new Map()
  const mindMap = { opt: { readonly: false }, setMode(mode) { this.opt.readonly = mode === 'readonly' }, renderer: { getAllRenderRoot: () => [node] }, on: (name, fn) => events.set(name, fn), off: name => events.delete(name) }
  const mode = new module.exports.BlankMode(mindMap)
  assert.equal(mindMap.opt.readonly, true)
  assert.deepEqual(answers.map(x => x.style.visibility), ['hidden', 'hidden'])
  mode.reveal(node)
  assert.deepEqual(answers.map(x => x.style.visibility), ['', 'hidden'])
  events.get('before_get_svg_data')()
  assert.deepEqual(answers.map(x => x.style.visibility), ['', ''])
  events.get('after_get_svg_data')()
  assert.equal(answers[1].style.visibility, 'hidden')
  mode.dispose()
  assert.equal(mindMap.opt.readonly, false)
  assert.equal(events.size, 0)
  assert.equal(JSON.stringify(node.data), before)
  assert.deepEqual(answers.map(x => x.style.visibility), ['', ''])
})
