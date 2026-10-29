// 虚线连线流动动画插件

const STYLE_KEY = 'lineFlowPluginStyle'

export const getDasharrayTotal = dasharray => {
  const values = String(dasharray)
    .split(/[ ,]+/)
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value > 0)
  if (!values.length) return 0
  const total = values.reduce((sum, value) => sum + value, 0)
  // SVG 对奇数长度的 dasharray 会把整个列表重复一次，而不是只补首项。
  return values.length % 2 ? total * 2 : total
}

const isFlowDasharray = dasharray =>
  dasharray !== undefined && dasharray !== null && String(dasharray) !== 'none' && String(dasharray) !== ''

const safeClassPart = value => String(value).replace(/[^a-zA-Z0-9_-]/g, '-')

class LineFlow {
  constructor({ mindMap, pluginOpt = {} }) {
    this.mindMap = mindMap
    this.pluginOpt = pluginOpt
    this.enabled = pluginOpt.enabled !== false
    this.originCustomHandleLine = mindMap.opt.customHandleLine
    this.moveClassMap = new Map()
    this.styleText = ''
    this.handleLine = this.handleLine.bind(this)
    mindMap.opt.customHandleLine = this.handleLine
  }

  getDuration(ctx) {
    const value = Number(ctx.style.merge('lineFlowDuration'))
    return Number.isFinite(value) && value > 0 ? value : 1
  }

  getForward(ctx) {
    return ctx.style.merge('lineFlowForward') !== false
  }

  joinClassName(total, duration, forward) {
    return `smm-line-move-${safeClassPart(total)}-${safeClassPart(duration)}-${forward ? 1 : 2}`
  }

  createStyle(className, duration, dashTotal, forward) {
    const offset = (forward ? -1 : 1) * dashTotal
    return `.${className} {
  animation: ${className} ${duration}s linear infinite;
  stroke-dashoffset: 0;
}
@keyframes ${className} {
  to { stroke-dashoffset: ${offset}; }
}`
  }

  appendStyle(className, css) {
    if (!this.moveClassMap.has(className)) {
      this.moveClassMap.set(className, css)
      this.styleText = [...this.moveClassMap.values()].join('\n')
      this.mindMap.removeAppendCss(STYLE_KEY)
      this.mindMap.appendCss(STYLE_KEY, this.styleText)
    }
  }

  removeLineClass(line) {
    const className = line && line.attr('data-move-class-name')
    if (!className) return
    if (typeof line.removeClass === 'function') line.removeClass(className)
    line.attr('data-move-class-name', '')
  }

  handleLine(ctx, line, style = {}) {
    const { dasharray } = style
    if (this.originCustomHandleLine && this.originCustomHandleLine !== this.handleLine) {
      this.originCustomHandleLine(ctx, line, style)
    }
    const flowEnabled = this.enabled && ctx.style.merge('lineFlow')
    if (!flowEnabled || !isFlowDasharray(dasharray)) {
      this.removeLineClass(line)
      return
    }
    const dashTotal = getDasharrayTotal(dasharray)
    if (!dashTotal) {
      this.removeLineClass(line)
      return
    }
    const duration = this.getDuration(ctx)
    const forward = this.getForward(ctx)
    const className = this.joinClassName(dashTotal, duration, forward)
    const oldClassName = line.attr('data-move-class-name')
    if (oldClassName === className) return
    if (oldClassName && typeof line.removeClass === 'function') {
      line.removeClass(oldClassName)
    }
    line.addClass(className)
    line.attr('data-move-class-name', className)
    this.appendStyle(
      className,
      this.createStyle(className, duration, dashTotal, forward)
    )
  }

  walkLines() {
    const roots =
      typeof this.mindMap.renderer?.getAllRenderRoot === 'function'
        ? this.mindMap.renderer.getAllRenderRoot()
        : [this.mindMap.renderer && this.mindMap.renderer.root]
    const lines = []
    const visit = node => {
      if (!node) return
      if (Array.isArray(node._lines)) lines.push(...node._lines)
      if (Array.isArray(node.children)) node.children.forEach(visit)
    }
    roots.filter(Boolean).forEach(visit)
    return lines
  }

  cleanup() {
    this.walkLines().forEach(line => this.removeLineClass(line))
    this.mindMap.removeAppendCss(STYLE_KEY)
    this.moveClassMap.clear()
    this.styleText = ''
    if (this.mindMap.opt.customHandleLine === this.handleLine) {
      this.mindMap.opt.customHandleLine = this.originCustomHandleLine
    }
  }

  setEnabled(enabled) {
    this.enabled = !!enabled
    if (this.enabled) {
      this.mindMap.opt.customHandleLine = this.handleLine
    } else {
      this.cleanup()
    }
  }

  beforePluginRemove() {
    this.cleanup()
  }

  beforePluginDestroy() {
    this.cleanup()
  }
}

LineFlow.instanceName = 'lineFlow'

export default LineFlow
