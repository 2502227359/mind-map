const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('../../web/node_modules/esbuild')

const repoRoot = path.resolve(__dirname, '../..')
const nodeModules = path.join(repoRoot, 'web/node_modules')

async function loadBundled(entryPoint) {
  const entry = path.join(repoRoot, entryPoint)
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    nodePaths: [nodeModules],
    logLevel: 'silent'
  })
  const compiledModule = new Module(entry, module)
  compiledModule.filename = entry
  compiledModule.paths = Module._nodeModulePaths(path.dirname(entry))
  compiledModule._compile(result.outputFiles[0].text, entry)
  return compiledModule.exports
}

const createEventMock = () => {
  const listeners = new Map()
  return {
    listeners,
    on(name, handler) {
      listeners.set(name, handler)
    },
    off(name, handler) {
      if (listeners.get(name) === handler) listeners.delete(name)
    },
    emit(name, ...args) {
      const handler = listeners.get(name)
      if (handler) handler(...args)
    }
  }
}

test('扩展节点形状保持参考插件的 13 个公开名称，并可完整卸载', async () => {
  const module = await loadBundled('simple-mind-map/src/plugins/MoreShapes.js')
  assert.equal(module.moreShapeNames.length, 13)
  assert.equal(new Set(module.moreShapeNames).size, 13)
  const added = []
  const removed = []
  const plugin = new module.default({
    mindMap: {
      addShape(shape) {
        added.push(shape)
      },
      removeShape(name) {
        removed.push(name)
      }
    }
  })
  assert.deepEqual(added.map(shape => shape.name), module.moreShapeNames)
  plugin.beforePluginRemove()
  assert.deepEqual(removed, module.moreShapeNames)
})

test('同级自动对齐只给未被手动改宽的节点写入自定义宽度', async () => {
  const module = await loadBundled('simple-mind-map/src/plugins/NodeAutoAlign.js')
  const root = {
    data: { uid: 'root', text: '根' },
    children: [
      { data: { uid: 'a', text: '甲' }, children: [] },
      { data: { uid: 'b', text: '乙', customTextWidth: 260 }, children: [] }
    ]
  }
  const events = createEventMock()
  const commands = new Map()
  const mindMap = {
    opt: { enableAutoNodeAlign: true, nodeInitialAutoAlignWidth: 200, textContentMargin: 2 },
    themeConfig: { iconSize: 20 },
    renderer: { renderTree: root },
    on: events.on,
    off: events.off,
    command: {
      add(name, fn) {
        commands.set(name, fn)
      },
      remove(name) {
        commands.delete(name)
      }
    },
    render() {}
  }
  const plugin = new module.default({ mindMap })
  assert.equal(root.children[0].data.customTextWidth, 260)
  assert.equal(root.children[1].data.customTextWidth, 260)
  root.children[0].data.customTextWidth = 220
  plugin.onManualWidthChange({ getData: () => root.children[0].data })
  plugin.toAlign()
  assert.equal(root.children[0].data.customTextWidth, 220)
  assert.ok(commands.has('TO_SAME_LAYERINDEX_NODE_ALIGN'))
  plugin.beforePluginDestroy()
  assert.equal(commands.size, 0)
})

test('同级自动对齐命令会处理所有独立导图树', async () => {
  const module = await loadBundled('simple-mind-map/src/plugins/NodeAutoAlign.js')
  const createRoot = prefix => ({
    data: { uid: `${prefix}-root`, text: prefix },
    children: [
      { data: { uid: `${prefix}-a`, text: '甲' }, children: [] },
      { data: { uid: `${prefix}-b`, text: '乙' }, children: [] }
    ]
  })
  const roots = [createRoot('first'), createRoot('second')]
  const events = createEventMock()
  const mindMap = {
    opt: { enableAutoNodeAlign: true, nodeInitialAutoAlignWidth: 200 },
    themeConfig: { iconSize: 20 },
    renderer: { getAllRenderTree: () => roots },
    on: events.on,
    off: events.off,
    command: { add() {}, remove() {} },
    render() {}
  }
  const plugin = new module.default({ mindMap })
  roots[0].children[0].data.customTextWidth = 230
  roots[1].children[0].data.customTextWidth = 240
  plugin.toAlign()
  assert.equal(roots[0].children[1].data.customTextWidth, 230)
  assert.equal(roots[1].children[1].data.customTextWidth, 240)
  plugin.beforePluginDestroy()
})

test('自动对齐宽度标记可跨保存重开，并保留真正手工宽度', async () => {
  const module = await loadBundled('simple-mind-map/src/plugins/NodeAutoAlign.js')
  const createMindMap = root => {
    const events = createEventMock()
    return {
      opt: { enableAutoNodeAlign: true, nodeInitialAutoAlignWidth: 200 },
      themeConfig: { iconSize: 20 },
      renderer: { renderTree: root },
      on: events.on,
      off: events.off,
      command: { add() {}, remove() {} },
      render() {}
    }
  }
  const root = {
    data: { uid: 'saved-root' },
    children: [
      { data: { uid: 'saved-a' }, children: [] },
      { data: { uid: 'saved-b' }, children: [] }
    ]
  }
  const firstPlugin = new module.default({ mindMap: createMindMap(root) })
  assert.equal(root.children[0].data.autoAlignWidth, 200)
  assert.equal(root.children[1].data.autoAlignWidth, 200)
  const reopenedRoot = JSON.parse(JSON.stringify(root))
  firstPlugin.beforePluginDestroy()

  const secondPlugin = new module.default({ mindMap: createMindMap(reopenedRoot) })
  reopenedRoot.children[0].data.customTextWidth = 260
  delete reopenedRoot.children[0].data.autoAlignWidth
  secondPlugin.onManualWidthChange({
    getData: () => reopenedRoot.children[0].data
  })
  secondPlugin.toAlign()
  assert.equal(reopenedRoot.children[0].data.customTextWidth, 260)
  assert.equal(reopenedRoot.children[0].data.autoAlignWidth, undefined)
  assert.equal(reopenedRoot.children[1].data.customTextWidth, 260)
  assert.equal(reopenedRoot.children[1].data.autoAlignWidth, 260)

  secondPlugin.removeAlignment()
  assert.equal(reopenedRoot.children[0].data.customTextWidth, 260)
  assert.equal(reopenedRoot.children[0].data.autoAlignWidth, undefined)
  assert.equal(reopenedRoot.children[1].data.customTextWidth, undefined)
  assert.equal(reopenedRoot.children[1].data.autoAlignWidth, undefined)
  secondPlugin.beforePluginDestroy()
})

test('只读模式下自动对齐不修改节点数据', async () => {
  const module = await loadBundled('simple-mind-map/src/plugins/NodeAutoAlign.js')
  const root = {
    data: { uid: 'readonly-root' },
    children: [
      { data: { uid: 'readonly-a' }, children: [] },
      { data: { uid: 'readonly-b' }, children: [] }
    ]
  }
  const events = createEventMock()
  const mindMap = {
    opt: {
      readonly: true,
      enableAutoNodeAlign: true,
      nodeInitialAutoAlignWidth: 200
    },
    themeConfig: { iconSize: 20 },
    renderer: { renderTree: root },
    on: events.on,
    off: events.off,
    command: { add() {}, remove() {} },
    render() {}
  }
  const plugin = new module.default({ mindMap })
  plugin.toAlign()
  plugin.removeAlignment()
  assert.equal(root.children[0].data.customTextWidth, undefined)
  assert.equal(root.children[1].data.customTextWidth, undefined)
  plugin.beforePluginDestroy()
})

test('动量速度计算有上限且卸载后停止监听', async () => {
  const module = await loadBundled('simple-mind-map/src/plugins/Momentum.js')
  assert.deepEqual(module.clampVelocity({ x: 100, y: -100 }), { x: 80, y: -80 })
  assert.deepEqual(module.decayVelocity({ x: 10, y: -5 }, 0.5), { x: 5, y: -2.5 })
  const events = createEventMock()
  const plugin = new module.default({
    mindMap: {
      opt: { useLeftKeySelectionRightKeyDrag: false },
      view: { translateXY() {} },
      on: events.on,
      off: events.off
    }
  })
  assert.ok(events.listeners.has('mousedown'))
  plugin.beforePluginRemove()
  assert.equal(events.listeners.size, 0)
})

test('连线流动动画正确计算奇数虚线序列总长度', async () => {
  const module = await loadBundled('simple-mind-map/src/plugins/LineFlow.js')
  assert.equal(module.getDasharrayTotal('6,4'), 10)
  assert.equal(module.getDasharrayTotal('3'), 6)
  assert.equal(module.getDasharrayTotal('1,2,3'), 12)
  assert.equal(module.getDasharrayTotal('none'), 0)
})

test('连线流动插件卸载时清理所有树的动画类和样式', async () => {
  const module = await loadBundled('simple-mind-map/src/plugins/LineFlow.js')
  const state = { removed: [], cssKeys: [] }
  const createLine = className => ({
    attr(name, value) {
      if (arguments.length === 1) return name === 'data-move-class-name' ? className : ''
      if (name === 'data-move-class-name') className = value
    },
    removeClass(name) {
      state.removed.push(name)
    }
  })
  const firstLine = createLine('smm-line-move-first')
  const secondLine = createLine('smm-line-move-second')
  const mindMap = {
    opt: { customHandleLine: null },
    renderer: {
      getAllRenderRoot: () => [
        { _lines: [firstLine], children: [] },
        { _lines: [], children: [{ _lines: [secondLine], children: [] }] }
      ]
    },
    removeAppendCss(key) {
      state.cssKeys.push(key)
    },
    appendCss() {}
  }
  const plugin = new module.default({ mindMap })
  plugin.beforePluginRemove()
  assert.deepEqual(state.removed, [
    'smm-line-move-first',
    'smm-line-move-second'
  ])
  assert.equal(firstLine.attr('data-move-class-name'), '')
  assert.equal(secondLine.attr('data-move-class-name'), '')
  assert.deepEqual(state.cssKeys, ['lineFlowPluginStyle'])
})

test('手绘插件移除时重绘以清除已生成的草绘路径', async () => {
  const module = await loadBundled('simple-mind-map/src/plugins/HandDrawnLikeStyle.js')
  let resetCount = 0
  let renderCount = 0
  const plugin = Object.create(module.default.prototype)
  plugin.enabled = true
  plugin.syncTheme = () => {}
  plugin.reset = () => {
    resetCount += 1
  }
  plugin.mindMap = {
    off() {},
    reRender() {
      renderCount += 1
    }
  }
  plugin.beforePluginRemove()
  assert.equal(resetCount, 1)
  assert.equal(renderCount, 1)
  plugin.enabled = true
  plugin.beforePluginDestroy()
  assert.equal(resetCount, 2)
  assert.equal(renderCount, 1)
})

test('图片按可视区域加载，并在插件卸载时恢复完整图片', async () => {
  const module = await loadBundled('simple-mind-map/src/plugins/LazyLoadImg.js')
  const loaded = []
  let visible = true
  const node = {
    _imgData: { node: { load: value => loaded.push(value) } },
    getImageUrl: () => 'https://example.test/image.png',
    checkIsInClient: () => visible,
    children: []
  }
  const events = createEventMock()
  const mindMap = {
    opt: { onlyLoadClientRectImg: true },
    renderer: { root: node },
    on: events.on,
    off: events.off,
    updateConfig() {}
  }
  const plugin = new module.default({ mindMap })
  plugin.loadNodeImg(node)
  visible = false
  plugin.loadNodeImg(node)
  assert.equal(loaded[0], 'https://example.test/image.png')
  assert.match(loaded[1], /^data:image\/gif;base64/)
  plugin.beforePluginRemove()
  assert.equal(loaded.at(-1), 'https://example.test/image.png')
})
