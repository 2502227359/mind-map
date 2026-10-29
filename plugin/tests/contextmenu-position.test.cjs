const test = require('node:test')
const assert = require('node:assert/strict')
const esbuild = require('../../web/node_modules/esbuild')
const path = require('node:path')

async function load() {
  const result = await esbuild.build({ entryPoints: [path.resolve(__dirname, '../reference/src/utils/contextmenuPosition.js')], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent' })
  const mod = { exports: {} }
  new Function('module', 'exports', result.outputFiles[0].text)(mod, mod.exports)
  return mod.exports
}

test('靠右和靠底的多级菜单按各自宽高翻转、限位，不混用画布坐标', async () => {
  const { placeSubmenu, placeContextMenu } = await load()
  assert.deepEqual(placeSubmenu({ left: 760, right: 1010, top: 437 }, { width: 230, height: 508 }, { width: 1032, height: 836 }), { left: 531, top: 320 })
  assert.deepEqual(placeSubmenu({ left: 531, right: 761, top: 480 }, { width: 210, height: 90 }, { width: 1032, height: 836 }), { left: 760, top: 474 })
  assert.deepEqual(placeContextMenu({ x: 1020, y: 790 }, { width: 250, height: 590 }, { left: 344, right: 1032, top: 120, bottom: 808 }), { left: 430, top: 90 })
})
