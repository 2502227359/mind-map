const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const esbuild = require('../../web/node_modules/esbuild')

const repoRoot = path.resolve(__dirname, '../..')

async function loadKeyCommand() {
  const entry = path.join(repoRoot, 'simple-mind-map/src/core/command/KeyCommand.js')
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    logLevel: 'silent'
  })
  const compiledModule = { exports: {} }
  new Function('module', 'exports', result.outputFiles[0].text)(
    compiledModule,
    compiledModule.exports
  )
  return compiledModule.exports.default || compiledModule.exports
}

function createMindMap() {
  const listeners = new Map()
  const mindMap = {
    opt: {
      enableShortcutOnlyWhenMouseInSvg: true,
      customCheckEnableShortcut: () => true
    },
    renderer: { activeNodeList: [] },
    on(name, callback) {
      const callbacks = listeners.get(name) || []
      callbacks.push(callback)
      listeners.set(name, callbacks)
    },
    emit(name) {
      const callbacks = listeners.get(name) || []
      callbacks.forEach(callback => callback())
    }
  }
  return mindMap
}

function withWindowStub(callback) {
  const previousWindow = global.window
  global.window = {
    addEventListener() {},
    removeEventListener() {}
  }
  try {
    return callback()
  } finally {
    if (previousWindow === undefined) delete global.window
    else global.window = previousWindow
  }
}

test('文本编辑结束后恢复画布范围快捷键检查', async () => {
  const KeyCommand = await loadKeyCommand()
  withWindowStub(() => {
    const mindMap = createMindMap()
    const keyCommand = new KeyCommand({ mindMap })

    keyCommand.stopCheckInSvg()
    assert.equal(keyCommand.isStopCheckInSvg, true)
    keyCommand.recoveryCheckInSvg()

    assert.equal(keyCommand.isStopCheckInSvg, false)
  })
})

test('鼠标离开画布后恢复检查时不执行画布快捷键', async () => {
  const KeyCommand = await loadKeyCommand()
  withWindowStub(() => {
    const mindMap = createMindMap()
    const keyCommand = new KeyCommand({ mindMap })
    let calls = 0
    keyCommand.addShortcut('Control+e', () => {
      calls += 1
    })

    keyCommand.stopCheckInSvg()
    keyCommand.recoveryCheckInSvg()
    mindMap.emit('svg_mouseleave')
    keyCommand.onKeydown({
      target: {},
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      keyCode: 69,
      stopPropagation() {},
      preventDefault() {}
    })

    assert.equal(calls, 0)
  })
})

test('插件显示的对齐、整理、适应及富文本快捷键均执行对应操作', async () => {
  const built = await esbuild.build({ entryPoints: [path.join(repoRoot, 'plugin/src/editor-shortcuts.js')], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent' })
  const mod = { exports: {} }
  Function('module', 'exports', built.outputFiles[0].text)(mod, mod.exports)
  const KeyCommand = await loadKeyCommand()
  withWindowStub(() => {
    const m = createMindMap()
    let capture
    global.window.addEventListener = (name, callback, useCapture) => { if (name === 'keydown' && useCapture) capture = callback }
    const calls = []
    const textBindings = new Map()
    m.keyCommand = new KeyCommand({ mindMap: m })
    m.execCommand = name => calls.push(name)
    m.view = { fit: () => calls.push('fit') }
    m.richText = { node: { getStyle: () => 16 }, quill: { keyboard: { addBinding: (binding, handler) => textBindings.set(binding.key, handler) }, format: (name, value) => calls.push([name, value]) } }
    m.off = () => {}
    m.keyCommand.addShortcut('Control+i', () => calls.push('oldFit'))
    const dispose = mod.exports.bindEditorShortcuts(m)
    assert.equal(typeof capture, 'function')
    m.emit('svg_mouseenter')
    let stopped = false
    capture({ target: {}, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, keyCode: 69, preventDefault() {}, stopImmediatePropagation() { stopped = true } })
    assert.equal(stopped, true, '导图快捷键必须在宿主先处理之前截获')
    calls.length = 0
    for (const key of ['Control+e', 'Control+r', 'Control+Shift+i']) m.keyCommand.shortcutMap[key][0]()
    m.emit('rich_text_selection_change')
    textBindings.get('+')({}, { format: { size: '16px' } })
    textBindings.get('[')({}, { format: {} })
    assert.deepEqual(calls, ['TO_SAME_LAYERINDEX_NODE_ALIGN', 'RESET_LAYOUT', 'fit', ['size', '18px'], ['strike', true]])
    assert.equal(m.keyCommand.shortcutMap['Control+i'], undefined)
    m.opt.readonly = true
    m.keyCommand.shortcutMap['Control+r'][0]()
    assert.equal(calls.length, 5)
    dispose()
    assert.equal((m.keyCommand.shortcutMap['Control+e'] || []).length, 0)
    assert.equal(m.keyCommand.shortcutMap['Control+i'].length, 1)
    m.opt.readonly = false
    m.opt.enableShortcutOnlyWhenMouseInSvg = false
    m.keyCommand.isInSvg = false
    m.el = { contains: () => false }
    const disposeInline = mod.exports.bindEditorShortcuts(m, { getIsCodeBlock: () => true })
    stopped = false
    capture({ target: {}, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, keyCode: 69, preventDefault() {}, stopImmediatePropagation() { stopped = true } })
    assert.equal(stopped, false, '代码块画布外应保留宿主快捷键')
    disposeInline()
  })
})
