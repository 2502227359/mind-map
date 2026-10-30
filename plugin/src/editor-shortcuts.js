function bindTextShortcuts(mindMap, quill) {
  for (const [key, delta] of [['+', 2], ['_', -2]]) {
    quill.keyboard.addBinding({ key, shortKey: true, shiftKey: true }, (range, context) => {
      if (mindMap.opt.readonly) return false
      const value = context.format.size || mindMap.richText.node?.getStyle('fontSize')
      const size = Number.parseFloat(Array.isArray(value) ? value[0] : value) || 16
      quill.format('size', `${Math.min(100, Math.max(1, size + delta))}px`, 'user')
      return false
    })
  }
  quill.keyboard.addBinding({ key: '[', shortKey: true }, (range, context) => {
    if (!mindMap.opt.readonly) quill.format('strike', !context.format.strike, 'user')
    return false
  })
}

function bindHostKeys(mindMap, bindings, api) {
  const keys = mindMap.keyCommand
  const onKeydown = event => {
    if (keys.isPause || mindMap.renderer.textEdit?.isShowTextEdit()) return
    if (event.target.closest?.('input,textarea,select,[contenteditable="true"]')) return
    if (mindMap.opt.customCheckEnableShortcut && !mindMap.opt.customCheckEnableShortcut(event)) return
    if (mindMap.opt.enableShortcutOnlyWhenMouseInSvg && !keys.isStopCheckInSvg && !keys.isInSvg) return
    if (api.getIsCodeBlock?.() && !keys.isInSvg && !mindMap.el.contains(event.target)) return
    const binding = bindings.find(([key]) => keys.checkKey(event, key))
    if (!binding) return
    event.preventDefault()
    event.stopImmediatePropagation()
    binding[1]()
  }
  window.addEventListener('keydown', onKeydown, true)
  return () => window.removeEventListener('keydown', onKeydown, true)
}

// Obsidian 界面沿用参考快捷键；独立网页引擎的默认键位不受影响。
export function bindEditorShortcuts(mindMap, api = {}) {
  const keys = mindMap.keyCommand
  const previous = ['Control+l', 'Control+i'].map(key => [key, [...(keys.shortcutMap[key] || [])]])
  previous.forEach(([key]) => keys.removeShortcut(key))
  const editable = command => () => { if (!mindMap.opt.readonly) mindMap.execCommand(command) }
  const bindings = [
    ['Control+e', editable('TO_SAME_LAYERINDEX_NODE_ALIGN')],
    ['Control+r', editable('RESET_LAYOUT')],
    ['Control+Shift+i', () => mindMap.view.fit()]
  ]
  bindings.forEach(([key, callback]) => keys.addShortcut(key, callback))
  const stopHostKeys = bindHostKeys(mindMap, bindings, api)
  const boundQuills = new WeakSet()
  const onSelection = () => {
    const quill = mindMap.richText?.quill
    if (!quill || boundQuills.has(quill)) return
    bindTextShortcuts(mindMap, quill)
    boundQuills.add(quill)
  }
  mindMap.on('rich_text_selection_change', onSelection)
  return () => {
    stopHostKeys()
    mindMap.off('rich_text_selection_change', onSelection)
    bindings.forEach(([key, callback]) => keys.removeShortcut(key, callback))
    previous.forEach(([key, callbacks]) => callbacks.forEach(callback => keys.addShortcut(key, callback)))
  }
}
