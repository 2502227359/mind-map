const { PluginSettingTab, Setting, normalizePath } = require('obsidian')

class MindMapSettings extends PluginSettingTab {
  display() {
    this.containerEl.empty()
    this.containerEl.createEl('h2', { text: '个人思维导图' })
    this.containerEl.createEl('p', { text: '导图数据保存在 .mindmap.md。节点文本区由导图生成，直接改正文不会修改节点。' })
    new Setting(this.containerEl).setName('默认目录')
      .setDesc('留空使用当前笔记所在目录；没有活动笔记时使用库根目录。')
      .addText(input => input.setValue(this.plugin.settings.folder).onChange(async value => {
        if (value.split(/[\\/]/).includes('..') || /[:]/.test(value)) return
        this.plugin.settings.folder = value ? normalizePath(value) : ''
        await this.plugin.saveSettings()
      }))
    this.containerEl.createEl('p', { text: '核心版不提供 AI、图片落库、导入导出或旧插件格式兼容。目标笔记重命名后，可重新选择失效的节点链接。' })
  }
}

module.exports = MindMapSettings
