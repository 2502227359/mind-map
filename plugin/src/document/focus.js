const clone = value => JSON.parse(JSON.stringify(value))

function findTree(root, uid) {
  if (root.data?.uid === uid) return root
  for (const child of root.children || []) {
    const found = findTree(child, uid)
    if (found) return found
  }
  return null
}

// 聚焦仅改变编辑范围。任何保存都先合并回完整文档，快照不随预览修改。
export class FocusSession {
  constructor(document, uid) {
    this.document = clone(document)
    this.uid = uid
    const roots = [this.document.root, ...(this.document.root.data.freeNodeTrees || [])]
    this.owner = roots.find(root => findTree(root, uid))
    this.target = this.owner && findTree(this.owner, uid)
    if (!this.target || this.target === this.document.root) throw new Error('请选择主根节点以外的普通节点')
    this.initialLayout = this.owner.data.layout || this.document.layout
  }

  open() {
    const result = clone(this.document)
    result.root = clone(this.target)
    result.root.smmVersion = this.document.root.smmVersion
    delete result.root.data.customLeft
    delete result.root.data.customTop
    delete result.root.data.freeNodeTrees
    result.root.data.expand = true
    result.root.data.imgMap = clone(this.document.root.data.imgMap || {})
    result.layout = this.initialLayout
    result.view = null
    return result
  }

  merge(focused) {
    const result = clone(this.document)
    const roots = [result.root, ...(result.root.data.freeNodeTrees || [])]
    const target = roots.map(root => findTree(root, this.uid)).find(Boolean)
    const replacement = clone(focused.root)
    if (!('smmVersion' in target)) delete replacement.smmVersion
    const extraTrees = replacement.data.freeNodeTrees || []
    const images = replacement.data.imgMap || {}
    delete replacement.data.freeNodeTrees
    delete replacement.data.imgMap
    for (const key of ['customLeft', 'customTop', 'layout', 'expand']) {
      if (key in target.data) replacement.data[key] = target.data[key]
      else delete replacement.data[key]
    }
    if (this.target === this.owner && focused.layout !== this.initialLayout) {
      replacement.data.layout = focused.layout
    }
    Object.keys(target).forEach(key => delete target[key])
    Object.assign(target, replacement)
    result.root.data.imgMap = { ...(result.root.data.imgMap || {}), ...images }
    if (extraTrees.length) {
      result.root.data.freeNodeTrees = [...(result.root.data.freeNodeTrees || []), ...extraTrees]
    }
    result.theme = clone(focused.theme)
    return result
  }
}
