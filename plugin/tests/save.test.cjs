const test = require('node:test')
const assert = require('node:assert/strict')

const { SaveConflictError, SaveCoordinator } = require('../src/document/save.js')

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test('修改自动保存间隔会重新安排尚未写入的快照', async () => {
  const written = deferred()
  const coordinator = new SaveCoordinator({ raw: 'old', delay: 10000, write: async () => written.resolve('saved') })
  coordinator.update('next')
  try {
    coordinator.setDelay(5)
    const result = await Promise.race([written.promise, new Promise(resolve => setTimeout(() => resolve('timeout'), 200))])
    assert.equal(result, 'saved')
    await coordinator.flush()
    assert.equal(coordinator.baseRaw, 'next')
  } finally { coordinator.dispose() }
})

test('保存时序：写入期间的更新会继续保存最新快照', async () => {
  const calls = []
  const firstWrite = deferred()
  const write = (expectedRaw, nextRaw) => {
    calls.push({ expectedRaw, nextRaw })
    return calls.length === 1 ? firstWrite.promise : Promise.resolve()
  }
  const coordinator = new SaveCoordinator({
    raw: 'a',
    write,
    delay: 1000,
    maxWait: 5000
  })

  coordinator.update('b')
  const saving = coordinator.flush()
  await Promise.resolve()
  coordinator.update('c')
  firstWrite.resolve()

  await saving
  assert.deepEqual(calls, [
    { expectedRaw: 'a', nextRaw: 'b' },
    { expectedRaw: 'b', nextRaw: 'c' }
  ])
  assert.equal(coordinator.currentRaw, 'c')
  assert.equal(coordinator.baseRaw, 'c')
  assert.equal(coordinator.dirty, false)
  assert.equal(coordinator.state, 'ready')

  coordinator.dispose()
})

test('保存失败保留未保存状态，自动保存失败不会产生未处理拒绝', async () => {
  const states = []
  let shouldFail = true
  const coordinator = new SaveCoordinator({
    raw: 'a',
    write: async () => {
      if (shouldFail) throw new Error('disk full')
    },
    onState: state => states.push(state),
    delay: 5,
    maxWait: 50
  })

  coordinator.update('b')
  await assert.rejects(coordinator.flush(), /disk full/)
  assert.equal(coordinator.baseRaw, 'a')
  assert.equal(coordinator.currentRaw, 'b')
  assert.equal(coordinator.dirty, true)
  assert.equal(coordinator.state, 'error')

  shouldFail = false
  coordinator.update('c')
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(coordinator.baseRaw, 'c')
  assert.equal(coordinator.dirty, false)
  assert.equal(coordinator.state, 'ready')
  assert.ok(states.includes('error'))

  coordinator.dispose()
})

test('外部变化：干净时重新加载，脏时进入冲突并拒绝写入', async () => {
  let writes = 0
  const coordinator = new SaveCoordinator({
    raw: 'a',
    write: async () => {
      writes += 1
    },
    delay: 1000
  })

  assert.equal(coordinator.acceptExternal('b'), 'reload')
  assert.equal(coordinator.currentRaw, 'b')
  assert.equal(coordinator.baseRaw, 'b')
  assert.equal(coordinator.dirty, false)

  coordinator.update('c')
  assert.equal(coordinator.acceptExternal('external'), 'conflict')
  assert.equal(coordinator.state, 'conflict')
  assert.equal(coordinator.currentRaw, 'c')
  assert.equal(coordinator.dirty, true)
  await assert.rejects(coordinator.flush(), error => error instanceof SaveConflictError)
  assert.equal(writes, 0)

  coordinator.dispose()
})

test('自身写入事件在写入 Promise 完成前到达时不会误判为外部修改', async () => {
  const writeDone = deferred()
  let coordinator
  const coordinatorStates = []
  const write = async (expectedRaw, nextRaw) => {
    assert.equal(coordinator.acceptExternal(nextRaw), 'self')
    await writeDone.promise
  }
  coordinator = new SaveCoordinator({
    raw: 'a',
    write,
    onState: state => coordinatorStates.push(state),
    delay: 1000
  })

  coordinator.update('b')
  const saving = coordinator.flush()
  await Promise.resolve()
  assert.equal(coordinator.state, 'saving')
  writeDone.resolve()
  await saving
  assert.equal(coordinator.baseRaw, 'b')
  assert.equal(coordinator.dirty, false)
  assert.equal(coordinator.state, 'ready')
  assert.ok(coordinatorStates.includes('saving'))

  coordinator.dispose()
})

test('文件删除后阻止新的写入并保留当前快照', async () => {
  let writes = 0
  const coordinator = new SaveCoordinator({
    raw: 'a',
    write: async () => {
      writes += 1
    },
    delay: 1000
  })

  coordinator.update('b')
  coordinator.setDeleted()
  await coordinator.flush()
  assert.equal(writes, 0)
  assert.equal(coordinator.currentRaw, 'b')
  assert.equal(coordinator.dirty, true)
  assert.equal(coordinator.state, 'deleted')

  coordinator.dispose()
})
