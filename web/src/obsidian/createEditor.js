import Vue from 'vue'
import VueI18n from 'vue-i18n'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import '@/assets/icon-font/iconfont.css'
import i18n from '@/i18n'
import ObsidianEditor from './ObsidianEditor.vue'
import { createStore } from '@/store'
import { createInstanceApi } from '@/api'
import { createLoadingController } from '@/utils/loading'

Vue.use(ElementUI)

const installInstanceContext = () => {
  if (Vue.__mindMapInstanceContextInstalled) return
  Vue.__mindMapInstanceContextInstalled = true
  Vue.mixin({
    beforeCreate() {
      const root = this.$root
      if (this === root) {
        this.$bus = this.$options.obsidianBus || this.$bus
        this.$host = this.$options.obsidianHost || this.$host
        this.$mindMapApi = this.$options.mindMapApi || this.$mindMapApi
        this.$mindMapLoading =
          this.$options.mindMapLoading || this.$mindMapLoading
        return
      }
      if (root && root.$bus) this.$bus = root.$bus
      if (root && root.$host) this.$host = root.$host
      if (root && root.$mindMapApi) this.$mindMapApi = root.$mindMapApi
      if (root && root.$mindMapLoading) {
        this.$mindMapLoading = root.$mindMapLoading
      }
      // 只改变当前实例的默认值，弹层留在导图容器内，不改宿主 body。
      if (root && root.$host && this.$options.props) {
        this.$options.props = { ...this.$options.props }
        for (const key of ['appendToBody', 'popperAppendToBody', 'modal', 'lockScroll']) {
          const prop = this.$options.props[key]
          if (prop) this.$options.props[key] = { ...prop, default: false }
        }
      }
    }
  })
}

const nextTick = vm => {
  return new Promise(resolve => vm.$nextTick(resolve))
}

const waitForTree = mindMap => {
  if (mindMap.renderer.root && !mindMap.renderer.isRendering) return Promise.resolve()
  return new Promise(resolve => {
    const ready = () => {
      mindMap.off('node_tree_render_end', ready)
      resolve()
    }
    mindMap.on('node_tree_render_end', ready)
  })
}

// 装配入口集中持有同一实例的资源以便完整清理，因此保留超过 40 行的闭包。
// 若继续增加行为，应拆分装配步骤，避免扩大生命周期之间的交叉依赖。
export default async function mountEditor(container, host) {
  if (!container || typeof container.appendChild !== 'function') {
    throw new TypeError('mountEditor 需要有效的容器元素')
  }
  if (!host || !host.data) {
    throw new TypeError('mountEditor 需要 host.data')
  }

  installInstanceContext()
  const bus = new Vue()
  const store = createStore({
    coreMode: true,
    preferences: host.preferences || {},
    persistLocalConfig: false
  })
  const api = createInstanceApi(host)
  const loading = createLoadingController(container)
  const instanceI18n = new VueI18n({
    locale: (host.preferences && host.preferences.lang) || 'zh',
    fallbackLocale: 'zh',
    messages: i18n.messages
  })
  const mountPoint = document.createElement('div')
  mountPoint.className = 'smm-obsidian-mount'
  mountPoint.style.width = '100%'
  mountPoint.style.height = '100%'
  container.appendChild(mountPoint)

  const vm = new Vue({
    store,
    i18n: instanceI18n,
    obsidianBus: bus,
    obsidianHost: host,
    mindMapApi: api,
    mindMapLoading: loading,
    render: h => h(ObsidianEditor)
  }).$mount(mountPoint)

  await nextTick(vm)
  const rootVm = vm.$children[0]
  const editor = rootVm && rootVm.$refs.editor
  const mindMap = editor && editor.mindMap
  if (!mindMap) {
    vm.$destroy()
    mountPoint.remove()
    throw new Error('思维导图实例初始化失败')
  }
  api.setMindMap(mindMap)
  await waitForTree(mindMap)
  api.activate()

  mindMap.resize()

  let destroyed = false
  const controller = {
    mindMap,
    search() { bus.$emit('show_search') },
    getData() {
      mindMap.renderer.textEdit.hideEditTextBox()
      return api.getData()
    },
    resize() {
      mindMap.resize()
    },
    setDark(value) {
      store.commit('setLocalConfig', { isDark: !!value })
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      api.deactivate()
      loading.hide()
      vm.$destroy()
      if (mountPoint.parentNode) mountPoint.parentNode.removeChild(mountPoint)
    }
  }

  return controller
}
