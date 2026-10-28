const test = require('node:test')
const assert = require('node:assert/strict')
const {
  createDocument,
  parseDocument,
  serializeDocument,
  isMindMapDocument
} = require('../src/document/format.js')

const sourceData = {
  root: {
    data: {
      text: '根节点',
      uid: 'root-1',
      hyperlink: 'notes/home.md',
      hyperlinkTitle: '[[首页|入口]]',
      image: 'assets/root.png',
      unknownNodeField: { keep: true }
    },
    children: [{
      data: {
        text: '<p>子节点</p><p><a href="notes/child.md">子笔记</a></p>',
        uid: 'child-1'
      },
      children: []
    }]
  },
  layout: 'logicalStructure',
  theme: { template: 'classic13', config: { backgroundColor: '#fff' } },
  view: { scale: 1, translateX: 0, translateY: 0 },
  unknownTopLevelField: { keep: 'yes' }
}

test('按 smm.md 四段结构创建、解析和序列化', () => {
  const raw = createDocument(sourceData, {
    path: 'maps/示例.smm.md',
    svgdata: '![[.smm-embed-image-files/maps_示例.svg]]',
    svgdataUpdateAt: '2026-10-28 12:00:00',
    supportObSearch: true
  })

  assert.equal(isMindMapDocument(raw), true)
  assert.match(raw, /^---\npath: maps\/示例\.smm\.md\ntags:\n  - simplemindmap\n---\n/m)
  assert.match(raw, /# metadata\n```metadata\n/)
  assert.match(raw, /# svgdata\n!\[\[\.smm-embed-image-files\/maps_示例\.svg\]\]\n> updateAt: 2026-10-28 12:00:00/)
  assert.match(raw, /# linkdata\n- \[\[notes\/home\.md\]\]_\[notes\/home\.md\]\n- \[\[notes\/child\.md\]\]_\[notes\/child\.md\]\n- !\[\[assets\/root\.png\]\]_\[assets\/root\.png\]\n/)
  assert.match(raw, /# textdata\n根节点 \^root-1\n\n子节点\n子笔记 \^child-1/)

  const parsed = parseDocument(raw)
  assert.deepEqual(parsed.data, sourceData)
  assert.equal(parsed.raw, raw)
  assert.equal(parsed.metadata.path, 'maps/示例.smm.md')
  assert.deepEqual(parsed.metadata.tags, ['simplemindmap'])
  assert.equal(parsed.svgdata, '![[.smm-embed-image-files/maps_示例.svg]]')
  assert.equal(parsed.svgdataUpdateAt, '2026-10-28 12:00:00')
  assert.deepEqual(parsed.linkdata, [
    '[[notes/home.md]]_[notes/home.md]',
    '[[notes/child.md]]_[notes/child.md]',
    '![[assets/root.png]]_[assets/root.png]'
  ])
  assert.deepEqual(parsed.textdata, ['根节点 ^root-1', '子节点\n子笔记 ^child-1'])

  const withYaml = raw.replace('tags:\n  - simplemindmap\n', 'tags:\n  - simplemindmap\n# metadata\ncustom_property: keep\n')
  const nextData = { ...sourceData, layout: 'mindMap', unknownTopLevelField: { keep: 'next' } }
  const serialized = serializeDocument(withYaml, nextData, { path: 'maps/重命名.smm.md', supportObSearch: false })
  assert.match(serialized, /path: maps\/重命名\.smm\.md/)
  assert.match(serialized, /custom_property: keep/)
  assert.doesNotMatch(serialized, /# textdata\n(?:.|\n)*\^root-1/)
  assert.deepEqual(parseDocument(serialized).data, nextData)
})

test('非法原文拒绝识别和序列化，不接受旧 personal marker', () => {
  const raw = createDocument(sourceData)
  const cases = [
    '',
    raw.replace('# metadata', '# metadata-broken'),
    raw.replace('```metadata', '```json'),
    raw.replace('# textdata', '# textdata-broken'),
    raw.replace('path: ', 'path: \n---\n# metadata')
  ]

  for (const value of cases) {
    assert.equal(isMindMapDocument(value), false)
    assert.throws(() => parseDocument(value), /导图文件格式/)
  }

  const oldFormat = [
    '---',
    'personal_mindmap: true',
    'personal_mindmap_version: 1',
    '---',
    '<!-- personal-mindmap:data:start -->',
    '```json',
    JSON.stringify({ format: 'personal-mindmap', version: 1, data: sourceData }),
    '```',
    '<!-- personal-mindmap:data:end -->'
  ].join('\n')
  assert.equal(isMindMapDocument(oldFormat), false)
  assert.throws(() => serializeDocument(oldFormat, sourceData), /导图文件格式/)
})

test('解析 Obsidian 重命名后的 linkdata，只回写对应链接字段', () => {
  const data = {
    root: {
      data: {
        text: '保留 notes/old.md 这段普通文本 <a href="notes/old.md">原始标签</a>',
        uid: 'rename-root',
        hyperlink: 'notes/old.md',
        image: 'img/old.png'
      },
      children: []
    }
  }
  const raw = createDocument(data)
    .replace('- [[notes/old.md]]_[notes/old.md]', '- [[notes/new.md]]_[notes/old.md]')
    .replace('- ![[img/old.png]]_[img/old.png]', '- ![[img/new.png]]_[img/old.png]')
  const parsed = parseDocument(raw)

  assert.equal(parsed.data.root.data.hyperlink, 'notes/new.md')
  assert.equal(parsed.data.root.data.image, 'img/new.png')
  assert.equal(parsed.data.root.data.text,
    '保留 notes/old.md 这段普通文本 <a href="notes/new.md">原始标签</a>')
  assert.match(parsed.metadata.content, /"hyperlink":"notes\/new\.md"/)
})

test('外链和 data 资源不进入 linkdata', () => {
  const data = {
    root: {
      data: {
        text: '<a href="https://example.com">外链</a>',
        uid: 'external-root',
        hyperlink: 'https://example.com',
        image: 'data:image/png;base64,abc'
      },
      children: []
    }
  }
  const parsed = parseDocument(createDocument(data))

  assert.deepEqual(parsed.linkdata, [])
})

test('textdata 正文中的标题和围栏不改变四段结构识别', () => {
  const data = {
    root: {
      data: {
        text: '第一行\n# metadata\n```\n最后一行',
        uid: 'heading-text-root'
      },
      children: []
    }
  }
  const raw = createDocument(data)

  assert.equal(isMindMapDocument(raw), true)
  assert.deepEqual(parseDocument(raw).data, data)
})
