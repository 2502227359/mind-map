import Vue from 'vue'
import Vuex from 'vuex'
import { storeLocalConfig } from '@/api'

Vue.use(Vuex)

const createState = preferences => ({
  isHandleLocalFile: false,
  localConfig: {
    isZenMode: false,
    // 网页入口保持原有默认值；Obsidian coreMode 会在下方关闭它。
    openNodeRichText: true,
    useLeftKeySelectionRightKeyDrag: false,
    isShowScrollbar: false,
    isDark: !!(preferences && preferences.isDark),
    enableDragImport: false,
    enableAi: true
  },
  activeSidebar: '',
  isOutlineEdit: false,
  isReadonly: false,
  isSourceCodeEdit: false,
  extraTextOnExport: '',
  isDragOutlineTreeNode: false,
  aiConfig: {
    api: 'http://ark.cn-beijing.volces.com/api/v3/chat/completions',
    key: '',
    model: '',
    port: 3456,
    method: 'POST'
  },
  extendThemeGroupList: [],
  bgList: []
})

export const createStore = (options = {}) => {
  const persistLocalConfig = options.persistLocalConfig === false
    ? null
    : options.persistLocalConfig || null
  const state = createState(options.preferences)
  if (options.coreMode) {
    state.localConfig.enableAi = false
    state.localConfig.openNodeRichText = false
    state.localConfig.enableDragImport = false
  }

  return new Vuex.Store({
    state,
    mutations: {
      setIsHandleLocalFile(state, data) {
        state.isHandleLocalFile = data
      },

      setLocalConfig(state, data) {
        const aiConfigKeys = Object.keys(state.aiConfig)
        Object.keys(data || {}).forEach(key => {
          if (aiConfigKeys.includes(key)) {
            state.aiConfig[key] = data[key]
          } else {
            state.localConfig[key] = data[key]
          }
        })
        const saveLocalConfig = persistLocalConfig || storeLocalConfig
        if (saveLocalConfig) {
          saveLocalConfig({
            ...state.localConfig,
            ...state.aiConfig
          })
        }
      },

      setActiveSidebar(state, data) {
        state.activeSidebar = data
      },

      setIsOutlineEdit(state, data) {
        state.isOutlineEdit = data
      },

      setIsReadonly(state, data) {
        state.isReadonly = data
      },

      setIsSourceCodeEdit(state, data) {
        state.isSourceCodeEdit = data
      },

      setExtraTextOnExport(state, data) {
        state.extraTextOnExport = data
      },

      setIsDragOutlineTreeNode(state, data) {
        state.isDragOutlineTreeNode = data
      },

      setExtendThemeGroupList(state, data) {
        state.extendThemeGroupList = data
      },

      setBgList(state, data) {
        state.bgList = data
      }
    },
    actions: {}
  })
}

const store = createStore()

export default store
