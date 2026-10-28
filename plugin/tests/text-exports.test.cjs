const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('../../web/node_modules/esbuild')

const repoRoot = path.resolve(__dirname, '../..')
const nodeModules = path.join(repoRoot, 'web/node_modules')

async function loadBundled(relativePath) {
  const entry = path.join(repoRoot, relativePath)
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    nodePaths: [nodeModules],
    logLevel: 'silent'
  })
  const compiledModule = new Module(entry, module)
  compiledModule.filename = entry
  compiledModule.paths = Module._nodeModulePaths(path.dirname(entry))
  compiledModule._compile(result.outputFiles[0].text, entry)
  return compiledModule.exports
}

function createTextNode(value) {
  return { nodeType: 3, nodeValue: value }
}

function createElement(tagName, children = []) {
  const element = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    childNodes: children,
    classList: { contains: () => false },
    parentNode: null,
    get textContent() {
      return this.childNodes.map(node => node.textContent || node.nodeValue || '').join('')
    }
  }
  children.forEach(child => {
    if (child.nodeType === 1) child.parentNode = element
  })
  return element
}

function installDocumentStub() {
  const document = {
    requestFullScreen() {},
    webkitRequestFullScreen() {},
    mozRequestFullScreen() {},
    msRequestFullscreen() {},
    createElement() {
      const container = createElement('div')
      Object.defineProperty(container, 'innerHTML', {
        set(value) {
          const children = []
          let currentElement = null
          String(value).split(/(<\/?p>|<br\s*\/?>)/gi).forEach(part => {
            if (!part) return
            if (/^<p>$/i.test(part)) {
              currentElement = createElement('p')
              children.push(currentElement)
              return
            }
            if (/^<\/p>$/i.test(part)) {
              currentElement = null
              return
            }
            if (/^<br\s*\/?>$/i.test(part)) {
              const br = createElement('br')
              ;(currentElement ? currentElement.childNodes : children).push(br)
              return
            }
            ;(currentElement ? currentElement.childNodes : children).push(
              createTextNode(part)
            )
          })
          children.forEach(child => {
            if (child.nodeType === 1) {
              child.childNodes.forEach(grandchild => {
                if (grandchild.nodeType === 1) grandchild.parentNode = child
              })
            }
          })
          container.childNodes = children
        },
        get() {
          return ''
        }
      })
      return container
    }
  }
  document.documentElement = document
  document.body = document
  global.document = document
  global.window = { document }
}

installDocumentStub()

test('Mermaid 导出使用稳定节点 id，并转义结构字符和注释样文本', async () => {
  const { transformToMermaid } = await loadBundled('simple-mind-map/src/parse/toMermaid.js')
  const root = {
    data: { text: '根\n节点 [x] "q" %% comment `tag`' },
    children: [{ data: { text: '子 (节点)' }, children: [] }]
  }

  const output = transformToMermaid(root)

  assert.equal(output, transformToMermaid(root))
  assert.equal(output, transformToMermaid({ ...root, data: { text: root.data.text.replace(/\n/g, '\r\n') } }))
  assert.match(output, /^mindmap\n  n0\["根#10;节点 #91;x#93; &quot;q&quot; #37;#37; comment #96;tag#96;"\]\n    n0_0\["子 #40;节点#41;"\]$/)
  assert.doesNotMatch(output, /(^|\n)\s*%%/)
  assert.throws(
    () => transformToMermaid({
      data: { text: '根', freeNodeTrees: [{ data: { text: '自由节点' } }] },
      children: []
    }),
    /Mermaid 导出暂不支持自由节点树，请使用 SMM\/JSON/
  )
})

test('Mermaid 导出把富文本转换为现有工具产生的可见文字', async () => {
  installDocumentStub()
  const { transformToMermaid } = await loadBundled('simple-mind-map/src/parse/toMermaid.js')
  const output = transformToMermaid({
    data: { richText: true, text: '<p>第一行</p><p>第二行</p>' },
    children: []
  })

  assert.match(output, /第一行#10;第二行/)
  assert.doesNotMatch(output, /<p>|<\/p>/)
})

test('HTML 导出只把 SVG data URL 放进安全转义的 img 属性', async () => {
  const { createHtmlDocument } = await loadBundled('simple-mind-map/src/parse/toHtml.js')
  const html = createHtmlDocument(
    'data:image/svg+xml,<svg attr="x">&</svg>',
    '标题 <>&"\'\n'
  )

  assert.match(html, /<title>标题 &lt;&gt;&amp;&quot;&#39;&#10;<\/title>/)
  assert.match(html, /src="data:image\/svg\+xml,&lt;svg attr=&quot;x&quot;&gt;&amp;&lt;\/svg&gt;"/)
  assert.equal((html.match(/<img\b/g) || []).length, 1)
  assert.doesNotMatch(html, /<script\b|<svg\b|https?:\/\//i)
  assert.throws(() => createHtmlDocument('https://example.com/map.svg'), /SVG data URL/)
  assert.throws(() => createHtmlDocument('javascript:alert(1)'), /SVG data URL/)
  assert.throws(() => createHtmlDocument(undefined), /SVG data URL/)
})
