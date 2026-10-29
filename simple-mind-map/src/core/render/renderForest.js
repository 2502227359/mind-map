import TreeLayoutContext from './TreeLayoutContext'
import { createUid } from '../../utils'

export const syncFreeTrees = (renderer, layouts) => {
  const previous = renderer.freeTreeContexts || []
  const contexts = (renderer.renderTree.data.freeNodeTrees || []).map(tree => {
    tree.data.uid = tree.data.uid || createUid()
    const name = tree.data.layout || renderer.mindMap.opt.layout
    let context = previous.find(item => item.renderTree.data.uid === tree.data.uid && item.name === name)
    if (!context) {
      const Layout = layouts[name] || layouts.logicalStructure
      context = new TreeLayoutContext(renderer, tree, Layout, name)
    }
    context.renderTree = tree
    return context
  })
  previous.filter(item => !contexts.includes(item)).forEach(item => item.destroy())
  renderer.freeTreeContexts = contexts
}

export const renderForest = (renderer, layouts) => {
  const version = renderer.renderVersion = (renderer.renderVersion || 0) + 1
  const isCurrent = () => !renderer.disposed && renderer.renderVersion === version
  syncFreeTrees(renderer, layouts)
  const contexts = [renderer, ...renderer.freeTreeContexts]
  const layoutNext = index => {
    if (!isCurrent()) return
    if (index === contexts.length) return drawForest(renderer, contexts, isCurrent)
    const context = contexts[index]
    context.layout.doLayout(root => {
      if (!isCurrent()) return
      context.root = root
      context.forceResize = false
      layoutNext(index + 1)
    })
  }
  layoutNext(0)
}

const drawForest = (renderer, contexts, isCurrent) => {
  if (!isCurrent()) return
  Object.keys(renderer.lastNodeCache).forEach(uid => {
    if (renderer.nodeCache[uid]) return
    renderer.removeNodeFromActiveList(renderer.lastNodeCache[uid])
    renderer.lastNodeCache[uid].destroy()
  })
  let remaining = contexts.length
  contexts.forEach(context => context.root.render(() => {
    if (!isCurrent()) return
    if (--remaining) return
    renderer.isRendering = false
    if (renderer.hasWaitRendering) {
      renderer.hasWaitRendering = false
      renderer.render()
    } else renderer.onRenderEnd()
  }))
}
