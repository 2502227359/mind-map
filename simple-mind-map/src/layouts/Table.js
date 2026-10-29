import Base from './Base'
import LogicalStructure from './LogicalStructure'
import { walk, asyncRun } from '../utils'
import { Rect } from '@svgdotjs/svg.js'

// 表格布局：按节点层级生成等宽列，并为没有子节点的分支补齐空单元格。
class Table extends Base {
  constructor(opt = {}, layout) {
    super(opt)
    this.layout = layout
    this.isNeedReRenderWhenChange = true
    this.maxLayerWidthMap = {}
    this.beforeChange = this.beforeChange.bind(this)
  }

  // 表格单元格首尾相接，不能沿用主题布局的节点间距。
  getMarginX() {
    return 0
  }

  getMarginY() {
    return 0
  }

  // 表格会自行绘制每个单元格的边框，渲染前必须移除上一轮布局的旧连线。
  nodeIsRemoveAllLines() {
    return true
  }

  doLayout(callback) {
    asyncRun([
      () => this.computedBaseValue(),
      () => this.computedMaxChildrenWidth(),
      () => this.computedLeftTopValue(),
      () => callback(this.root)
    ], undefined, () => !this.mindMap._isDestroyed && !this.renderer.disposed)
  }

  computedBaseValue() {
    let sortIndex = 0
    walk(
      this.renderer.renderTree,
      null,
      (node, parent, isRoot, layerIndex, index, ancestors) => {
        const newNode = this.createNode(
          node,
          parent,
          isRoot,
          layerIndex,
          index,
          ancestors
        )
        // 表格列宽属于当前布局的临时状态。节点复用时，先恢复内容尺寸，
        // 否则展开/收起后 childrenAreaHeight 会继续使用上一轮的单元格尺寸。
        if (newNode.getSize()) {
          newNode.needLayout = true
        }
        newNode.sortIndex = sortIndex
        sortIndex += 1
        if (isRoot) this.setNodeCenter(newNode)
        if (!node.data.expand) return true
      },
      (node, parent, isRoot, layerIndex) => {
        const marginY = this.getMarginY(layerIndex + 1)
        const childCount = node.data.expand === false ? 0 : node._node.children.length
        node._node.childrenAreaHeight = childCount
          ? node._node.children.reduce(
              (height, child) =>
                height +
                Math.max(child.childrenAreaHeight, child.height),
              0
            ) +
            (childCount - 1) * marginY
          : 0
      },
      true,
      0
    )
  }

  computedMaxChildrenWidth() {
    this.maxLayerWidthMap = {}
    walk(
      this.root,
      null,
      (node, parent, isRoot, layerIndex) => {
        this.maxLayerWidthMap[layerIndex] = Math.max(
          this.maxLayerWidthMap[layerIndex] || 0,
          node.width
        )
      },
      null,
      true
    )
    walk(
      this.root,
      null,
      node => {
        const oldWidth = node.width
        const oldHeight = node.height
        node.width = this.maxLayerWidthMap[node.layerIndex]
        let changed = node.width !== oldWidth
        if (node.childrenAreaHeight >= node.height) {
          node.height = node.childrenAreaHeight
          changed = changed || node.height !== oldHeight
        } else {
          changed = changed || node.height !== oldHeight
          this.adjustChildrenNodeHeight(node)
        }
        if (changed) {
          node.needLayout = true
        }
      },
      null,
      true
    )
  }

  adjustChildrenNodeHeight(node) {
    if (!node.children || node.children.length === 0) return
    const extra = (node.height - node.childrenAreaHeight) / node.children.length
    if (extra <= 0) return
    node.children.forEach(child => {
      child.height += extra
      child.needLayout = true
      this.adjustChildrenNodeHeight(child)
    })
  }

  computedLeftTopValue() {
    walk(
      this.root,
      null,
      (node, parent, isRoot, layerIndex) => {
        const marginX = this.getMarginX(layerIndex + 1)
        const marginY = this.getMarginY(layerIndex + 1)
        if (!isRoot) {
          node.left =
            parent.left + this.maxLayerWidthMap[layerIndex - 1] + marginX
        }
        if (!node.getData('expand') || !node.children.length) return
        let top = node.top
        node.children.forEach((child, index) => {
          child.top =
            child.height > child.childrenAreaHeight
              ? top
              : top + (child.childrenAreaHeight - child.height) / 2
          top += child.height > child.childrenAreaHeight
            ? child.height
            : child.childrenAreaHeight
          if (index < node.children.length - 1) top += marginY
        })
      },
      null,
      true
    )
  }

  drawLine(node, style, x1, y1, x2, y2) {
    const line = this.lineDraw.path()
    node.style.line(line)
    line.plot(this.transformPath(`M ${x1},${y1} L ${x2},${y2}`))
    node._lines.push(line)
    style && style(line, node)
  }

  renderLine(node, lines, style) {
    const height = Math.max(node.childrenAreaHeight, node.height)
    const top = node.top + node.height / 2 - height / 2
    const bottom = node.top + node.height / 2 + height / 2
    const right = node.left + this.maxLayerWidthMap[node.layerIndex]
    this.drawLine(node, style, node.left, top, node.left, bottom)
    this.drawLine(node, style, node.left, top, right, top)
    this.drawLine(node, style, right, top, right, bottom)
    this.drawLine(node, style, node.left, bottom, right, bottom)
    this.addEmptyCell(node, style)
  }

  addEmptyCell(node, style) {
    const maxLayer = Object.keys(this.maxLayerWidthMap).reduce(
      (max, layer) => Math.max(max, Number(layer)),
      0
    )
    if (node.children.length > 0 && node.getData('expand')) return
    if (node.layerIndex >= maxLayer) return
    const marginX = this.getMarginX(node.layerIndex + 1)
    let cell = { left: node.left + marginX, top: node.top, height: node.height }
    for (let layer = node.layerIndex + 1; layer <= maxLayer; layer += 1) {
      cell = this.renderCell(node, cell, layer, style)
      cell.left += marginX
    }
  }

  renderCell(node, cell, layer, style) {
    const rect = new Rect()
      .size(this.maxLayerWidthMap[layer], cell.height)
      .x(cell.left + this.maxLayerWidthMap[layer - 1])
      .y(cell.top)
    this.lineDraw.add(rect)
    node._lines.push(rect)
    style && style(rect, node)
    return {
      left: cell.left + this.maxLayerWidthMap[layer - 1],
      top: cell.top,
      height: cell.height
    }
  }

  beforeChange() {
    if (!this.root) return
    walk(
      this.root,
      null,
      node => {
        // 表格列宽是布局态，不应泄漏到下一个布局。getSize 会按节点
        // 内容和 customTextWidth 恢复真实尺寸；下一次渲染再由目标布局接管。
        node.getSize()
        node.needLayout = true
      },
      null,
      true
    )
    this.maxLayerWidthMap = {}
  }

  renderExpandBtn(node, btn) {
    const { width, height } = node
    const { translateX, translateY } = btn.transform()
    const x = width
    const y =
      height / 2 +
      (this.mindMap.themeConfig.nodeUseLineStyle ? height / 2 : 0)
    if (x === translateX && y === translateY) return
    btn.translate(x - translateX, y - translateY)
  }

  renderGeneralization(list) {
    LogicalStructure.prototype.renderGeneralization.call(this, list)
  }

  renderExpandBtnRect(rect, expandBtnSize, width, height) {
    rect.size(expandBtnSize, height).x(width).y(0)
  }
}

export default Table
