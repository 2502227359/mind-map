const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('../../web/node_modules/esbuild')
const JSZip = require('../../web/node_modules/jszip')

const repoRoot = path.resolve(__dirname, '../..')
const nodeModules = path.join(repoRoot, 'web/node_modules')

async function loadBundled(relativePath, plugins = []) {
  const entry = path.join(repoRoot, relativePath)
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    nodePaths: [nodeModules],
    plugins,
    logLevel: 'silent'
  })
  const compiledModule = new Module(entry, module)
  compiledModule.filename = entry
  compiledModule.paths = Module._nodeModulePaths(path.dirname(entry))
  compiledModule._compile(result.outputFiles[0].text, entry)
  return compiledModule.exports
}

const simpleMindMapExcelAlias = {
  name: 'simple-mind-map-excel-alias',
  setup(build) {
    build.onResolve(
      { filter: /^simple-mind-map\/src\/parse\/excel\.js$/ },
      () => ({
        path: path.join(repoRoot, 'simple-mind-map/src/parse/excel.js')
      })
    )
  }
}

test('FreeMind .mm 多根往返保留层级、链接和备注，并拒绝实体声明', async () => {
  const { transformToFreemind, parseFreemind } = await loadBundled(
    'simple-mind-map/src/parse/freemind.js'
  )
  const source = {
    data: {
      text: '根 & <',
      hyperlink: 'obsidian://open?vault=Vault&file=首页.md',
      note: '说明\n第二行',
      freeNodeTrees: [{ data: { text: '第二根' }, children: [] }]
    },
    children: [{ data: { text: '子' }, children: [] }]
  }
  const xml = transformToFreemind(source)
  assert.match(xml, /<map version="1\.0\.1">/)
  assert.match(xml, /LINK="obsidian:\/\/open\?vault=Vault&amp;file=首页\.md"/)
  assert.deepEqual(parseFreemind(xml), source)
  assert.throws(
    () => parseFreemind('<!DOCTYPE map><map><node TEXT="x"/></map>'),
    /DOCTYPE 或实体/
  )
})

test('Excel 表格转换保留多根和节点元数据', async () => {
  const { mindMapToExcelTable, rowsToMindMap } = await loadBundled(
    'simple-mind-map/src/parse/excel.js'
  )
  const source = {
    data: {
      text: '根',
      hyperlink: 'obsidian://open?vault=Vault&file=根.md',
      note: '根备注',
      freeNodeTrees: [{ data: { text: '第二根' }, children: [] }]
    },
    children: [{ data: { text: '子' }, children: [] }]
  }
  const table = mindMapToExcelTable(source)
  assert.deepEqual(table[0], ['节点1', '节点2', '链接', '备注'])
  assert.deepEqual(rowsToMindMap(table), source)
  const unsafe = rowsToMindMap([
    ['节点1', '链接'],
    ['根', 'javascript:alert(1)']
  ])
  assert.equal(unsafe.data.hyperlink, undefined)
})

test('宿主 xlsx 适配器可以生成并读取真实 .xlsx 数据', async () => {
  const { exportExcel, importExcel } = await loadBundled(
    'plugin/src/formats/excel.js',
    [simpleMindMapExcelAlias]
  )
  const source = {
    data: { text: '根' },
    children: [{ data: { text: '子' }, children: [] }]
  }
  const blob = exportExcel(source)
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  assert.ok(blob.size > 100)
  assert.deepEqual(await importExcel(blob), source)
})

test('XMind 多画布导出和导入保留多根映射', async () => {
  const previousDocument = global.document
  global.document = {
    documentElement: {
      requestFullScreen() {},
      webkitRequestFullScreen() {},
      mozRequestFullScreen() {},
      msRequestFullscreen() {}
    },
    createElement() {
      return {
        innerHTML: '',
        get textContent() {
          return this.innerHTML
        }
      }
    }
  }
  try {
    const xmindModule = await loadBundled('simple-mind-map/src/parse/xmind.js')
    const xmind = xmindModule.default || xmindModule
    const source = {
      root: {
        data: {
          text: '主根',
          imgMap: { freeImage: 'data:image/png;base64,AAAA' },
          freeNodeTrees: [{ data: { text: '自由根' }, children: [] }]
        },
        children: [{ data: { text: '主子' }, children: [] }]
      }
    }
    source.root.data.freeNodeTrees[0].data.image = 'freeImage'
    source.root.data.freeNodeTrees[0].data.imageSize = { width: 1, height: 1 }
    const blob = await xmind.transformToXmind(source, '地图')
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const sheets = JSON.parse(await zip.files['content.json'].async('string'))
    assert.equal(sheets.length, 2)
    assert.equal(sheets[0].rootTopic.title, '主根')
    assert.equal(sheets[1].rootTopic.title, '自由根')
    assert.equal(
      await zip.files['resources/image_0.png'].async('base64'),
      'AAAA'
    )

    let selectorCalls = 0
    const imported = await xmind.transformXmind(
      JSON.stringify(sheets),
      zip.files,
      async content => {
        selectorCalls += 1
        return content[1]
      }
    )
    assert.equal(selectorCalls, 1)
    assert.equal(imported.data.text, '自由根')
    assert.equal(imported.data.freeNodeTrees[0].data.text, '主根')
    assert.equal(imported.data.freeNodeTrees[0].children[0].data.text, '主子')

    const legacy = xmind.transformOldXmind(
      JSON.stringify({
        elements: [
          {
            name: 'xmap-content',
            elements: [
              {
                name: 'sheet',
                elements: [
                  {
                    name: 'topic',
                    elements: [{ name: 'title', elements: [{ text: '旧主根' }] }]
                  }
                ]
              },
              {
                name: 'sheet',
                elements: [
                  {
                    name: 'topic',
                    elements: [{ name: 'title', elements: [{ text: '旧自由根' }] }]
                  }
                ]
              }
            ]
          }
        ]
      })
    )
    assert.equal(legacy.data.text, '旧主根')
    assert.equal(legacy.data.freeNodeTrees[0].data.text, '旧自由根')
  } finally {
    global.document = previousDocument
  }
})

test('Markdown 和 TXT 多根导入保留主根与自由根，单根语义不变', async () => {
  const previousDocument = global.document
  global.document = { documentElement: {} }
  try {
    const markdownModule = await loadBundled(
      'simple-mind-map/src/parse/markdown.js'
    )
    const markdown = markdownModule.default || markdownModule
    const markdownTree = markdown.transformMarkdownTo(
      '# 主根\n\n## 主子\n\n# 自由根\n\n## 自由子'
    )
    assert.equal(markdownTree.data.text, '主根')
    assert.equal(markdownTree.children[0].data.text, '主子')
    assert.equal(markdownTree.data.freeNodeTrees[0].data.text, '自由根')
    assert.equal(
      markdownTree.data.freeNodeTrees[0].children[0].data.text,
      '自由子'
    )
    const markdownSingle = markdown.transformMarkdownTo('# 单根\n\n## 子')
    assert.equal(markdownSingle.data.text, '单根')
    assert.equal(markdownSingle.data.freeNodeTrees, undefined)

    const txtModule = await loadBundled('plugin/reference/src/utils/txt.js')
    const txt = txtModule.default || txtModule
    const txtTree = txt.txtTo(
      ' 主根\n\n    主子\n\n 自由根\n\n    自由子'
    )
    assert.equal(txtTree.data.text, '主根')
    assert.equal(txtTree.children[0].data.text, '主子')
    assert.equal(txtTree.data.freeNodeTrees[0].data.text, '自由根')
    assert.equal(
      txtTree.data.freeNodeTrees[0].children[0].data.text,
      '自由子'
    )
    const txtSingle = txt.txtTo(' 单根\n\n    子')
    assert.equal(txtSingle.data.text, '单根')
    assert.equal(txtSingle.data.freeNodeTrees, undefined)
  } finally {
    global.document = previousDocument
  }
})
