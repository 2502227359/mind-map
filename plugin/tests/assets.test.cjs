const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'obsidian') {
    return {
      normalizePath: value => String(value || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''),
      parseLinktext: value => ({ path: String(value || '') })
    }
  }
  return originalLoad.call(this, request, parent, isMain)
}
const { AssetStore } = require('../src/assets.js')
Module._load = originalLoad

function createApp({ permissionError = false } = {}) {
  const directories = new Set()
  const files = new Map()
  const calls = []
  const adapter = {
    exists: async path => directories.has(path) || files.has(path),
    write: async (path, value) => {
      calls.push(['write', path])
      files.set(path, value)
    }
  }
  const vault = {
    adapter,
    getAbstractFileByPath: () => null,
    createFolder: async path => {
      calls.push(['mkdir', path])
      if (permissionError) {
        directories.add(path)
        throw new Error('permission denied')
      }
      if (directories.has(path)) throw new Error('Folder already exists')
      directories.add(path)
    },
    create: async (path, value) => {
      calls.push(['create', path])
      if (directories.has(path) || files.has(path)) throw new Error('File already exists')
      files.set(path, value)
    }
  }
  return { app: { vault }, calls, files }
}

function createStore(app) {
  return new AssetStore(app, () => ({
    embedImageIsSeparateFileFolder: '.smm-embed-image-files'
  }))
}

test('隐藏目录和文件未被索引时可重复保存，源路径不会碰撞', async () => {
  const state = createApp()
  const store = createStore(state.app)
  const firstPath = await store.saveSvg('<svg>one</svg>', { path: 'a/b.smm.md' })
  const secondPath = await store.saveSvg('<svg>two</svg>', { path: 'a/b.smm.md' })
  const siblingPath = await store.saveSvg('<svg>three</svg>', { path: 'a_b.smm.md' })

  assert.equal(firstPath, '.smm-embed-image-files/a/b.svg')
  assert.equal(secondPath, firstPath)
  assert.equal(siblingPath, '.smm-embed-image-files/a_b.svg')
  assert.equal(state.files.get(firstPath), '<svg>two</svg>')
  assert.equal(state.files.get(siblingPath), '<svg>three</svg>')
  assert.deepEqual(state.calls.filter(([kind]) => kind === 'mkdir'), [
    ['mkdir', '.smm-embed-image-files'],
    ['mkdir', '.smm-embed-image-files/a']
  ])
})

test('目录创建的真实权限错误不会因路径出现而被吞掉', async () => {
  const state = createApp({ permissionError: true })
  const store = createStore(state.app)

  await assert.rejects(
    store.saveSvg('<svg>error</svg>', { path: 'a/b.smm.md' }),
    /permission denied/
  )
})

test('根目录导图上传中文附件时保持库内相对路径', async () => {
  const state = createApp()
  state.app.vault.createBinary = async (path, value) => state.files.set(path, value)
  const store = new AssetStore(state.app, () => ({
    imagePathType: 'currentFileFolder', compressImage: false
  }))
  const file = { name: '中文附件.png', type: 'image/png', arrayBuffer: async () => new ArrayBuffer(4) }
  const path = await store.saveFile(file, { path: '导图.smm.md', parent: { path: '/' } })
  assert.equal(path, '中文附件.png')
  assert.equal(state.files.get(path).byteLength, 4)
})
