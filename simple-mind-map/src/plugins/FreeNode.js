import { layoutValueList, CONSTANTS } from '../constants/constant'
import { createUid, copyNodeTree, getTopAncestorsFomNodeList } from '../utils'

class FreeNode {
  constructor({ mindMap }) {
    this.mindMap = mindMap
    mindMap.constructor.extendNodeDataNoStylePropList?.(['freeNodeTrees', 'layout'])
    this.commands = {
      INSERT_FREE_NODE: this.insert.bind(this),
      TO_FREE_NODE: this.detach.bind(this),
      SET_FREE_NODE_TREE_LAYOUT: this.setLayout.bind(this)
    }
    Object.entries(this.commands).forEach(([name, fn]) => mindMap.command.add(name, fn))
  }

  insert(data = {}, position = {}) {
    if (this.mindMap.opt.readonly) return
    const renderer = this.mindMap.renderer
    if (!renderer.renderTree) return
    const trees = renderer.renderTree.data.freeNodeTrees ||= []
    const root = renderer.root
    const tree = data.data ? copyNodeTree({}, data, true, true) : { data: { text: '游离主题', ...data }, children: [] }
    tree.data = {
      ...tree.data, uid: createUid(), expand: true, isActive: true,
      customLeft: position.x ?? ((root?.left || 0) + 350),
      customTop: position.y ?? ((root?.top || 0) + trees.length * 180),
      layout: tree.data.layout || this.mindMap.opt.layout
    }
    delete tree.data.freeNodeTrees
    renderer.clearActiveNodeList()
    trees.push(tree)
    this.mindMap.render()
  }

  detach(nodes) {
    if (this.mindMap.opt.readonly) return
    const renderer = this.mindMap.renderer
    const selected = getTopAncestorsFomNodeList(nodes?.length ? nodes : renderer.activeNodeList)
    const trees = renderer.renderTree.data.freeNodeTrees ||= []
    selected.filter(node => !node.isRoot && !node.isGeneralization).forEach(node => {
      if (!renderer.removeNodeData(node)) return
      node.isRoot = true
      node.nodeData.data.customLeft = node.left
      node.nodeData.data.customTop = node.top
      node.nodeData.data.layout = node.getLayout().layout || this.mindMap.opt.layout
      trees.push(node.nodeData)
    })
    this.mindMap.render()
  }

  setLayout(nodes, layout) {
    if (this.mindMap.opt.readonly || !layoutValueList.includes(layout)) return
    const renderer = this.mindMap.renderer
    const roots = new Set((nodes?.length ? nodes : renderer.activeNodeList).map(node => {
      while (node.parent) node = node.parent
      return node
    }))
    roots.forEach(root => {
      if (root !== renderer.root) root.nodeData.data.layout = layout
    })
    this.mindMap.render(null, CONSTANTS.CHANGE_LAYOUT)
  }

  beforePluginRemove() {
    Object.entries(this.commands).forEach(([name, fn]) => this.mindMap.command.remove(name, fn))
  }
  beforePluginDestroy() { this.beforePluginRemove() }
}
FreeNode.instanceName = 'freeNode'
export default FreeNode
