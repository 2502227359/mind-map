import { degToRad } from '../utils/'

const getAngle = ctx => Math.tan(degToRad(ctx.mindMap.opt.fishboneDeg))

export default {
  top: {
    renderExpandBtn({
      node,
      btn,
      expandBtnSize,
      translateX,
      translateY,
      width,
      height
    }) {
      const x = width - width * 0.3 - expandBtnSize / 2 - translateX
      const y =
        node.parent && node.parent.isRoot
          ? -expandBtnSize / 2 - translateY
          : height + expandBtnSize / 2 - translateY
      btn.translate(x, y)
    },
    renderLine({
      node,
      line,
      top,
      x,
      lineLength,
      height,
      expandBtnSize,
      maxy,
      ctx
    }) {
      if (node.parent && node.parent.isRoot) {
        line.plot(
          ctx.transformPath(
            `M ${x},${top} L ${x - lineLength},${
              top - getAngle(ctx) * lineLength
            }`
          )
        )
      } else {
        line.plot(
          ctx.transformPath(
            `M ${x},${top + height + expandBtnSize} L ${x},${maxy}`
          )
        )
      }
    },
    computedLeftTopValue({ layerIndex, node, ctx }) {
      if (layerIndex < 1 || !node.children) return
      const marginY = ctx.getMarginY(layerIndex + 1)
      let left = node.left + node.width - node.width * ctx.childIndent
      let top =
        node.top +
        node.height +
        (ctx.getNodeActChildrenLength(node) > 0 ? node.expandBtnSize : 0) +
        marginY
      node.children.forEach(item => {
        item.left = left - item.width
        item.top += top
        left -= item.width + marginY
      })
    },
    adjustLeftTopValueBefore({ node, parent, ctx, layerIndex }) {
      const len = node.children.length
      const marginY = ctx.getMarginY(layerIndex + 1)
      if (parent && !parent.isRoot && len > 0) {
        const totalHeight = node.children.reduce(
          (height, item) =>
            height +
            item.height +
            (ctx.getNodeActChildrenLength(item) > 0
              ? item.expandBtnSize
              : 0) +
            marginY,
          0
        )
        ctx.updateBrothersTop(node, totalHeight)
      }
    },
    adjustLeftTopValueAfter({ parent, node, ctx }) {
      if (!parent || !parent.isRoot) return
      const marginY = ctx.getMarginY(node.layerIndex + 1)
      let totalHeight = node.expandBtnSize + marginY
      node.children.forEach(item => {
        const nodeTotalHeight = ctx.getNodeAreaHeight(item)
        const oldTop = item.top
        const oldLeft = item.left
        item.top = node.top - (item.top - node.top) - nodeTotalHeight + node.height
        item.left =
          node.left +
          node.width -
          node.width * ctx.indent -
          (nodeTotalHeight + totalHeight) / getAngle(ctx) -
          item.width
        totalHeight += nodeTotalHeight + marginY
        ctx.updateChildrenPro(item.children, {
          top: item.top - oldTop,
          left: item.left - oldLeft
        })
      })
    }
  },
  bottom: {
    renderExpandBtn({
      node,
      btn,
      expandBtnSize,
      translateX,
      translateY,
      width,
      height
    }) {
      const x = width - width * 0.3 - expandBtnSize / 2 - translateX
      const y =
        node.parent && node.parent.isRoot
          ? height + expandBtnSize / 2 - translateY
          : -expandBtnSize / 2 - translateY
      btn.translate(x, y)
    },
    renderLine({ node, line, top, x, lineLength, height, miny, ctx }) {
      if (node.parent && node.parent.isRoot) {
        line.plot(
          ctx.transformPath(
            `M ${x},${top + height} L ${x - lineLength},${
              top + height + getAngle(ctx) * lineLength
            }`
          )
        )
      } else {
        line.plot(ctx.transformPath(`M ${x},${top} L ${x},${miny}`))
      }
    },
    computedLeftTopValue({ layerIndex, node, ctx }) {
      const marginY = ctx.getMarginY(layerIndex + 1)
      if (!node.children) return
      let left = node.left + node.width - node.width * ctx.childIndent
      if (layerIndex === 1) {
        let top =
          node.top +
          node.height +
          (ctx.getNodeActChildrenLength(node) > 0 ? node.expandBtnSize : 0) +
          marginY
        node.children.forEach(item => {
          item.left = left - item.width
          item.top = top +
            (ctx.getNodeActChildrenLength(item) > 0 ? item.expandBtnSize : 0)
          left -= item.width + marginY
          top +=
            item.height +
            (ctx.getNodeActChildrenLength(item) > 0 ? item.expandBtnSize : 0) +
            marginY
        })
      }
      if (layerIndex > 1) {
        let top =
          node.top -
          (ctx.getNodeActChildrenLength(node) > 0 ? node.expandBtnSize : 0) -
          marginY
        node.children.forEach(item => {
          item.left = left - item.width
          item.top = top - item.height
          left -= item.width + marginY
          top -=
            item.height +
            (ctx.getNodeActChildrenLength(item) > 0 ? item.expandBtnSize : 0) +
            marginY
        })
      }
    },
    adjustLeftTopValueBefore({ node, ctx, layerIndex }) {
      const marginY = ctx.getMarginY(layerIndex + 1)
      const len = node.children.length
      if (layerIndex > 2 && len > 0) {
        const totalHeight = node.children.reduce(
          (height, item) =>
            height +
            item.height +
            (ctx.getNodeActChildrenLength(item) > 0
              ? item.expandBtnSize
              : 0) +
            marginY,
          0
        )
        ctx.updateBrothersTop(node, -totalHeight)
      }
    },
    adjustLeftTopValueAfter({ parent, node, ctx }) {
      if (!parent || !parent.isRoot) return
      const marginY = ctx.getMarginY(node.layerIndex + 1)
      let totalHeight = 0
      let totalHeight2 = node.expandBtnSize
      node.children.forEach(item => {
        const hasChildren = ctx.getNodeActChildrenLength(item) > 0
        const nodeTotalHeight = ctx.getNodeAreaHeight(item)
        let offset = hasChildren
          ? nodeTotalHeight - item.height - item.expandBtnSize
          : 0
        offset -= hasChildren ? marginY : 0
        const topOffset = totalHeight + offset
        const oldLeft = item.left
        item.top += topOffset
        item.left =
          node.left +
          node.width -
          node.width * ctx.indent -
          (nodeTotalHeight + totalHeight2 + marginY) / getAngle(ctx) -
          item.width
        totalHeight += offset
        totalHeight2 += nodeTotalHeight + marginY
        ctx.updateChildrenPro(item.children, {
          top: topOffset,
          left: item.left - oldLeft
        })
      })
    }
  }
}
