import { Modal, Notice } from 'obsidian'
import { fontFamilyList } from '../src/config'
import {
  getFontOptions,
  normalizeAddedFonts,
  normalizeFontFamily,
  queryInstalledFonts
} from '../../src/fonts.js'
import { SMM_VIEW_TYPE } from './constant.js'

export default class FontManager extends Modal {
  constructor(app, plugin) {
    super(app)
    this.plugin = plugin
    this.localFonts = []
    this.searchInput = null
    this.searchResults = null
    this.addedFontsList = null
  }

  onOpen() {
    this._render()
  }

  _render() {
    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('smm-font-manager-modal')
    contentEl.createEl('h2', { text: this.plugin._t('setting.font.title') })

    this._renderAddedFonts(contentEl)
    contentEl.createEl('hr')

    const input = contentEl.createEl('input', {
      type: 'text',
      placeholder: this.plugin._t('setting.font.placeholder'),
      cls: 'smm-font-search-input'
    })
    this.searchInput = input
    input.addEventListener('input', () => this._renderSearchResults())
    input.addEventListener('keydown', async event => {
      if (event.key !== 'Enter') return
      await this._addFont(input.value)
      input.value = ''
      this._render()
      this.searchInput?.focus()
    })

    const queryButton = contentEl.createEl('button', {
      text: '扫描本机字体（需手动授权）'
    })
    queryButton.addEventListener('click', () => this._queryLocalFonts())
    this.searchResults = contentEl.createDiv('smm-font-search-results')
    this._renderSearchResults()
  }

  _getAddedFonts() {
    return normalizeAddedFonts(this.plugin.settings.addedFonts)
  }

  _renderAddedFonts(containerEl) {
    const addedFonts = this._getAddedFonts()
    if (addedFonts.length === 0) {
      containerEl.createEl('p', {
        text: this.plugin._t('setting.font.empty')
      })
      return
    }

    this.addedFontsList = containerEl.createEl('ul', {
      cls: 'smm-added-fonts-list'
    })
    addedFonts.forEach(font => {
      const row = this.addedFontsList.createEl('li')
      row.createEl('span', {
        text: font,
        cls: 'smm-font-name',
        attr: { style: `font-family: "${font}"` }
      })
      const removeButton = row.createEl('button', { text: '移除' })
      removeButton.addEventListener('click', async () => {
        await this._removeFont(font)
        this._render()
      })
    })
  }

  _renderSearchResults() {
    if (!this.searchResults) return
    const query = String(this.searchInput?.value || '').trim().toLowerCase()
    const addedFonts = this._getAddedFonts()
    const localeFonts =
      fontFamilyList[this.plugin.settings.lang] || fontFamilyList.en
    const options = getFontOptions(localeFonts, [
      ...this.localFonts,
      ...addedFonts
    ])
      .filter(item => !addedFonts.some(font => font.toLowerCase() === item.value.toLowerCase()))
      .filter(item => !query || item.name.toLowerCase().includes(query))

    this.searchResults.empty()
    if (options.length === 0) {
      this.searchResults.createEl('p', {
        text: query
          ? this.plugin._t('setting.font.noMatch')
          : this.plugin._t('setting.font.noFont')
      })
      return
    }

    const list = this.searchResults.createEl('ul', {
      cls: 'smm-font-results-list'
    })
    options.forEach(item => {
      const row = list.createEl('li', {
        text: item.name,
        attr: { style: `font-family: "${item.value}"` }
      })
      row.addEventListener('click', async () => {
        await this._addFont(item.value)
        this._render()
      })
    })
  }

  async _queryLocalFonts() {
    try {
      const names = await queryInstalledFonts()
      this.localFonts = names
      new Notice(`已发现 ${names.length} 个本机字体，可点击字体加入列表`)
      this._renderSearchResults()
    } catch (error) {
      new Notice(`读取本机字体失败：${error.message || error}`)
    }
  }

  async _addFont(value) {
    const font = normalizeFontFamily(value)
    if (!font) return
    const addedFonts = this._getAddedFonts()
    if (addedFonts.some(item => item.toLowerCase() === font.toLowerCase())) {
      return
    }
    this.plugin.settings.addedFonts = [...addedFonts, font]
    await this.plugin._saveSettings()
    this._emitFontSettingsChanged()
  }

  async _removeFont(font) {
    const target = String(font).toLowerCase()
    this.plugin.settings.addedFonts = this._getAddedFonts().filter(
      item => item.toLowerCase() !== target
    )
    await this.plugin._saveSettings()
    this._emitFontSettingsChanged()
  }

  _emitFontSettingsChanged() {
    this.app.workspace.getLeavesOfType(SMM_VIEW_TYPE).forEach(leaf => {
      leaf.view?.mindMapAPP?.$bus?.$emit('font_settings_changed')
    })
    if (this.plugin._codeBlockEditors instanceof Set) {
      this.plugin._codeBlockEditors.forEach(editor => {
        editor?.$bus?.$emit('font_settings_changed')
      })
    }
  }

  onClose() {
    this.contentEl.empty()
    this.searchInput = null
    this.searchResults = null
    this.addedFontsList = null
  }
}
