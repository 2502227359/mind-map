import { fontFamilyList } from '@/config'

function normalizeFont(item) {
  if (typeof item === 'string') {
    const value = item.trim()
    return value ? { name: value, value } : null
  }
  if (!item || typeof item !== 'object') return null
  const value = String(item.value || item.fontFamily || item.name || '').trim()
  if (!value) return null
  return {
    name: String(item.name || value),
    value
  }
}

export default {
  data() {
    return {
      fontSettingsRevision: 0,
      fontFamilyKeyword: ''
    }
  },
  computed: {
    fontFamilyList() {
      // 列表按当前视图计算。宿主负责保存设置，并在设置变化时发送
      // `font_settings_changed`，编辑器组件不维护共享或 localStorage 状态。
      this.fontSettingsRevision
      const localeList = fontFamilyList[this.$i18n.locale] || fontFamilyList.en
      const settings = this.$root.$obsidianAPI?.getSettings?.() || {}
      const addedFonts = Array.isArray(settings.addedFonts)
        ? settings.addedFonts
        : []
      const result = []
      const seen = new Set()
      ;[...localeList, ...addedFonts].forEach(item => {
        const font = normalizeFont(item)
        if (!font || seen.has(font.value)) return
        seen.add(font.value)
        result.push(font)
      })
      return result
    },
    filteredFontFamilyList() {
      const keyword = String(this.fontFamilyKeyword || '')
        .trim()
        .toLowerCase()
      if (!keyword) return this.fontFamilyList
      return this.fontFamilyList.filter(item => {
        return `${item.name} ${item.value}`.toLowerCase().includes(keyword)
      })
    }
  },
  created() {
    this.onFontSettingsChanged = () => {
      this.fontSettingsRevision += 1
    }
    this.$root.$bus?.$on('font_settings_changed', this.onFontSettingsChanged)
  },
  beforeDestroy() {
    this.$root.$bus?.$off('font_settings_changed', this.onFontSettingsChanged)
  }
}
