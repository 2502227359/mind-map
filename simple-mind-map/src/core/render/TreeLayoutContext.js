// 子树只持有布局状态；选择、命令、节点缓存仍由同一个渲染器管理。
export default class TreeLayoutContext {
  constructor(owner, tree, Layout, name) {
    this.owner = owner
    this.mindMap = owner.mindMap
    this.renderTree = tree
    this.name = name
    this.root = null
    this.forceResize = true
    this.layout = new Layout(this, name)
    this.layout.layout = name
  }

  get nodeCache() { return this.owner.nodeCache }
  get lastNodeCache() { return this.owner.lastNodeCache }
  get reRender() { return this.owner.reRender }
  checkHasRenderSource(value) { return this.owner.checkHasRenderSource(value) }
  addNodeToActiveList(node) { return this.owner.addNodeToActiveList(node) }
  destroy() {
    this.disposed = true
    this.layout.beforeChange?.()
  }
}
