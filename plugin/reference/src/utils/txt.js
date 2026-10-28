import { transformToTxt } from 'simple-mind-map/src/parse/toTxt'

// 与参考插件构建包中的 txtTo 实现保持一致。
export const txtTo = (text, rootText = '') => {
  const lines = text.split(/\r\n|\n|\r/)
  const root = { children: [] }
  const childrenQueue = [root.children]
  let currentChildren = root.children
  const levelQueue = [-1]
  let currentLevel = -1

  lines.forEach(line => {
    const level = line.match(/^\s*/)[0].length
    const value = line.trim()
    if (!value) return

    const node = {
      data: { text: value },
      children: []
    }
    if (level > currentLevel) {
      currentChildren.push(node)
      currentChildren = node.children
      childrenQueue.push(currentChildren)
      levelQueue.push(level)
      currentLevel = level
      return
    }

    while (level <= currentLevel) {
      childrenQueue.pop()
      levelQueue.pop()
      currentChildren = childrenQueue[childrenQueue.length - 1]
      currentLevel = levelQueue[levelQueue.length - 1]
    }
    currentChildren.push(node)
    currentChildren = node.children
    childrenQueue.push(currentChildren)
    levelQueue.push(level)
    currentLevel = level
  })

  if (root.children.length > 1) {
    return {
      data: { text: rootText || '根节点' },
      children: root.children
    }
  }
  return root.children[0]
}

export default {
  toTxt: transformToTxt,
  txtTo
}
