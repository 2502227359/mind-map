import { markRaw } from 'vue'
import { FocusSession } from '../../../src/document/focus.js'
import { BlankMode } from '../../../src/blank-mode.js'
import { bindLinkHover } from '../../../src/link-hover.js'
import { bindEditorShortcuts } from '../../../src/editor-shortcuts.js'

export default {
  data() {
    return { focusLabel: '', blankActive: false, modeSwitching: false }
  },
  mounted() {
    this.$root.$bus.$on('enter_to_node', this.enterFocus)
    this.$root.$bus.$on('toggle_blank_mode', this.toggleBlankMode)
    window.addEventListener('keydown', this.onModeEscape)
  },
  beforeDestroy() {
    this.cancelModeSwitch()
    this.$root.$bus.$off('enter_to_node', this.enterFocus)
    this.$root.$bus.$off('toggle_blank_mode', this.toggleBlankMode)
    window.removeEventListener('keydown', this.onModeEscape)
    this.stopLinkHover?.()
    this.stopEditorShortcuts?.()
    delete this.$root.$isMapStudyMode
    this.blankMode?.dispose()
    this.focusSession = null
  },
  methods: {
    setupModes(mindMap) {
      this.stopLinkHover = bindLinkHover(mindMap.el, this.$root.$obsidianAPI)
      this.stopEditorShortcuts = bindEditorShortcuts(mindMap, this.$root.$obsidianAPI)
      this.$root.$isMapStudyMode = () => Boolean(this.blankActive || this.focusSession)
    },

    currentDocument() {
      if (this.modeSwitching) return JSON.parse(JSON.stringify(this.modeDocument))
      const data = this.includeRainbowLinesConfig(this.mindMap.getData(true))
      return this.focusSession ? this.focusSession.merge(data) : data
    },

    toggleBlankMode() {
      if (this.modeSwitching || this.mindMap.demonstrate?.isInDemonstrate) return
      if (this.blankMode) {
        this.blankMode.dispose()
        this.blankMode = null
        this.blankActive = false
        return
      }
      this.closeEditTextBox()
      this.blankMode = markRaw(new BlankMode(this.mindMap))
      this.blankActive = true
      this.$root.$obsidianAPI.showTip('下划线内容已隐藏，点击节点逐个显示；Esc 退出')
    },

    onModeEscape(event) {
      const api = this.$root.$obsidianAPI
      if (event.defaultPrevented || event.key !== 'Escape' || (api.isActive && !api.isActive())) return
      if (event.target.closest?.('input,textarea,[contenteditable="true"]')) return
      if (this.blankActive) this.toggleBlankMode()
      else if (this.focusSession) this.exitFocus().catch(this.reportModeError)
    },

    reportModeError(error) {
      this.$root.$obsidianAPI.showTip(`模式切换失败：${error.message}`)
    },

    async enterFocus(node) {
      if (!node || node.isGeneralization || node === this.mindMap.renderer.root) return
      if (this.isSaving || this.mindMap.demonstrate?.isInDemonstrate || this.modeSwitching) return
      try {
        if (this.blankActive) this.toggleBlankMode()
        this.closeEditTextBox()
        if (this.focusSession) await this.exitFocus()
        const m = this.mindMap
        m.command.addHistory.cancel?.()
        m.command.originAddHistory()
        this.focusHistory = { history: [...m.command.history], index: m.command.activeHistoryIndex }
        this.focusSession = markRaw(new FocusSession(this.currentDocument(), node.uid))
        this.focusLabel = String(node.getData('text') || '节点').replace(/<[^>]*>/g, '')
        if (await this.replaceModeDocument(this.focusSession.open())) m.view.reset()
      } catch (error) { this.reportModeError(error) }
    },

    async replaceModeDocument(data, seedHistory = true) {
      const m = this.mindMap
      const version = this.modeVersion = (this.modeVersion || 0) + 1
      this.modeDocument = seedHistory && this.focusSession ? this.focusSession.merge(data) : data
      this.modeSwitching = true
      m.command.addHistory.cancel?.()
      m.command.pause()
      let completed
      try {
        this.modeReady = new Promise((resolve, reject) => {
          const clean = () => { clearTimeout(timer); m.off('node_tree_render_end', done) }
          const done = () => { clean(); resolve(true) }
          const timer = setTimeout(() => { clean(); reject(new Error('画布未完成渲染')) }, 5000)
          this.finishModeSwitch = () => { clean(); resolve(false) }
          m.on('node_tree_render_end', done)
          m.setFullData(data)
        })
        completed = await this.modeReady
      } finally {
        if (this.modeVersion === version) this.cancelModeSwitch(false)
      }
      if (!completed || this.modeVersion !== version) return false
      if (seedHistory) m.command.originAddHistory()
      return true
    },

    cancelModeSwitch(invalidate = true) {
      if (!this.modeSwitching) return
      if (invalidate) this.modeVersion = (this.modeVersion || 0) + 1
      this.finishModeSwitch?.()
      this.finishModeSwitch = null
      this.mindMap.command.addHistory.cancel?.()
      this.mindMap.command.recovery()
      this.modeSwitching = false
    },

    async exitFocus() {
      while (this.modeSwitching) await this.modeReady
      if (!this.focusSession) return
      if (this.blankActive) this.toggleBlankMode()
      this.closeEditTextBox()
      const full = this.currentDocument()
      if (!await this.replaceModeDocument(full, false)) return
      this.focusSession = null
      this.focusLabel = ''
      const command = this.mindMap.command
      command.history = this.focusHistory.history
      command.activeHistoryIndex = this.focusHistory.index
      command.originAddHistory()
      this.mindMapData = full
    },

    resetModes() {
      this.cancelModeSwitch()
      if (this.blankActive) this.toggleBlankMode()
      this.focusSession = null
      this.focusLabel = ''
      this.mindMap.command.addHistory.cancel?.()
    }
  }
}
