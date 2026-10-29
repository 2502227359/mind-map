import { walk, nodeRichTextToTextWithWrap } from '../utils'

const getNodeText = data => {
  return data.richText ? nodeRichTextToTextWithWrap(data.text) : data.text
}

const getIndent = level => {
  return new Array(level).fill('   ').join('')
}

const getForestRoots = root => {
  const nodeTree = root && root.root ? root.root : root
  return nodeTree
    ? [nodeTree, ...((nodeTree.data && nodeTree.data.freeNodeTrees) || [])]
    : []
}

// 转换成txt格式
export const transformToTxt = root => {
  let content = ''
  getForestRoots(root).forEach(nodeTree => {
    walk(
      nodeTree,
      null,
      (node, parent, isRoot, layerIndex) => {
        content += getIndent(layerIndex)
        content += ' ' + getNodeText(node.data)
        // 概要
        const generalization = node.data.generalization
        if (Array.isArray(generalization)) {
          content += generalization.map(item => {
            return ` [${getNodeText(item)}]`
          })
        } else if (generalization && generalization.text) {
          content += ` [${getNodeText(generalization)}]`
        }
        content += '\n\n'
      },
      () => {},
      true
    )
  })
  return content
}
