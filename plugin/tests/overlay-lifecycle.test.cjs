const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const esbuild = require('../../web/node_modules/esbuild')

test('整图重新渲染清空画布后，气泡图层重新挂载', async () => {
  global.window = { addEventListener() {}, removeEventListener() {} }
  global.document = { body: {}, documentElement: {}, createElement: () => ({ style: {} }) }
  const result = await esbuild.build({ entryPoints: [path.resolve(__dirname, '../../simple-mind-map/src/plugins/NodeCallout.js')], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', nodePaths: [path.resolve(__dirname, '../../web/node_modules')] })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require)
  const instance = Object.create(module.exports.default.prototype)
  let attached = false
  instance.mindMap = { nodeDraw: { has: () => attached, add: () => { attached = true } } }
  instance.draw = { clear() {}, front() { assert.equal(attached, true, '气泡图层已经脱离画布') } }
  instance.getRoots = () => []
  assert.doesNotThrow(() => instance.renderChatDialogs())
})
