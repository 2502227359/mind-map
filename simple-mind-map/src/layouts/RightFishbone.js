import Fishbone from './Fishbone'
import { walk, degToRad } from '../utils'
import { CONSTANTS } from '../constants/constant'
import utils from './rightFishboneUtils'

// 向右鱼骨图：根节点位于右侧，分支向左展开。
class RightFishbone extends Fishbone {
  getShapeInfo() {
    return {
      fishHeadName: 'rightFishHead',
      fishHeadPathStr:
        'm289.12849,181c0,0 4.06814,-4 0,-8q-93.66407,-173 -289.12849,-173l0,354q244.33052,0 285.06035,-135.81633c0,0 2.03407,-4 0,-4l-33.74895,0l37.81709,-33.18367z',
      fishTailPathStr:
        'm212.6,177q-106.3,-177 -212.6,-177l53.15,177l-53.15,177q106.3,0 212.6,-177z'
    }
  }

  isFishbone2() {
    return this.layout === CONSTANTS.LAYOUT.RIGHT_FISHBONE2
  }

  updateFishTailPosition() {
    if (!this.isFishbone2() || !this.fishTail || !this.root) return
    this.fishTail
      .x(this.maxx - this.fishTail.width())
      .cy(this.root.top + this.root.height / 2)
  }

  computedLeftTopValue() {
    walk(
      this.root,
      null,
      (node, parent, isRoot, layerIndex) => {
        if (node.isRoot) {
          const marginX = this.getMarginX(layerIndex + 1)
          const heightOffsetRatio = this.isFishbone2() ? 2 : 1
          let topTotalLeft = node.left - node.height / heightOffsetRatio - marginX
          let bottomTotalLeft = topTotalLeft
          node.children.forEach(item => {
            if (this.checkIsTop(item)) {
              topTotalLeft -= item.width
              item.left = topTotalLeft
              topTotalLeft -= marginX
            } else {
              bottomTotalLeft -= item.width
              item.left = bottomTotalLeft - 20
              bottomTotalLeft -= marginX
            }
          })
        }
        const params = { layerIndex, node, ctx: this }
        if (this.checkIsTop(node)) {
          utils.top.computedLeftTopValue(params)
        } else {
          utils.bottom.computedLeftTopValue(params)
        }
      },
      null,
      true
    )
  }

  adjustLeftTopValue() {
    walk(
      this.root,
      null,
      (node, parent, isRoot, layerIndex) => {
        if (!node.getData('expand')) return
        const params = { node, parent, layerIndex, ctx: this }
        if (this.checkIsTop(node)) {
          utils.top.adjustLeftTopValueBefore(params)
        } else {
          utils.bottom.adjustLeftTopValueBefore(params)
        }
      },
      (node, parent) => {
        const params = { parent, node, ctx: this }
        if (this.checkIsTop(node)) {
          utils.top.adjustLeftTopValueAfter(params)
        } else {
          utils.bottom.adjustLeftTopValueAfter(params)
        }
        if (node.isRoot) {
          let topTotalLeft = 0
          let bottomTotalLeft = 0
          let minx = Infinity
          node.children.forEach(item => {
            if (this.checkIsTop(item)) {
              item.left -= topTotalLeft
              this.updateChildren(item.children, 'left', -topTotalLeft)
              const { left, right } = this.getNodeBoundaries(item, 'h')
              minx = Math.min(minx, left)
              topTotalLeft += right - left
            } else {
              item.left -= bottomTotalLeft
              this.updateChildren(item.children, 'left', -bottomTotalLeft)
              const { left, right } = this.getNodeBoundaries(item, 'h')
              minx = Math.min(minx, left)
              bottomTotalLeft += right - left
            }
          })
          this.maxx = minx
        }
      },
      true
    )
  }

  renderLine(node, lines, style) {
    if (node.layerIndex !== 1 && node.children.length <= 0) return []
    let { top, height, expandBtnSize } = node
    const { alwaysShowExpandBtn, notShowExpandBtn } = this.mindMap.opt
    if (!alwaysShowExpandBtn || notShowExpandBtn) expandBtnSize = 0
    const len = node.children.length
    if (node.isRoot) {
      let minx = Infinity
      node.children.forEach(item => {
        minx = Math.min(minx, item.left + item.width)
        const marginY = this.getMarginY(item.layerIndex)
        const nodeLineX = item.left + item.width
        const offset =
          height / 2 + marginY - (this.isFishbone2() ? height / 4 : 0)
        const offsetX = offset / Math.tan(degToRad(this.mindMap.opt.fishboneDeg))
        const line = this.lineDraw.path()
        if (this.checkIsTop(item)) {
          line.plot(
            this.transformPath(
              `M ${nodeLineX + offsetX},${item.top + item.height + offset} L ${nodeLineX},${item.top + item.height}`
            )
          )
        } else {
          line.plot(
            this.transformPath(
              `M ${nodeLineX + offsetX},${item.top - offset} L ${nodeLineX},${item.top}`
            )
          )
        }
        node.style.line(line)
        node._lines.push(line)
        style && style(line, node)
      })
      const nodeHalfTop = node.top + height / 2
      const offset = height / 2 + this.getMarginY(node.layerIndex + 1)
      const line = this.lineDraw.path()
      const lineEndX = this.isFishbone2()
        ? this.maxx
        : minx + offset / Math.tan(degToRad(this.mindMap.opt.fishboneDeg))
      line.plot(
        this.transformPath(`M ${node.left},${nodeHalfTop} L ${lineEndX},${nodeHalfTop}`)
      )
      node.style.line(line)
      node._lines.push(line)
      style && style(line, node)
      return
    }

    let maxy = -Infinity
    let miny = Infinity
    let minx = Infinity
    const x = node.left + node.width - node.width * this.indent
    node.children.forEach((item, index) => {
      minx = Math.min(minx, item.left + item.width)
      const y = item.top + item.height / 2
      maxy = Math.max(maxy, y)
      miny = Math.min(miny, y)
      if (node.layerIndex > 1) {
        this.setLineStyle(style, lines[index], `M ${x},${y} L ${item.left + item.width},${y}`, item)
      }
    })
    if (len >= 0) {
      const line = this.lineDraw.path()
      expandBtnSize = len > 0 ? expandBtnSize : 0
      const lineLength = Math.max(
        node.left + node.width - minx - node.width * this.indent,
        0
      )
      const params = {
        node,
        line,
        top,
        x,
        lineLength,
        height,
        expandBtnSize,
        maxy,
        miny,
        ctx: this
      }
      if (this.checkIsTop(node)) {
        utils.top.renderLine(params)
      } else {
        utils.bottom.renderLine(params)
      }
      node.style.line(line)
      node._lines.push(line)
      style && style(line, node)
    }
  }

  renderExpandBtn(node, btn) {
    if (node.isRoot) return
    const { translateX, translateY } = btn.transform()
    const params = {
      node,
      btn,
      expandBtnSize: node.expandBtnSize,
      translateX,
      translateY,
      width: node.width,
      height: node.height
    }
    if (this.checkIsTop(node)) {
      utils.top.renderExpandBtn(params)
    } else {
      utils.bottom.renderExpandBtn(params)
    }
  }

  renderGeneralization(list) {
    list.forEach(item => {
      const {
        top,
        bottom,
        left,
        generalizationLineMargin,
        generalizationNodeMargin
      } = this.getNodeGeneralizationRenderBoundaries(item, 'h')
      const x1 = left - generalizationLineMargin
      const y1 = top
      const x2 = left - generalizationLineMargin
      const y2 = bottom
      const cx = x1 - 20
      const cy = y1 + (y2 - y1) / 2
      item.generalizationLine.plot(
        this.transformPath(`M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`)
      )
      item.generalizationNode.left =
        left - generalizationNodeMargin - item.generalizationNode.width
      item.generalizationNode.top =
        top + (bottom - top - item.generalizationNode.height) / 2
    })
  }
}

export default RightFishbone
