const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const parser = require('../../web/node_modules/@babel/parser')

function loadEditorSettings() {
  const esbuild = require('../../web/node_modules/esbuild')
  const built = esbuild.buildSync({ entryPoints: [path.resolve(__dirname, '../src/editor-settings.js')], bundle: true, platform: 'node', format: 'cjs', write: false })
  const result = { exports: {} }
  Function('module', 'exports', built.outputFiles[0].text)(result, result.exports)
  return result.exports
}

function extractBaseStyleMethod(methodName) {
  const filePath = path.join(
    __dirname,
    '../reference/src/pages/Edit/components/BaseStyle.vue'
  )
  const source = fs.readFileSync(filePath, 'utf8')
  const scriptStart = source.indexOf('<script>')
  const scriptEnd = source.indexOf('</script>', scriptStart)
  assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, 'BaseStyle.vue 脚本不存在')
  const script = source.slice(scriptStart + '<script>'.length, scriptEnd)
  const ast = parser.parse(script, {
    sourceType: 'module',
    plugins: ['objectRestSpread', 'optionalChaining']
  })
  const component = ast.program.body.find(
    node => node.type === 'ExportDefaultDeclaration'
  )?.declaration
  const methods = component?.properties?.find(
    node => node.key?.name === 'methods'
  )?.value
  const method = methods?.properties?.find(
    node => node.key?.name === methodName
  )
  assert.ok(method, `未找到 BaseStyle.methods.${methodName}`)
  return Function(`return ({${script.slice(method.start, method.end)}}).${methodName}`)()
}

test('全局自动保存时间覆盖本地旧值，并保留本地其他配置', () => {
  const { getMindMapLocalConfig } = loadEditorSettings()
  const localConfig = {
    autoSaveTime: 5,
    isZenMode: true,
    customOption: 'keep-me',
    isDark: false
  }
  const result = getMindMapLocalConfig(
    {
      mindMapLocalConfig: localConfig,
      autoSaveTime: 20,
      themeMode: 'follow'
    },
    true
  )

  assert.equal(result.autoSaveTime, 20)
  assert.equal(result.isZenMode, true)
  assert.equal(result.customOption, 'keep-me')
  assert.equal(result.isDark, true)
  assert.equal(localConfig.autoSaveTime, 5)
})

test('主题模式 follow、dark、light 分别计算 isDark', () => {
  const { getMindMapLocalConfig } = loadEditorSettings()
  const cases = [
    { themeMode: 'follow', obIsDark: true, expected: true },
    { themeMode: 'dark', obIsDark: false, expected: true },
    { themeMode: 'light', obIsDark: true, expected: false }
  ]

  for (const item of cases) {
    const result = getMindMapLocalConfig(
      {
        mindMapLocalConfig: { autoSaveTime: 5, isZenMode: false },
        autoSaveTime: 20,
        themeMode: item.themeMode
      },
      item.obIsDark
    )
    assert.equal(result.isDark, item.expected, item.themeMode)
    assert.equal(result.autoSaveTime, 20, item.themeMode)
  }
})

test('无效的全局自动保存时间回退到 5 秒', () => {
  const { getMindMapLocalConfig } = loadEditorSettings()
  for (const autoSaveTime of [0, -1, 1.5, 'invalid', null]) {
    const result = getMindMapLocalConfig(
      {
        mindMapLocalConfig: { autoSaveTime: 20 },
        autoSaveTime,
        themeMode: 'light'
      },
      true
    )
    assert.equal(result.autoSaveTime, 5, String(autoSaveTime))
  }
})

test('BaseStyle 外框边距初始化分别读取水平和垂直配置', () => {
  const initOuterFramePadding = extractBaseStyleMethod('initOuterFramePadding')
  const context = {
    outerFramePadding: {
      outerFramePaddingX: 0,
      outerFramePaddingY: 0
    },
    mindMap: {
      getConfig(key) {
        return {
          outerFramePaddingX: 10,
          outerFramePaddingY: 40
        }[key]
      }
    }
  }

  initOuterFramePadding.call(context)

  assert.equal(context.outerFramePadding.outerFramePaddingX, 10)
  assert.equal(context.outerFramePadding.outerFramePaddingY, 40)
})
