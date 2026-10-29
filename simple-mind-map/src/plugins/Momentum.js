// 画布拖动惯性插件

const DEFAULT_OPTIONS = {
  friction: 0.95,
  speedAmplificationFactor: 10,
  minSpeed: 1,
  maxSpeed: 80
}

export const decayVelocity = (velocity, friction = DEFAULT_OPTIONS.friction) => ({
  x: velocity.x * friction,
  y: velocity.y * friction
})

export const clampVelocity = (velocity, maxSpeed = DEFAULT_OPTIONS.maxSpeed) => ({
  x: Math.max(-maxSpeed, Math.min(maxSpeed, velocity.x)),
  y: Math.max(-maxSpeed, Math.min(maxSpeed, velocity.y))
})

const hasSpeed = (velocity, minSpeed) =>
  Math.abs(velocity.x) > minSpeed || Math.abs(velocity.y) > minSpeed

// 仅在画布拖动结束后继续平移，不参与节点拖动。
class Momentum {
  constructor({ mindMap, pluginOpt = {} }) {
    this.mindMap = mindMap
    this.opt = { ...DEFAULT_OPTIONS, ...pluginOpt }
    this.enabled = !!mindMap.opt.enableMomentum
    this.isMousedown = false
    this.lastX = 0
    this.lastY = 0
    this.lastTime = 0
    this.speedX = 0
    this.speedY = 0
    this.lastOffsetX = 0
    this.lastOffsetY = 0
    this.requestId = null
    this.onConfig = opt => this.setEnabled(!!opt.enableMomentum)
    mindMap.on('after_update_config', this.onConfig)
    this.bindEvent()
  }

  bindEvent() {
    this.onMousedown = this.onMousedown.bind(this)
    this.onMousemove = this.onMousemove.bind(this)
    this.onMouseup = this.onMouseup.bind(this)
    this.moveTo = this.moveTo.bind(this)
    this.mindMap.on('mousedown', this.onMousedown)
    this.mindMap.on('mousemove', this.onMousemove)
    this.mindMap.on('mouseup', this.onMouseup)
  }

  unBindEvent() {
    this.mindMap.off('after_update_config', this.onConfig)
    this.mindMap.off('mousedown', this.onMousedown)
    this.mindMap.off('mousemove', this.onMousemove)
    this.mindMap.off('mouseup', this.onMouseup)
  }

  isDragButton(event) {
    const button = this.mindMap.opt.useLeftKeySelectionRightKeyDrag ? 3 : 1
    return event && event.which === button
  }

  onMousedown(event) {
    if (!this.enabled || !this.isDragButton(event)) return
    this.stop()
    this.isMousedown = true
    this.lastX = event.clientX
    this.lastY = event.clientY
    this.lastTime = Date.now()
    this.lastOffsetX = 0
    this.lastOffsetY = 0
    this.speedX = 0
    this.speedY = 0
  }

  onMousemove(event, eventState) {
    if (!this.enabled || !this.isMousedown) return
    const now = Date.now()
    const elapsed = Math.max(now - this.lastTime, 1)
    const offset = eventState && eventState.mousemoveOffset
    const deltaX = offset ? offset.x - this.lastOffsetX : event.clientX - this.lastX
    const deltaY = offset ? offset.y - this.lastOffsetY : event.clientY - this.lastY
    this.lastOffsetX = offset ? offset.x : 0
    this.lastOffsetY = offset ? offset.y : 0
    this.speedX = (deltaX / elapsed) * this.opt.speedAmplificationFactor
    this.speedY = (deltaY / elapsed) * this.opt.speedAmplificationFactor
    this.lastX = event.clientX
    this.lastY = event.clientY
    this.lastTime = now
  }

  onMouseup() {
    if (!this.isMousedown) return
    this.isMousedown = false
    this.moveTo()
  }

  moveTo() {
    if (!this.enabled) return
    const velocity = clampVelocity(
      { x: this.speedX, y: this.speedY },
      this.opt.maxSpeed
    )
    if (!hasSpeed(velocity, this.opt.minSpeed)) {
      this.requestId = null
      return
    }
    this.speedX = velocity.x * this.opt.friction
    this.speedY = velocity.y * this.opt.friction
    this.mindMap.view.translateXY(this.speedX, this.speedY)
    const request =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : callback => setTimeout(callback, 16)
    this.requestId = request(this.moveTo)
  }

  stop() {
    if (this.requestId !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.requestId)
      } else {
        clearTimeout(this.requestId)
      }
      this.requestId = null
    }
    this.speedX = 0
    this.speedY = 0
  }

  setEnabled(enabled) {
    this.enabled = !!enabled
    if (!this.enabled) {
      this.isMousedown = false
      this.stop()
    }
  }

  beforePluginRemove() {
    this.unBindEvent()
    this.isMousedown = false
    this.stop()
  }

  beforePluginDestroy() {
    this.beforePluginRemove()
  }
}

Momentum.instanceName = 'momentum'

export default Momentum
