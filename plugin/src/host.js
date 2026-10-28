const { FuzzySuggestModal, Modal, Notice, TFile, parseLinktext } = require('obsidian')

class NotePicker extends FuzzySuggestModal {
  constructor(app, resolve) {
    super(app)
    this.resolve = resolve
    this.selected = false
    this.setPlaceholder('选择要链接的笔记')
  }
  getItems() { return this.app.vault.getMarkdownFiles() }
  getItemText(file) { return file.path }
  onChooseItem(file) {
    this.selected = true
    this.resolve(file.path)
  }
  onClose() {
    setTimeout(() => { if (!this.selected) this.resolve(null) }, 0)
  }
}

function pickNote(app) {
  return new Promise(resolve => new NotePicker(app, resolve).open())
}

function confirmDiscard(app) {
  return chooseAction(app, {
    title: '重新加载磁盘版本', message: '这会丢弃当前未保存的导图修改。可先取消并另存副本。',
    accept: '丢弃修改并重新加载', cancel: '取消'
  }).then(action => action === 'confirm')
}

function chooseAction(app, options) {
  return new Promise(resolve => {
    const modal = new Modal(app)
    let action = 'close'
    modal.titleEl.setText(options.title)
    modal.contentEl.createEl('p', { text: options.message })
    const add = (label, value) => {
      const button = modal.contentEl.createEl('button', { text: label })
      button.onclick = () => { action = value; modal.close() }
    }
    add(options.cancel, 'cancel')
    add(options.accept, 'confirm')
    modal.onClose = () => resolve(action)
    modal.open()
  })
}

async function openLink(view, link) {
  const value = String(link || '').trim()
  if (/^https?:\/\//i.test(value)) {
    window.open(value, '_blank', 'noopener,noreferrer')
    return
  }
  if (/^[a-z][\w+.-]*:/i.test(value)) {
    new Notice('此链接协议不受支持')
    return
  }
  const text = value.replace(/^\[\[|\]\]$/g, '').split('|')[0]
  const { path, subpath } = parseLinktext(text)
  const target = path
    ? view.app.metadataCache.getFirstLinkpathDest(path, view.file.path)
    : view.file
  if (!(target instanceof TFile)) {
    new Notice('找不到链接目标，请重新选择笔记')
    return
  }
  await view.app.workspace.openLinkText(target.path + subpath, view.file.path, 'tab')
}

module.exports = { pickNote, confirmDiscard, chooseAction, openLink }
