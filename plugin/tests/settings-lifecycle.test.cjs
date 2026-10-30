const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const parser = require('../../web/node_modules/@babel/parser')

function sourceOf(file) {
  const source = fs.readFileSync(path.resolve(__dirname, '../reference', file), 'utf8')
  return file.endsWith('.vue') ? source.split('<script>')[1].split('</script>')[0] : source
}

function methodOf(file, name, dependencies = {}) {
  const source = sourceOf(file)
  const ast = parser.parse(source, { sourceType: 'module' })
  let method
  function walk(node) {
    if (!node || typeof node !== 'object' || method) return
    if (['ObjectMethod', 'ClassMethod'].includes(node.type) && node.key.name === name) method = node
    else Object.values(node).forEach(value => Array.isArray(value) ? value.forEach(walk) : walk(value))
  }
  walk(ast)
  assert.ok(method, `缺少实际方法 ${file}:${name}`)
  return Function(...Object.keys(dependencies), `return ({${source.slice(method.start, method.end)}}).${name}`)(...Object.values(dependencies))
}

test('大纲模式修改保存间隔会重排待保存任务，执行和手动保存后不留旧计时', () => {
  let pending
  let delay
  let saved = 0
  const timers = {
    setTimeout(fn, ms) { pending = fn; delay = ms; return 1 },
    clearTimeout() { pending = null }
  }
  const file = 'src/pages/Edit/components/OutlineEdit.vue'
  const vm = { autoSaveTimer: null, autoSaveTime: 20, $root: { $bus: { $emit() {} } }, saveToLocal() { saved++ } }
  for (const name of ['autoSave', 'clearAutoSave', 'manuallySave']) vm[name] = methodOf(file, name, timers).bind(vm)
  vm.autoSave()
  assert.equal(delay, 20000)
  vm.autoSaveTime = 1
  methodOf(file, 'autoSaveTime').call(vm)
  assert.equal(delay, 1000)
  pending()
  assert.equal(saved, 1)
  assert.equal(vm.autoSaveTimer, null)
  vm.autoSave()
  vm.manuallySave()
  assert.equal(pending, null)
  assert.equal(vm.autoSaveTimer, null)
  assert.equal(saved, 2)
})

function overlayHarness(read) {
  let destroyed = 0
  let mounted = 0
  let closed = 0
  const editor = { $store: { state: { localConfig: { isDark: false, autoSaveTime: 5 } }, commit(name, config) { Object.assign(this.state.localConfig, config) } }, $bus: { $on() {} }, $destroy() { destroyed++ } }
  const plugin = { app: { vault: { read }, workspace: { getLeavesOfType: () => [] } }, settings: { themeMode: 'light' }, _markdownOverlays: new Set(), _mdToMindmapData: async value => value, _getObIsDark: () => false }
  const document = { createElement: () => ({ appendChild() {}, classList: { add() {} }, remove() {} }), body: { appendChild() {}, removeChild() {} } }
  const source = sourceOf('ob/PreviewMindMap.js').replace(/^import .*\r?\n/gm, '').replace('export class', 'class')
  const getMindMapLocalConfig = () => ({ isDark: plugin.settings.themeMode === 'dark', autoSaveTime: 5 })
  const Preview = Function('document', 'initPreviewModeApp', 'getMindMapLocalConfig', 'Notice', `${source}; return PreviewMindMap`)(document, () => { mounted++; return editor }, getMindMapLocalConfig, class Notice {})
  const overlay = new Preview({ plugin, file: {}, onClose() { closed++ } })
  return { plugin, overlay, editor, getMindMapLocalConfig, counts: () => ({ mounted, destroyed, closed }) }
}

test('旧悬浮预览参加活动设置刷新，关闭后移除注册且仅销毁一次', async () => {
  const h = overlayHarness(async () => '合成 Markdown')
  await new Promise(resolve => setImmediate(resolve))
  h.plugin.settings.themeMode = 'dark'
  methodOf('main.js', '_refreshEditorSettings', { getMindMapLocalConfig: h.getMindMapLocalConfig, SMM_VIEW_TYPE: 'map', MARKDOWN_MAP_PREVIEW: 'preview' }).call(h.plugin)
  assert.equal(h.editor.$store.state.localConfig.isDark, true)
  assert.equal(h.plugin._markdownOverlays.size, 1)
  h.overlay._close()
  h.overlay._close()
  assert.equal(h.plugin._markdownOverlays.size, 0)
  assert.deepEqual(h.counts(), { mounted: 1, destroyed: 1, closed: 1 })
})

test('读取未完成时关闭旧悬浮预览，不再延迟挂载编辑器', async () => {
  let finish
  const h = overlayHarness(() => new Promise(resolve => { finish = resolve }))
  h.overlay._close()
  finish('合成 Markdown')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(h.counts(), { mounted: 0, destroyed: 0, closed: 1 })
  assert.equal(h.plugin._markdownOverlays.size, 0)
})

test('悬浮预览读取失败时清理空容器和注册实例', async () => {
  const h = overlayHarness(async () => { throw new Error('文件已删除') })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.overlay.closed, true)
  assert.equal(h.overlay.container, null)
  assert.equal(h.plugin._markdownOverlays.size, 0)
})

test('大纲普通文本失焦后，保存捕获使用实际编辑内容', () => {
  const onBlur = methodOf('src/pages/Edit/components/OutlineEdit.vue', 'onBlur')
  const node = { data: { textCache: '旧文本', data: { richText: false, text: '旧文本' } } }
  let scheduled = false
  onBlur.call({ autoSave() { scheduled = true } }, { target: { innerHTML: '新文本', innerText: '新文本' } }, node)
  assert.equal(node.data.data.text, '新文本')
  assert.equal(scheduled, true)
})
