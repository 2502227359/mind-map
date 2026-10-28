const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('../../web/node_modules/esbuild')
const JSZip = require('../../web/node_modules/jszip')

const repoRoot = path.resolve(__dirname, '../..')
const nodeModules = path.join(repoRoot, 'web/node_modules')

test('扩展导出接口返回可读取的格式数据，HTML 等待 SVG 资源转换', async () => {
  const Export = await loadBundled('simple-mind-map/src/plugins/Export.js')
  const root = { data: { text: '中心' }, children: [{ data: { text: '子节点' }, children: [] }] }
  const exporter = new Export({ mindMap: { getData: () => root } })
  const decode = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64').toString('utf8')
  assert.match(decode(await exporter.mmd('示例')), /^mindmap/m)
  assert.match(decode(await exporter.opml('示例')), /<opml\b/)
  let svgReady = false
  let svgArgs
  exporter.svg = async (...args) => {
    svgArgs = args
    await Promise.resolve()
    svgReady = true
    return 'data:image/svg+xml;base64,PHN2Zy8+'
  }
  const html = decode(await exporter.html('示例'))
  assert.equal(svgReady, true)
  assert.equal(svgArgs[3], true)
  assert.match(html, /data:image\/svg\+xml;base64,PHN2Zy8\+/)
})

test('HTML 的图片和背景加载失败会拒绝导出，不生成缺图文件或挂起', async () => {
  const Export = await loadBundled('simple-mind-map/src/plugins/Export.js', [{
    name: 'failed-export-images',
    setup(build) {
      build.onResolve({ filter: /^\.\.\/utils$/ }, args => {
        if (path.basename(args.importer) === 'Export.js') return { path: 'images', namespace: 'failed-export-images' }
      })
      build.onLoad({ filter: /.*/, namespace: 'failed-export-images' }, () => ({
        loader: 'js',
        contents: `
          export const imgToDataUrl = async () => { throw new Error('图片解码失败') }
          export const downloadFile = () => {};
          export const readBlob = () => {};
          export const removeHTMLEntities = x => x;
          export const resizeImgSize = () => {};
          export const handleSelfCloseTags = x => x;
          export const addXmlns = () => {};
          export const htmlEscape = x => x;
        `
      }))
    }
  }])
  const exporter = new Export({ mindMap: {
    opt: { errorHandler() {} }, themeConfig: { backgroundImage: '失效图片' },
    getSvgData: () => ({ svg: { svg: () => '<svg />' }, svgHTML: '<svg />' })
  } })
  exporter.createTransformImgTaskList = () => [Promise.reject(new Error('图片解码失败'))]
  await assert.rejects(exporter.getSvgData(null, true), /图片解码失败/)
  await assert.rejects(exporter.drawBackgroundToSvg({ css() {} }), /图片解码失败/)
})

function installDomStubs() {
  if (!global.window) {
    global.window = {
      addEventListener() {},
      removeEventListener() {}
    }
  }
  if (!global.document) {
    const body = {
      appendChild() {},
      removeChild() {},
      addEventListener() {},
      removeEventListener() {}
    }
    global.document = {
      body,
      documentElement: body,
      defaultView: global.window,
      createElement() {
        return {
          style: {},
          classList: { add() {}, remove() {} },
          addEventListener() {},
          removeEventListener() {},
          appendChild() {},
          removeChild() {},
          setAttribute() {}
        }
      },
      addEventListener() {},
      removeEventListener() {}
    }
  }
  if (!global.FileReader) {
    global.FileReader = class {
      readAsArrayBuffer(blob) {
        blob.arrayBuffer().then(buffer => {
          this.result = buffer
          this.onload({ target: this })
        })
      }

      readAsDataURL(blob) {
        blob.arrayBuffer().then(buffer => {
          this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buffer).toString('base64')}`
          this.onload({ target: this })
        })
      }
    }
  }
}

async function loadBundled(entryPoint, plugins = []) {
  installDomStubs()
  const entry = path.join(repoRoot, entryPoint)
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
  return compiledModule.exports.default || compiledModule.exports
}

test('Markdown 导出支持限制最大标题级别，同时保留默认六级行为', async () => {
  const markdownModule = await loadBundled(
    'simple-mind-map/src/parse/toMarkdown.js'
  )
  const transformToMarkdown = markdownModule.transformToMarkdown
  const root = {
    data: { text: '根' },
    children: [
      {
        data: { text: '一' },
        children: [
          {
            data: { text: '二' },
            children: [
              {
                data: { text: '三' },
                children: []
              }
            ]
          }
        ]
      }
    ]
  }

  assert.match(transformToMarkdown(root, 2), /^# 根\n\n## 一\n\n   \* 二\n\n      \* 三/m)
  assert.match(transformToMarkdown(root, '3'), /^# 根\n\n## 一\n\n### 二\n\n   \* 三/m)
  assert.match(transformToMarkdown(root), /^# 根\n\n## 一\n\n### 二\n\n#### 三/m)
})

test('JSON 导出等待 transformMindMapData 并写入转换后的数据', async () => {
  const Export = await loadBundled('simple-mind-map/src/plugins/Export.js')
  const exporter = new Export({
    mindMap: {
      getData: () => ({ root: { data: { text: '原始' }, children: [] } })
    }
  })
  const result = await exporter.json('地图', true, async data => {
    await Promise.resolve()
    data.root.data.text = '转换后'
  })
  const text = Buffer.from(result.split(',')[1], 'base64').toString('utf8')
  assert.match(text, /转换后/)
})

test('SVG 导出透明背景参数不会绘制背景', async () => {
  const Export = await loadBundled('simple-mind-map/src/plugins/Export.js', [
    {
      name: 'svg-stub',
      setup(build) {
        build.onResolve({ filter: /^@svgdotjs\/svg\.js$/ }, () => ({
          path: 'svg-stub',
          namespace: 'engine-contracts'
        }))
        build.onLoad({ filter: /.*/, namespace: 'engine-contracts' }, () => ({
          contents: `
            class FakeSvg { first() { return { before() {} } } svg() { return '<svg />' } }
            export function SVG(value) { return { value } }
            export function ForeignObject() { return new FakeSvg() }
          `,
          loader: 'js'
        }))
      }
    }
  ])
  const exporter = new Export({
    mindMap: {
      renderer: { textEdit: { hideEditTextBox() {} } }
    }
  })
  let backgroundCalls = 0
  let titleMarkup
  exporter.getSvgData = async () => ({
    node: { first: () => ({ before(title) { titleMarkup = title.value } }), svg: () => '<svg />' }
  })
  exporter.drawBackgroundToSvg = async () => {
    backgroundCalls += 1
  }
  exporter.fixSvgStrAndToBlob = async value => value

  await exporter.svg('地图', true)
  assert.equal(backgroundCalls, 0)
  await exporter.svg('地图', false)
  assert.equal(backgroundCalls, 1)
  await exporter.svg('A&B <节点>', true)
  assert.equal(titleMarkup, '<title>A&amp;B &lt;节点&gt;</title>')
})

test('XMind 导出使用根节点 imgMap 解析节点图片资源', async () => {
  const xmind = await loadBundled('simple-mind-map/src/parse/xmind.js')
  const blob = await xmind.transformToXmind(
    {
      data: {
        uid: 'root',
        text: '根',
        imgMap: { vaultImage: 'data:image/png;base64,AAAA' }
      },
      children: [
        {
          data: {
            uid: 'child',
            text: '图片',
            image: 'vaultImage',
            imageSize: { width: 1, height: 1 }
          },
          children: []
        }
      ]
    },
    '地图'
  )
  const zip = await JSZip.loadAsync(blob)
  assert.ok(zip.files['resources/image_0.png'])
  assert.equal(
    await zip.files['resources/image_0.png'].async('base64'),
    'AAAA'
  )
})

test('超链接节点支持动态图标并把原始事件传给跳转回调，标签支持双击事件', async () => {
  const nodeContents = await loadBundled(
    'simple-mind-map/src/core/render/node/nodeCreateContents.js',
    [
      {
        name: 'svg-stub',
        setup(build) {
          build.onResolve({ filter: /^@svgdotjs\/svg\.js$/ }, () => ({
            path: 'svg-stub',
            namespace: 'engine-contracts'
          }))
          build.onLoad({ filter: /.*/, namespace: 'engine-contracts' }, () => ({
            contents: `
              class FakeElement {
                constructor(value) {
                  this.value = value
                  this.children = []
                  this.handlers = {}
                  this.node = { handlers: this.handlers, addEventListener: (name, fn) => { this.handlers[name] = fn } }
                  this.node.textContent = value || ''
                }
                size() { return this }
                to(value) { this.toValue = value; return this }
                target(value) { this.targetValue = value; return this }
                add(value) { this.children.push(value); return this }
                addClass() { return this }
                attr() { return this }
                rect() { const value = new FakeElement(); this.children.push(value); return value }
                fill() { return this }
                stroke() { return this }
                css() { return this }
                x() { return this }
                y() { return this }
                cy() { return this }
                text(value) { this.node.textContent = value; return this }
                bbox() { return { width: String(this.node.textContent || '').length * 8, height: 16 } }
                on(name, fn) { this.handlers[name] = fn; return this }
              }
              export function SVG(value) { return new FakeElement(value) }
              export function A() { return new FakeElement() }
              export function G() { return new FakeElement() }
              export function Rect() { return new FakeElement() }
              export function Text() { return new FakeElement() }
              export function Image() { return new FakeElement() }
              export function ForeignObject() { return new FakeElement() }
            `,
            loader: 'js'
          }))
        }
      }
    ]
  )
  const events = []
  const ctx = {
    getData(key) {
      if (key === 'tag') return [{ text: '标签' }]
      return {
        hyperlink: 'https://example.com',
        hyperlinkTitle: '外链'
      }
    },
    getNodeIconSize: () => 16,
    style: {
      iconNode() {},
      tagText() {},
      tagRect() {}
    },
    mindMap: {
      opt: {
        maxTag: 5,
        hyperlinkIcon: { icon: 'default', style: {} },
        dynamicGetHyperlinkIcon(node, link, title) {
          events.push(['icon', node, link, title])
          return { icon: 'dynamic', style: { color: 'red' } }
        },
        customHyperlinkJump(...args) {
          events.push(['jump', ...args])
        },
        tagsColorMap: {}
      },
      emit(...args) {
        events.push(['tag', ...args])
      }
    }
  }

  const hyperlink = nodeContents.createHyperlinkNode.call(ctx)
  const linkElement = hyperlink.node.children.find(item => item.targetValue)
  const event = { preventDefault() { this.prevented = true } }
  linkElement.node.handlers.click(event)
  assert.equal(events[0][0], 'icon')
  assert.equal(events[0][2], 'https://example.com')
  assert.equal(events[1][0], 'jump')
  assert.equal(events[1][1], 'https://example.com')
  assert.equal(events[1][2], ctx)
  assert.equal(events[1][3], event)
  assert.equal(event.prevented, true)

  const tags = nodeContents.createTagNode.call(ctx)
  const tagElement = tags[0].node
  const tagEvent = { stopPropagation() { this.stopped = true } }
  tagElement.handlers.dblclick(tagEvent)
  assert.equal(events.at(-1)[0], 'tag')
  assert.equal(events.at(-1)[1], 'node_tag_dblclick')
  assert.equal(events.at(-1)[2], ctx)
  assert.equal(tagEvent.stopped, true)
})

test('搜索支持指定节点范围和大小写、整词选项', async () => {
  const Search = await loadBundled('simple-mind-map/src/plugins/Search.js')
  const root = {
    data: { uid: 'root', text: 'needle outside' },
    children: []
  }
  const scoped = {
    data: { uid: 'scope', text: 'Needle exact' },
    children: [
      { data: { uid: 'partial', text: 'needles' }, children: [] }
    ]
  }
  const events = []
  const mindMap = {
    opt: {
      readonly: false,
      isOnlySearchCurrentRenderNodes: false
    },
    renderer: {
      root,
      renderTree: root,
      findNodeByUid: () => null
    },
    on() {},
    off() {},
    emit(...args) {
      events.push(args)
    },
    execCommand(name, uid, callback) {
      callback({
        getData: key => (key === 'uid' ? uid : { uid })
      })
    }
  }
  const search = new Search({ mindMap })
  search.search('needle', () => {}, { nodeData: scoped }, {
    caseSensitive: false,
    wholeWord: true
  })

  const matchList = events
    .filter(item => item[0] === 'search_match_node_list_change')
    .at(-1)[1]
  assert.deepEqual(
    matchList.map(item => item.data?.uid || item.getData('uid')),
    ['scope']
  )
})
