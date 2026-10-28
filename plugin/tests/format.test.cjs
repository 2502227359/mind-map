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
      text: '根 <主题>\n第二行',
      uid: 'root-1',
      hyperlink: '[[首页|入口]]',
      unknownNodeField: { keep: true }
    },
    children: [
      {
        data: {
          text: '子节点 `code`',
          uid: 'child-1',
          hyperlink: 'docs/笔记.md#标题'
        },
        children: []
      }
    ]
  },
  layout: 'logicalStructure',
  theme: { template: 'default', config: { backgroundColor: '#fff' } },
  view: { scale: 1, translateX: 0, translateY: 0 },
  unknownTopLevelField: { keep: 'yes' }
}

test('文档创建、解析和序列化保留完整导图数据及用户正文', () => {
  const raw = createDocument(sourceData)
  assert.equal(isMindMapDocument(raw), true)
  assert.deepEqual(parseDocument(raw).data, sourceData)
  assert.match(raw, /&lt;主题&gt;/)
  assert.match(raw, /\[\[首页\|入口\]\]/)

  const withUserText = `${raw}\n\n用户说明不要覆盖。\n`
  const nextData = { ...sourceData, layout: 'mindMap', unknownTopLevelField: { keep: 'next' } }
  const serialized = serializeDocument(withUserText, nextData)
  assert.match(serialized, /用户说明不要覆盖。/)
  assert.deepEqual(parseDocument(serialized).data, nextData)
})

test('格式错误、重复边界和未知版本不会被识别或静默替换', () => {
  const raw = createDocument(sourceData)
  const jsonStart = raw.indexOf('```json\n') + '```json\n'.length
  const jsonEnd = raw.indexOf('\n```', jsonStart)
  const envelope = JSON.parse(raw.slice(jsonStart, jsonEnd))
  const withEnvelope = value => raw.slice(0, jsonStart) + JSON.stringify(value, null, 2) + raw.slice(jsonEnd)
  const cases = [
    '',
    raw.replace('personal_mindmap: true', 'personal_mindmap: false'),
    raw.replace('"version": 1', '"version": 2'),
    raw.replace('<!-- personal-mindmap:data:end -->', ''),
    `${raw}\n<!-- personal-mindmap:outline:start -->\n<!-- personal-mindmap:outline:end -->`,
    withEnvelope({ ...envelope, data: { ...envelope.data, root: { ...envelope.data.root, data: [] } } }),
    withEnvelope({ ...envelope, data: { ...envelope.data, root: { ...envelope.data.root, children: {} } } })
  ]
  for (const value of cases) {
    assert.equal(isMindMapDocument(value), false)
    assert.throws(() => parseDocument(value), /导图文件格式/)
  }

  const linksStart = '<!-- personal-mindmap:links:start -->'
  const withoutLinksStart = raw.replace(linksStart, '')
  const dataEnd = withoutLinksStart.indexOf('<!-- personal-mindmap:data:end -->')
  const overlap = withoutLinksStart.slice(0, dataEnd) + `${linksStart}\n` + withoutLinksStart.slice(dataEnd)
  assert.equal(isMindMapDocument(overlap), false)
  assert.throws(() => parseDocument(overlap), /导图文件格式/)

  const dataStartMarker = '<!-- personal-mindmap:data:start -->'
  const dataEndMarker = '<!-- personal-mindmap:data:end -->'
  const dataStart = raw.indexOf(dataStartMarker)
  const dataBlockEnd = raw.indexOf(dataEndMarker) + dataEndMarker.length
  const dataBlock = raw.slice(dataStart, dataBlockEnd)
  const withoutData = raw.slice(0, dataStart) + raw.slice(dataBlockEnd)
  const frontmatterMarker = withoutData.replace(
    'personal_mindmap_version: 1',
    `personal_mindmap_version: 1\n${dataBlock}`
  )
  assert.equal(isMindMapDocument(frontmatterMarker), false)
  assert.throws(() => parseDocument(frontmatterMarker), /导图文件格式/)
})
