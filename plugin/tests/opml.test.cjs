const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const Module = require("node:module")
const esbuild = require("../../web/node_modules/esbuild")

const repoRoot = path.resolve(__dirname, "../..")
const nodeModules = path.join(repoRoot, "web/node_modules")

async function loadBundled() {
  const entry = path.join(repoRoot, "simple-mind-map/src/parse/opml.js")
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    nodePaths: [nodeModules],
    logLevel: "silent"
  })
  const compiledModule = new Module(entry, module)
  compiledModule.filename = entry
  compiledModule.paths = Module._nodeModulePaths(path.dirname(entry))
  compiledModule._compile(result.outputFiles[0].text, entry)
  return compiledModule.exports
}

function installTextDomStub() {
  const documentElement = {}
  global.document = {
    documentElement,
    createElement() {
      const element = { textContent: "" }
      Object.defineProperty(element, "innerHTML", {
        set(value) {
          element.textContent = String(value).replace(/<[^>]*>/g, "")
        },
        get() {
          return element.textContent
        }
      })
      return element
    }
  }
}

test("OPML 导出和解析保留层级、中文、特殊字符、链接和备注", async () => {
  installTextDomStub()
  const { transformToOpml, parseOpml } = await loadBundled()
  const source = {
    data: {
      text: "根\n<节点>\t",
      hyperlink: "obsidian://open?vault=Vault&file=首页.md",
      hyperlinkTitle: "入口\r\n & 说明",
      note: "备注\r\n & <内容>\t尾"
    },
    children: [
      {
        data: { text: "<p>富文本子节点</p>", richText: true },
        children: [{ data: { text: "末级" }, children: [] }]
      }
    ]
  }

  const xml = transformToOpml(source, "导图 & 标题")
  assert.match(xml, /<opml version="2\.0">/)
  assert.throws(() => transformToOpml({ data: { text: '节点\u0001' }, children: [] }), /控制字符/)
  const multiRootXml = transformToOpml({
    data: { text: '根', freeNodeTrees: [source] },
    children: []
  })
  assert.equal(parseOpml(multiRootXml).data.freeNodeTrees.length, 1)
  assert.match(xml, /根&#10;&lt;节点&gt;&#9;/)
  assert.match(xml, /obsidian:\/\/open\?vault=Vault&amp;file=首页\.md/)
  assert.match(xml, /title="入口&#13;&#10; &amp; 说明"/)
  assert.match(xml, /_note="备注&#13;&#10; &amp; &lt;内容&gt;&#9;尾"/)

  const parsed = parseOpml(xml)
  assert.deepEqual(parsed, {
    data: {
      text: "根\n<节点>\t",
      hyperlink: "obsidian://open?vault=Vault&file=首页.md",
      hyperlinkTitle: "入口\r\n & 说明",
      note: "备注\r\n & <内容>\t尾"
    },
    children: [
      {
        data: { text: "富文本子节点" },
        children: [{ data: { text: "末级" }, children: [] }]
      }
    ]
  })
})

test("OPML 多根保留为 root.data.freeNodeTrees，并安全保留 url/xmlUrl/title", async () => {
  const { parseOpml } = await loadBundled()
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title><![CDATA[订阅集合
阅读]]></title></head>
  <body>
    <outline text="订阅" title="订阅标题" url="java&#10;script:alert(1)" xmlUrl="https://feeds.example/rss" _note="RSS 备注">
      <outline title="无 text 属性" />
    </outline>
    <outline text="第二棵树">
      <outline text="Obsidian 笔记" url="obsidian://open?vault=Vault&amp;file=笔记.md" />
    </outline>
  </body>
</opml>`

  const parsed = parseOpml(xml)
  assert.equal(parsed.data.text, "订阅")
  assert.equal(parsed.children.length, 1)
  assert.equal(parsed.data.freeNodeTrees.length, 1)
  assert.equal(parsed.data.hyperlink, "https://feeds.example/rss")
  assert.equal(parsed.data.hyperlinkTitle, "订阅标题")
  assert.equal(parsed.data.note, "RSS 备注")
  assert.equal(parsed.children[0].data.text, "无 text 属性")
  assert.equal(
    parsed.data.freeNodeTrees[0].children[0].data.hyperlink,
    "obsidian://open?vault=Vault&file=笔记.md"
  )
  assert.ok(parsed.data.freeNodeTrees.every(node => Array.isArray(node.children)))
})

test("OPML 缺少 body、outline、根元素或包含 DOCTYPE/实体时拒绝解析", async () => {
  const { parseOpml } = await loadBundled()
  const invalid = [
    "",
    "<opml><head /></opml>",
    "<opml><head /><body /></opml>",
    "<opml><head /><body><outline /></body></opml><tail />",
    '<a><head /><body><outline text="x" /></body></a>',
    '<opml><head /><metadata /><body><outline text="x" /></body></opml>',
    '<opml><head /><body>unexpected<outline text="x" /></body></opml>',
    '<!DOCTYPE opml [<!ENTITY xxe SYSTEM "file:///secret">]><opml><head /><body><outline text="&xxe;" /></body></opml>',
    "<opml><head /><body><outline></body></opml>"
  ]

  invalid.forEach(value => {
    assert.throws(() => parseOpml(value))
  })
})
