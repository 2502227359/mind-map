const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const esbuild = require('../../web/node_modules/esbuild')

async function load(relative) {
  global.window ||= { addEventListener() {}, removeEventListener() {} }
  global.document ||= { body: {}, documentElement: {}, createElement: () => ({ style: {} }) }
  const result = await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../..', relative)], bundle: true,
    platform: 'node', format: 'cjs', write: false, logLevel: 'silent',
    nodePaths: [path.resolve(__dirname, '../../web/node_modules')]
  })
  const item = { exports: {} }
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(item, item.exports, require)
  return item.exports
}

test('按层级和后代选择覆盖所有根，直接子节点与全部后代明确区分', async () => {
  const { collectLevelNodes, collectDescendantNodes } = await load('simple-mind-map/src/core/render/selection.js')
  const grandchild = { uid: 'grandchild', layerIndex: 2, children: [] }
  const child = { uid: 'child', layerIndex: 1, children: [grandchild] }
  const first = { uid: 'first', layerIndex: 0, children: [child] }
  const secondChild = { uid: 'second-child', layerIndex: 1, children: [] }
  const second = { uid: 'second', layerIndex: 0, children: [secondChild] }
  assert.deepEqual(collectLevelNodes([first, second], 2).map(n => n.uid), ['child', 'second-child'])
  assert.deepEqual(collectDescendantNodes([first], false, true).map(n => n.uid), ['child'])
  assert.deepEqual(collectDescendantNodes([first, child], true).map(n => n.uid), ['first', 'child', 'grandchild'])
})

test('多根保存剥离运行时节点引用，保留游离树文字和位置', async () => {
  global.window = { addEventListener() {}, removeEventListener() {} }
  global.document = { body: {}, documentElement: {}, createElement: () => ({ style: {} }) }
  const { copyRenderTree, copyNodeTree } = await load('simple-mind-map/src/utils/index.js')
  const free = { data: { text: '游离根', customLeft: 0, customTop: 180, isActive: true }, children: [] }
  free._node = { nodeData: free }
  const root = { data: { text: '主根', freeNodeTrees: [free] }, children: [] }
  const data = copyRenderTree({}, root, true)
  assert.equal(data.data.freeNodeTrees[0].data.text, '游离根')
  assert.equal(data.data.freeNodeTrees[0].data.customLeft, 0)
  assert.equal(data.data.freeNodeTrees[0].data.isActive, false)
  assert.doesNotThrow(() => JSON.stringify(data))
  const clipboard = copyNodeTree({}, root, true)
  assert.equal(clipboard.data.freeNodeTrees[0].data.customLeft, 0)
  assert.doesNotThrow(() => JSON.stringify(clipboard))
})


test('游离根的新建与独立布局写入权威树且保留零坐标', async () => {
  const { default: FreeNode } = await load('simple-mind-map/src/plugins/FreeNode.js')
  const commands = new Map()
  const root = { left: 100, top: 100 }
  const renderer = { root, renderTree: { data: { text: '主根' }, children: [] }, clearActiveNodeList() {} }
  const mindMap = {
    opt: { layout: 'logicalStructure' }, renderer,
    command: { add: (key, fn) => commands.set(key, fn), remove: key => commands.delete(key) },
    render() {}
  }
  const plugin = new FreeNode({ mindMap })
  commands.get('INSERT_FREE_NODE')({ text: '游离' }, { x: 0, y: 0 })
  const free = renderer.renderTree.data.freeNodeTrees[0]
  assert.equal(free.data.customLeft, 0)
  assert.equal(free.data.customTop, 0)
  assert.equal(free.data.text, '游离')
  const node = { nodeData: free }
  commands.get('SET_FREE_NODE_TREE_LAYOUT')([node], 'timeline')
  assert.equal(free.data.layout, 'timeline')
    commands.get('SET_FREE_NODE_TREE_LAYOUT')([node], null)
    assert.equal(Object.hasOwn(free.data, 'layout'), false)
    mindMap.opt.readonly = true
    commands.get('SET_FREE_NODE_TREE_LAYOUT')([node], 'timeline')
    assert.equal(Object.hasOwn(free.data, 'layout'), false)
  plugin.beforePluginDestroy()
  assert.equal(commands.size, 0)
})


test('复合节点命令只生成一条撤销记录', async () => {
  const { default: Command } = await load('simple-mind-map/src/core/command/Command.js')
  const command = Object.create(Command.prototype)
  command.commands = {}
  command.mindMap = { emit() {} }
  const state = { a: 0, b: 0 }
  const history = [{ ...state }]
  command.addHistory = () => history.push({ ...state })
  command.add('A', () => { state.a = 1 })
  command.add('B', () => { state.b = 2 })
  command.add('PAIR', () => { command.exec('A'); command.exec('B') })
  command.exec('PAIR')
  assert.equal(history.length, 2)
  assert.deepEqual(history[history.length - 2], { a: 0, b: 0 })
})

test('未等异步渲染的连续跨树移动不重复或丢失节点', async () => {
  const { default: Render } = await load('simple-mind-map/src/core/render/Render.js')
  const { default: FreeNode } = await load('simple-mind-map/src/plugins/FreeNode.js')
  const create = uid => {
    const node = { uid, nodeData: { data: { uid, text: uid }, children: [] }, children: [], left: 10, top: 20 }
    node.getLayout = () => ({ layout: 'logicalStructure' })
    return node
  }
  const root = create('main'), free = create('free'), child = create('child')
  root.isRoot = free.isRoot = true
  child.parent = root
  root.children = [child]
  root.nodeData.children = [child.nodeData]
  root.nodeData.data.freeNodeTrees = [free.nodeData]
  const renderer = Object.create(Render.prototype)
  renderer.root = root
  renderer.renderTree = root.nodeData
  renderer.activeNodeList = []
  renderer.emitNodeActiveEvent = () => {}
  renderer.mindMap = { opt: {}, renderer, render() {}, command: { add() {} } }
  const plugin = new FreeNode({ mindMap: renderer.mindMap })
  plugin.detach([child])
  assert.equal(child.parent, null)
  assert.equal(root.children.length, 0)
  renderer.moveNodeTo(child, free)
  renderer.moveNodeTo(child, root)
  assert.equal(root.nodeData.data.freeNodeTrees.length, 1)
  assert.equal(root.children[0], child)
  assert.equal(child.parent, root)
  assert.equal(free.children.length, 0)
  assert.equal(free.nodeData.children.length, 0)
  assert.equal(root.nodeData.children.length, 1)
})

test('异步布局队列失效后不再执行后续任务', async () => {
  const { asyncRun } = await load('simple-mind-map/src/utils/index.js')
  const seen = []
  let alive = true
  asyncRun([() => { seen.push(1); alive = false }, () => seen.push(2)], undefined, () => alive)
  await new Promise(resolve => setTimeout(resolve, 15))
  assert.deepEqual(seen, [1])
})
