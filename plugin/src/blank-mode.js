// 填空只修改渲染元素，原文、历史和保存数据始终保留答案。
export class BlankMode {
  constructor(mindMap) {
    this.mindMap = mindMap
    this.revealed = new Map()
    this.hidden = new Map()
    this.apply = this.apply.bind(this)
    this.showAll = this.showAll.bind(this)
    this.reveal = this.reveal.bind(this)
    this.readonly = mindMap.opt.readonly
    mindMap.setMode('readonly')
    mindMap.on('node_tree_render_end', this.apply)
    mindMap.on('node_click', this.reveal)
    mindMap.on('before_get_svg_data', this.showAll)
    mindMap.on('after_get_svg_data', this.apply)
    this.apply()
  }

  walk(callback) {
    const visit = node => {
      callback(node)
      ;(node.children || []).forEach(visit)
    }
    this.mindMap.renderer.getAllRenderRoot().forEach(visit)
  }

  apply() {
    this.showAll()
    this.walk(node => {
      const count = this.revealed.get(node.uid) || 0
      const elements = node._textData?.node?.node?.querySelectorAll('u') || []
      // 嵌套下划线按最外层处理，点击一次显示一处答案。
      const answers = [...elements].filter(el => !el.parentElement?.closest('u'))
      answers.slice(count).forEach(el => {
        this.hidden.set(el, el.style.visibility)
        el.style.visibility = 'hidden'
      })
    })
  }

  reveal(node) {
    this.revealed.set(node.uid, (this.revealed.get(node.uid) || 0) + 1)
    this.apply()
  }

  restart() {
    this.revealed.clear()
    this.apply()
  }

  showAll() {
    this.hidden.forEach((visibility, el) => { el.style.visibility = visibility })
    this.hidden.clear()
  }

  dispose() {
    this.showAll()
    const m = this.mindMap
    m.off('node_tree_render_end', this.apply)
    m.off('node_click', this.reveal)
    m.off('before_get_svg_data', this.showAll)
    m.off('after_get_svg_data', this.apply)
    m.setMode(this.readonly ? 'readonly' : 'edit')
  }
}
