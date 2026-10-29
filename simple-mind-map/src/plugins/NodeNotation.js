import { annotate } from 'rough-notation'
import {
  extendNodeDataKeys,
  normalizeNodeList,
  setNodeData
} from './NodeFeatureUtils'

const SVG_NS = 'http://www.w3.org/2000/svg'
const IDENTITY_MATRIX = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0
}

function readMatrix(element) {
  if (!element || typeof element.getScreenCTM !== 'function') return null
  const matrix = element.getScreenCTM()
  if (!matrix) return null
  const values = ['a', 'b', 'c', 'd', 'e', 'f'].map(key => matrix[key])
  if (!values.every(Number.isFinite)) return null
  return {
    a: values[0],
    b: values[1],
    c: values[2],
    d: values[3],
    e: values[4],
    f: values[5]
  }
}

function multiplyMatrices(left, right) {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f
  }
}

function invertMatrix(matrix) {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (!determinant) return null
  return {
    a: matrix.d / determinant,
    b: -matrix.b / determinant,
    c: -matrix.c / determinant,
    d: matrix.a / determinant,
    e: (matrix.c * matrix.f - matrix.d * matrix.e) / determinant,
    f: (matrix.b * matrix.e - matrix.a * matrix.f) / determinant
  }
}

// 将 rough-notation 的局部坐标转换为节点 group 的局部坐标。
function getRelativeMatrix(target, source) {
  const targetMatrix = readMatrix(target)
  const sourceMatrix = readMatrix(source)
  if (!targetMatrix || !sourceMatrix) return { ...IDENTITY_MATRIX }
  const inverseTarget = invertMatrix(targetMatrix)
  return inverseTarget
    ? multiplyMatrices(inverseTarget, sourceMatrix)
    : { ...IDENTITY_MATRIX }
}

function matrixToSvg(matrix) {
  return `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`
}

function readRect(rect) {
  if (!rect) return null
  const x = Number.isFinite(rect.left) ? rect.left : rect.x
  const y = Number.isFinite(rect.top) ? rect.top : rect.y
  const width = Number.isFinite(rect.width) ? rect.width : rect.right - x
  const height = Number.isFinite(rect.height) ? rect.height : rect.bottom - y
  if (![x, y, width, height].every(Number.isFinite)) return null
  return { x, y, width, height }
}

function transformRect(rect, matrix) {
  const points = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height]
  ].map(([x, y]) => ({
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f
  }))
  const x = Math.min(...points.map(point => point.x))
  const y = Math.min(...points.map(point => point.y))
  const right = Math.max(...points.map(point => point.x))
  const bottom = Math.max(...points.map(point => point.y))
  return { x, y, width: right - x, height: bottom - y }
}

function getShapeGroupRect(shapeNode, groupNode) {
  if (!shapeNode || typeof shapeNode.getBBox !== 'function') return null
  const bbox = readRect(shapeNode.getBBox())
  const matrix = getRelativeMatrix(groupNode, shapeNode)
  return bbox ? transformRect(bbox, matrix) : null
}

// rough-notation 用 CSS 像素生成路径，节点 group 则使用画布本地单位。
// 这里明确把 rough 的源矩形归一化到节点形状的本地 bbox，避免画布缩放重复作用。
function getAnnotationToNodeMatrix(shapeNode, annotationSvg, groupNode) {
  if (
    !shapeNode ||
    !annotationSvg ||
    typeof shapeNode.getBoundingClientRect !== 'function' ||
    typeof annotationSvg.getBoundingClientRect !== 'function'
  ) {
    return { ...IDENTITY_MATRIX }
  }
  const shapeClientRect = readRect(shapeNode.getBoundingClientRect())
  const annotationSvgClientRect = readRect(
    annotationSvg.getBoundingClientRect()
  )
  const shapeGroupRect = getShapeGroupRect(shapeNode, groupNode)
  if (!shapeClientRect || !annotationSvgClientRect || !shapeGroupRect) {
    return { ...IDENTITY_MATRIX }
  }
  if (shapeClientRect.width <= 0 || shapeClientRect.height <= 0) {
    return { ...IDENTITY_MATRIX }
  }
  const sourceRect = {
    x: shapeClientRect.x - annotationSvgClientRect.x,
    y: shapeClientRect.y - annotationSvgClientRect.y,
    width: shapeClientRect.width,
    height: shapeClientRect.height
  }
  const scaleX = shapeGroupRect.width / sourceRect.width
  const scaleY = shapeGroupRect.height / sourceRect.height
  if (![scaleX, scaleY].every(Number.isFinite)) {
    return { ...IDENTITY_MATRIX }
  }
  return {
    a: scaleX,
    b: 0,
    c: 0,
    d: scaleY,
    e: shapeGroupRect.x - sourceRect.x * scaleX,
    f: shapeGroupRect.y - sourceRect.y * scaleY
  }
}

function cloneAnnotationToNode(annotation, shapeNode, groupNode) {
  const sourceSvg = annotation && annotation._svg
  if (
    !sourceSvg ||
    !groupNode ||
    typeof document === 'undefined' ||
    typeof document.createElementNS !== 'function'
  ) {
    return null
  }
  const localGroup = document.createElementNS(SVG_NS, 'g')
  localGroup.setAttribute('class', 'rough-annotation')
  localGroup.setAttribute('pointer-events', 'none')
  localGroup.style.pointerEvents = 'none'
  localGroup.setAttribute(
    'transform',
    matrixToSvg(getAnnotationToNodeMatrix(shapeNode, sourceSvg, groupNode))
  )
  Array.from(sourceSvg.children || []).forEach(child => {
    localGroup.appendChild(child.cloneNode(true))
  })
  groupNode.appendChild(localGroup)
  return {
    _svg: localGroup,
    remove() {
      if (localGroup.parentNode) localGroup.parentNode.removeChild(localGroup)
    }
  }
}

// 节点圈画插件。rough-notation 的 SVG 结果挂在节点形状旁边，随画布一起缩放。
class NodeNotation {
  constructor({ mindMap } = {}) {
    this.mindMap = mindMap
    this.defaultConfig = {
      type: 'circle',
      color: mindMap.opt.hoverRectColor || '#3f9cfc',
      strokeWidth: 1,
      padding: 12,
      animate: true,
      brackets: ['left', 'right']
    }
    this.originalExportHandler = mindMap.opt.handleBeingExportSvg
    this.originalDragCloneHandler = mindMap.opt.handleDragCloneNode
    extendNodeDataKeys(mindMap, 'notation')
    this.bindEvent()
  }

  bindEvent() {
    this.renderNodeNotation = this.renderNodeNotation.bind(this)
    this.setNotation = this.setNotation.bind(this)
    this.handleBeingExportSvg = this.handleBeingExportSvg.bind(this)
    this.handleDragCloneNode = this.handleDragCloneNode.bind(this)
    this.mindMap.on('node_layout_end', this.renderNodeNotation)
    this.mindMap.command.add('SET_NOTATION', this.setNotation)
    this.mindMap.opt.handleBeingExportSvg = this.handleBeingExportSvg
    this.mindMap.opt.handleDragCloneNode = this.handleDragCloneNode
  }

  unBindEvent() {
    this.clearAnnotations()
    this.mindMap.off('node_layout_end', this.renderNodeNotation)
    this.mindMap.command.remove('SET_NOTATION', this.setNotation)
    if (this.mindMap.opt.handleBeingExportSvg === this.handleBeingExportSvg) {
      this.mindMap.opt.handleBeingExportSvg = this.originalExportHandler
    }
    if (this.mindMap.opt.handleDragCloneNode === this.handleDragCloneNode) {
      this.mindMap.opt.handleDragCloneNode = this.originalDragCloneHandler
    }
  }

  getRoots() {
    const renderer = this.mindMap.renderer
    if (renderer && typeof renderer.getAllRenderRoot === 'function') {
      return renderer.getAllRenderRoot()
    }
    return renderer && renderer.root ? [renderer.root] : []
  }

  clearAnnotations() {
    const walk = node => {
      if (!node) return
      if (node.notationObj && typeof node.notationObj.remove === 'function') {
        node.notationObj.remove()
        node.notationObj = null
      }
      ;(node.children || []).forEach(walk)
    }
    this.getRoots().forEach(walk)
  }

  setNotation(nodes, show, config = {}) {
    if (this.mindMap.opt.readonly) return
    const nodeList = normalizeNodeList(nodes, this.mindMap)
    nodeList.forEach(node => {
      setNodeData(this.mindMap, node, {
        notation: { show: Boolean(show), config: { ...config } }
      })
      node.needLayout = true
    })
    if (nodeList.length > 0) this.mindMap.render()
  }

  renderNodeNotation(node) {
    const notation = node.getData('notation')
    const shape = node.group && node.group.findOne('.smm-node-shape')
    if (!shape || !shape.node) return
    if (node.notationObj) {
      node.notationObj.remove()
      node.notationObj = null
    }
    if (!notation || !notation.show) return
    const config = { ...this.defaultConfig, ...(notation.config || {}) }
    const annotation = annotate(shape.node, config)
    annotation.show()
    let localAnnotation
    try {
      localAnnotation = cloneAnnotationToNode(
        annotation,
        shape.node,
        node.group.node
      )
    } finally {
      annotation.remove()
    }
    node.notationObj = localAnnotation
  }

  handleBeingExportSvg(svg) {
    const result =
      typeof this.originalExportHandler === 'function'
        ? this.originalExportHandler(svg)
        : svg
    if (!result || typeof result.find !== 'function') return result
    result.find('.rough-annotation').forEach(annotation => {
      annotation.find('*').forEach(child => {
        child.css('stroke-dashoffset', '')
        child.css('stroke-dasharray', '')
        child.css('animation', '')
      })
    })
    return result
  }

  handleDragCloneNode(node) {
    const result =
      typeof this.originalDragCloneHandler === 'function'
        ? this.originalDragCloneHandler(node)
        : node
    if (result && typeof result.find === 'function') {
      result
        .find('.rough-annotation')
        .forEach(annotation => annotation.remove())
    }
    return result
  }

  beforePluginRemove() {
    this.unBindEvent()
  }

  beforePluginDestroy() {
    this.unBindEvent()
  }
}

NodeNotation.instanceName = 'notation'

export { getRelativeMatrix }
export { getAnnotationToNodeMatrix }
export default NodeNotation
