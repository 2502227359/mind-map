import exampleData from 'simple-mind-map/example/exampleData'
import { simpleDeepClone } from 'simple-mind-map/src/utils/index'
import Vue from 'vue'
import vuexStore from '@/store'

const SIMPLE_MIND_MAP_DATA = 'SIMPLE_MIND_MAP_DATA'
const SIMPLE_MIND_MAP_CONFIG = 'SIMPLE_MIND_MAP_CONFIG'
const SIMPLE_MIND_MAP_LANG = 'SIMPLE_MIND_MAP_LANG'
const SIMPLE_MIND_MAP_LOCAL_CONFIG = 'SIMPLE_MIND_MAP_LOCAL_CONFIG'

let mindMapData = null

const cloneData = data => {
  if (data === undefined || data === null) return data
  return simpleDeepClone(data)
}

// 获取缓存的思维导图数据
export const getData = () => {
  // 接管模式
  if (window.takeOverApp) {
    mindMapData = window.takeOverAppMethods.getMindMapData()
    return mindMapData
  }
  // 操作本地文件模式
  if (vuexStore.state.isHandleLocalFile) {
    return Vue.prototype.getCurrentData()
  }
  let store = localStorage.getItem(SIMPLE_MIND_MAP_DATA)
  if (store === null) {
    return simpleDeepClone(exampleData)
  } else {
    try {
      return JSON.parse(store)
    } catch (error) {
      return simpleDeepClone(exampleData)
    }
  }
}

// 存储思维导图数据
export const storeData = data => {
  try {
    let originData = null
    if (window.takeOverApp) {
      originData = mindMapData
    } else {
      originData = getData()
    }
    if (!originData) {
      originData = {}
    }
    originData = {
      ...originData,
      ...data
    }
    if (window.takeOverApp) {
      mindMapData = originData
      window.takeOverAppMethods.saveMindMapData(originData)
      return
    }
    Vue.prototype.$bus.$emit('write_local_file', originData)
    if (vuexStore.state.isHandleLocalFile) {
      return
    }
    localStorage.setItem(SIMPLE_MIND_MAP_DATA, JSON.stringify(originData))
  } catch (error) {
    console.log(error)
    if ('exceeded') {
      Vue.prototype.$bus.$emit('localStorageExceeded')
    }
  }
}

// Obsidian 编辑器实例使用的 API。它不读取 localStorage，也不依赖全局 bus。
export const createInstanceApi = host => {
  let mindMap = null
  let active = true
  let ready = false
  let localConfig = {
    isDark: !!(host && host.preferences && host.preferences.isDark),
    enableAi: false,
    openNodeRichText: false
  }
  let config = cloneData(host && host.data && host.data.config) || {}

  const getFullData = () => {
    if (mindMap) return { ...cloneData(mindMap.getData(true)), config: cloneData(config) }
    return cloneData((host && host.data) || exampleData)
  }

  const notify = data => {
    if (!active || !ready || !host || typeof host.onChange !== 'function') {
      return
    }
    if (typeof host.isActive === 'function' && !host.isActive()) {
      return
    }
    host.onChange(cloneData(data))
  }

  return {
    isInstance: true,
    setMindMap(instance) {
      mindMap = instance
    },
    activate() {
      ready = true
    },
    deactivate() {
      ready = false
      active = false
    },
    getData() {
      return getFullData()
    },
    getConfig() {
      return cloneData(config)
    },
    storeData(data) {
      const current = getFullData()
      const next = data && data.root && data.layout && data.theme && data.view
        ? cloneData(data)
        : { ...current, ...(cloneData(data) || {}) }
      notify({ ...next, config: cloneData(config) })
    },
    storeConfig(nextConfig) {
      config = cloneData(nextConfig) || {}
      notify(getFullData())
    },
    getLocalConfig() {
      return cloneData(localConfig)
    },
    storeLocalConfig(nextConfig) {
      localConfig = { ...localConfig, ...(cloneData(nextConfig) || {}) }
    },
    getLang() {
      return (host && host.preferences && host.preferences.lang) || 'zh'
    },
    storeLang() {},
    notifyChange() {
      notify(getFullData())
    },
    save() {
      if (host && typeof host.onSave === 'function') return host.onSave()
    }
  }
}

// 获取思维导图配置数据
export const getConfig = () => {
  if (window.takeOverApp) {
    window.takeOverAppMethods.getMindMapConfig()
    return
  }
  let config = localStorage.getItem(SIMPLE_MIND_MAP_CONFIG)
  if (config) {
    return JSON.parse(config)
  }
  return null
}

// 存储思维导图配置数据
export const storeConfig = config => {
  try {
    if (window.takeOverApp) {
      window.takeOverAppMethods.saveMindMapConfig(config)
      return
    }
    localStorage.setItem(SIMPLE_MIND_MAP_CONFIG, JSON.stringify(config))
  } catch (error) {
    console.log(error)
  }
}

// 存储语言
export const storeLang = lang => {
  if (window.takeOverApp) {
    window.takeOverAppMethods.saveLanguage(lang)
    return
  }
  localStorage.setItem(SIMPLE_MIND_MAP_LANG, lang)
}

// 获取存储的语言
export const getLang = () => {
  if (window.takeOverApp) {
    return window.takeOverAppMethods.getLanguage() || 'zh'
  }
  let lang = localStorage.getItem(SIMPLE_MIND_MAP_LANG)
  if (lang) {
    return lang
  }
  storeLang('zh')
  return 'zh'
}

// 存储本地配置
export const storeLocalConfig = config => {
  if (window.takeOverApp) {
    return window.takeOverAppMethods.saveLocalConfig(config)
  }
  localStorage.setItem(SIMPLE_MIND_MAP_LOCAL_CONFIG, JSON.stringify(config))
}

// 获取本地配置
export const getLocalConfig = () => {
  if (window.takeOverApp) {
    return window.takeOverAppMethods.getLocalConfig()
  }
  let config = localStorage.getItem(SIMPLE_MIND_MAP_LOCAL_CONFIG)
  if (config) {
    return JSON.parse(config)
  }
  return null
}

const legacyApi = {
  getData,
  getConfig,
  storeData,
  storeConfig,
  storeLang,
  getLang,
  storeLocalConfig,
  getLocalConfig
}

export const getApi = vm => {
  return (vm && vm.$mindMapApi) || legacyApi
}
