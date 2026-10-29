const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('../../web/node_modules/esbuild')

const repoRoot = path.resolve(__dirname, '../..')

async function loadModule(entryPoint) {
  const entry = path.join(repoRoot, entryPoint)
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    logLevel: 'silent'
  })
  const compiledModule = new Module(entry, module)
  compiledModule.filename = entry
  compiledModule.paths = Module._nodeModulePaths(path.dirname(entry))
  compiledModule._compile(result.outputFiles[0].text, entry)
  return compiledModule.exports
}

test('内链悬停只接受 Obsidian 文件链接，并去掉 wiki 包装与别名', async () => {
  const { isPreviewableLink, normalizeHoverLink } = await loadModule(
    'plugin/src/link-hover.js'
  )
  assert.equal(isPreviewableLink('https://example.com', ''), false)
  assert.equal(isPreviewableLink('notes/topic.md', '[[notes/topic.md|主题]]'), true)
  assert.equal(isPreviewableLink('image.png', ''), true)
  assert.equal(normalizeHoverLink('image.png', '![[image.png|预览]]'), 'image.png')
})

test('悬停触发负载使用预览来源、当前文件和原始目标元素', async () => {
  const { createHoverLinkPayload } = await loadModule('plugin/src/link-hover.js')
  const targetEl = { nodeType: 1 }
  const event = { type: 'mouseenter' }
  assert.deepEqual(
    createHoverLinkPayload({
      event,
      targetEl,
      linktext: 'notes/topic.md',
      sourcePath: 'map.smm.md'
    }),
    {
      event,
      source: 'preview',
      hoverParent: { hoverPopover: null },
      targetEl,
      linktext: 'notes/topic.md',
      sourcePath: 'map.smm.md'
    }
  )
})
