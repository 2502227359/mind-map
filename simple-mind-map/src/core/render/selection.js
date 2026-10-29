const uniqueNodes = nodes => [...new Set(nodes.filter(Boolean))]

export const collectDescendantNodes = (starts, includeSelf = true, directOnly = false) => {
  const result = []
  const seen = new Set()
  const visit = node => {
    if (!node || seen.has(node)) return
    seen.add(node)
    result.push(node)
    if (!directOnly) (node.children || []).forEach(visit)
  }
  uniqueNodes(starts).forEach(node => {
    if (includeSelf) visit(node)
    else (node.children || []).forEach(visit)
  })
  return result
}

export const collectLevelNodes = (roots, level) => {
  const target = Number(level)
  if (!Number.isInteger(target) || target < 1) return []
  return collectDescendantNodes(roots).filter(node => node.layerIndex + 1 === target)
}

export const applyNodeSelection = (renderer, nodes) => {
  if (renderer.mindMap.opt.readonly) return
  renderer.clearActiveNodeList()
  uniqueNodes(nodes).forEach(node => renderer.addNodeToActiveList(node))
  renderer.emitNodeActiveEvent()
}
