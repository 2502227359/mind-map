const test = require('node:test')
const assert = require('node:assert/strict')
const esbuild = require('../../web/node_modules/esbuild')
const Module = require('node:module')
const path = require('node:path')

async function load() {
  const filename = path.resolve(__dirname, '../src/document/focus.js')
  const result = await esbuild.build({ entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs', write: false })
  const mod = new Module(filename, module)
  mod._compile(result.outputFiles[0].text, filename)
  return mod.exports.FocusSession
}

const node = (uid, children = [], extra = {}) => ({ data: { uid, text: uid, ...extra }, children })
test('聚焦保存保留兄弟、游离树、位置和图像，重复捕获不累积游离树', async () => {
  const FocusSession = await load()
  const original = { root: { ...node('root', [node('a', [node('b')], { expand: false }), node('sibling')], { imgMap: { outside: 'image' }, freeNodeTrees: [node('free', [], { customLeft: 200 })] }), smmVersion: '0.14.0-fix.3' }, layout: 'mindMap', theme: { template: 'default' }, view: { scale: 1 } }
  const snapshot = JSON.stringify(original)
  const session = new FocusSession(original, 'a')
  const focused = session.open()
  assert.equal(focused.root.smmVersion, original.root.smmVersion)
  focused.root.data.text = '已修改'
  focused.root.data.imgMap = { inside: 'new' }
  focused.root.data.freeNodeTrees = [node('detached')]
  const merged = session.merge(focused)
  assert.equal(merged.root.children[0].data.text, '已修改')
  assert.equal(merged.root.children[0].data.expand, false)
  assert.equal(merged.root.children[1].data.uid, 'sibling')
  assert.deepEqual(merged.root.data.imgMap, { outside: 'image', inside: 'new' })
  assert.deepEqual(session.merge(focused).root.data.freeNodeTrees.map(x => x.data.uid), ['free', 'detached'])
  assert.equal(JSON.stringify(original), snapshot)
})

test('聚焦游离树保留坐标，布局修改只作用于该游离树', async () => {
  const FocusSession = await load()
  const session = new FocusSession({ root: node('root', [], { freeNodeTrees: [node('free', [], { customLeft: 90 })] }), layout: 'mindMap', theme: {} }, 'free')
  const focused = session.open()
  focused.layout = 'fishbone'
  const full = session.merge(focused)
  assert.equal(full.layout, 'mindMap')
  assert.equal(full.root.data.freeNodeTrees[0].data.layout, 'fishbone')
  assert.equal(full.root.data.freeNodeTrees[0].data.customLeft, 90)
})
