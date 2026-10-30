'use strict'

class SaveConflictError extends Error {
  constructor(message = '文件内容已被外部修改') {
    super(message)
    this.name = 'SaveConflictError'
  }
}

class SaveCoordinator {
  constructor({ raw = '', write, onState, delay = 800, maxWait = 5000 } = {}) {
    if (typeof write !== 'function') {
      throw new TypeError('SaveCoordinator 需要 write(expectedRaw, nextRaw) 函数')
    }

    this._write = write
    this._onState = typeof onState === 'function' ? onState : null
    this._delay = Math.max(0, Number(delay) || 0)
    this._maxWait = Math.max(this._delay, Number(maxWait) || 0)
    this._currentRaw = String(raw)
    this._baseRaw = this._currentRaw
    this._pendingRaw = null
    this._dirty = false
    this._state = 'ready'
    this._deleted = false
    this._disposed = false
    this._firstDirtyAt = null
    this._debounceTimer = null
    this._maxWaitTimer = null
    this._flushPromise = null
  }

  get currentRaw() {
    return this._currentRaw
  }

  get baseRaw() {
    return this._baseRaw
  }

  get dirty() {
    return this._dirty
  }

  get state() {
    return this._state
  }

  setDelay(delay) {
    if (this._disposed) return
    const next = Math.max(0, Number(delay) || 0)
    if (next === this._delay) return
    this._delay = next
    this._maxWait = next
    this._clearTimers()
    this._firstDirtyAt = null
    if (this._dirty && !this._flushPromise && !['conflict', 'deleted'].includes(this._state)) this._scheduleSave()
  }

  update(nextRaw) {
    if (this._disposed) return

    this._currentRaw = String(nextRaw)
    this._dirty = this._currentRaw !== this._baseRaw

    if (!this._dirty) {
      this._firstDirtyAt = null
      this._clearTimers()
      if (this._state !== 'saving' && this._state !== 'deleted') {
        this._setState('ready')
      }
      return
    }

    if (this._state !== 'conflict' && this._state !== 'deleted') {
      if (this._state !== 'saving') this._setState('dirty')
      if (!this._flushPromise) this._scheduleSave()
    }
  }

  async flush() {
    if (this._disposed || this._deleted) return false
    if (this._state === 'conflict') {
      throw new SaveConflictError()
    }
    if (this._flushPromise) return this._flushPromise
    if (!this._dirty) return false

    this._clearTimers()
    const operation = this._flushLoop()
    this._flushPromise = operation
    try {
      return await operation
    } finally {
      if (this._flushPromise === operation) this._flushPromise = null
    }
  }

  acceptExternal(raw) {
    const nextRaw = String(raw)
    if (this._disposed) return 'self'
    if (nextRaw === this._pendingRaw || nextRaw === this._baseRaw) {
      return 'self'
    }
    if (this._deleted) return 'conflict'
    if (this._dirty || this._flushPromise) {
      this._clearTimers()
      this._firstDirtyAt = null
      this._setState('conflict')
      return 'conflict'
    }

    this._currentRaw = nextRaw
    this._baseRaw = nextRaw
    this._setState('ready')
    return 'reload'
  }

  setDeleted() {
    if (this._disposed) return
    this._deleted = true
    this._clearTimers()
    this._setState('deleted')
  }

  dispose() {
    if (this._disposed) return
    this._disposed = true
    this._clearTimers()
    this._setState('disposed')
  }

  async _flushLoop() {
    while (this._dirty && !this._deleted && !this._disposed) {
      if (this._state === 'conflict') throw new SaveConflictError()

      const expectedRaw = this._baseRaw
      const nextRaw = this._currentRaw
      this._pendingRaw = nextRaw
      this._setState('saving')

      try {
        await this._write(expectedRaw, nextRaw)
      } catch (error) {
        if (this._pendingRaw === nextRaw) this._pendingRaw = null
        this._firstDirtyAt = null
        if (!this._deleted && !this._disposed) {
          this._setState(error instanceof SaveConflictError ? 'conflict' : 'error', error)
        }
        throw error
      }

      if (this._pendingRaw === nextRaw) this._pendingRaw = null
      if (this._state === 'conflict') throw new SaveConflictError()

      this._baseRaw = nextRaw
      this._dirty = this._currentRaw !== this._baseRaw
      if (this._deleted || this._disposed) continue
      if (!this._dirty) {
        this._firstDirtyAt = null
        this._setState('ready')
      } else {
        this._setState('dirty')
      }
    }

    return true
  }

  _scheduleSave() {
    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer)
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null
      void this.flush().catch(() => {})
    }, this._delay)

    if (this._firstDirtyAt === null) {
      this._firstDirtyAt = Date.now()
      this._maxWaitTimer = setTimeout(() => {
        this._maxWaitTimer = null
        void this.flush().catch(() => {})
      }, this._maxWait)
    }
  }

  _clearTimers() {
    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer)
    if (this._maxWaitTimer !== null) clearTimeout(this._maxWaitTimer)
    this._debounceTimer = null
    this._maxWaitTimer = null
  }

  _setState(state, error) {
    this._state = state
    if (this._onState) this._onState(state, error)
  }
}

module.exports = { SaveConflictError, SaveCoordinator }
