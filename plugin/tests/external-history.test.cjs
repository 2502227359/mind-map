const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const parser = require('../../web/node_modules/@babel/parser')

// 直接执行实际方法，避免复制“外部替换应清历史”的实现来制造假回归。
function readMethod(relative, name, required = true) {
  let source = fs.readFileSync(path.resolve(__dirname, '../..', relative), 'utf8')
  if (relative.endsWith('.vue')) source = source.split('<script>')[1].split('</script>')[0]
  const ast = parser.parse(source, { sourceType: 'module' })
  let found
  const walk = node => {
    if (!node || typeof node !== 'object' || found) return
    if (['ObjectMethod', 'ClassMethod'].includes(node.type) && node.key.name === name) found = node
    else Object.values(node).forEach(value => Array.isArray(value) ? value.forEach(walk) : walk(value))
  }
  walk(ast)
  if (!found && !required) return null
  assert.ok(found, `缺少实际方法 ${name}`)
  return new Function('isSameObject', `return ({${source.slice(found.start, found.end)}}).${name}`)(
    (left, right) => JSON.stringify(left) === JSON.stringify(right)
  )
}

test('聚焦中接收外部全图后，撤销和保存不能退回子树快照', () => {
  const core = 'simple-mind-map/index.js'
  const commandFile = 'simple-mind-map/src/core/command/Command.js'
  const branch = { data: { uid: 'branch' }, children: [] }
  const full = { data: { uid: 'root' }, children: [branch, { data: { uid: 'sibling' }, children: [] }] }
  let pending
  const m = {
    opt: { readonly: false, maxHistoryCount: 100 },
    renderer: { renderTree: branch, setData(root) { this.renderTree = root } },
    handleData: root => root, emit() {}, render() {}, reRender() {}, execCommand() {},
    getLayout: () => 'mindMap',
    updateData: readMethod(core, 'updateData'), setData: readMethod(core, 'setData')
  }
  const command = {
    mindMap: m, history: [JSON.stringify(branch)], activeHistoryIndex: 0,
    getCopyData: () => structuredClone(m.renderer.renderTree), emitDataUpdatesEvent() {},
    clearHistory: readMethod(commandFile, 'clearHistory'), back: readMethod(commandFile, 'back'),
    addHistory: () => { pending = () => readMethod(commandFile, 'addHistory').call(command) }
  }
  command.addHistory.cancel = () => { pending = null }
  m.command = command
  const vm = {
    mindMap: m, focusSession: {}, focusLabel: 'branch',
    cancelModeSwitch: readMethod('plugin/reference/src/mixins/editorModes.js', 'cancelModeSwitch'),
    resetModes: readMethod('plugin/reference/src/mixins/editorModes.js', 'resetModes'),
    updateMindMapData(data) { this.document = data }
  }
  readMethod('plugin/reference/src/pages/Edit/components/Edit.vue', 'onUpdateMindMapDataFromOb')
    .call(vm, JSON.stringify({ root: full, layout: 'mindMap' }))
  pending?.()
  const previous = command.back()
  if (previous) m.renderer.setData(previous)
  assert.equal(m.renderer.renderTree.data.uid, 'root')
  assert.equal(m.renderer.renderTree.children[1].data.uid, 'sibling')
  assert.deepEqual(command.history.map(raw => JSON.parse(raw).data.uid), ['root'])
})

test('外部更新取消未完成的聚焦切换，期间捕获不返回旧快照且不写旧历史', async () => {
  const file = 'plugin/reference/src/mixins/editorModes.js'
  const full = { root: { data: { uid: 'root' }, children: [{ data: { text: '旧内容' } }] } }
  const incoming = structuredClone(full)
  incoming.root.children[0].data.text = '外部新内容'
  let data = full
  let added = 0
  const events = new Map()
  const command = { addHistory: Object.assign(() => {}, { cancel() {} }), pause() {}, recovery() {}, originAddHistory() { added++ } }
  const vm = {
    mindMap: { command, on: (key, fn) => events.set(key, fn), off: key => events.delete(key), setFullData(next) { data = next }, getData: () => data },
    focusSession: { merge: () => structuredClone(full) }, includeRainbowLinesConfig: value => value,
    currentDocument: readMethod(file, 'currentDocument'), resetModes: readMethod(file, 'resetModes'),
    cancelModeSwitch() { readMethod(file, 'cancelModeSwitch', false)?.call(this) }
  }
  const switching = readMethod(file, 'replaceModeDocument').call(vm, { root: { data: { uid: 'branch' } } })
  vm.resetModes()
  data = incoming
  const during = vm.currentDocument()
  events.get('node_tree_render_end')?.()
  await switching
  assert.equal(during.root.children[0].data.text, '外部新内容')
  assert.equal(added, 0)
  assert.equal(events.size, 0)
  assert.equal(vm.modeSwitching, false)
})
