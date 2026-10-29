const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('../../web/node_modules/esbuild')

const repoRoot = path.resolve(__dirname, '../..')
const nodeModules = path.join(repoRoot, 'web/node_modules')

if (!global.document) global.document = { documentElement: {} }

async function loadBundled(entryPoint) {
  const entry = path.join(repoRoot, entryPoint)
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

const createMindMapMock = () => ({
  opt: { maxNodeCacheCount: 100, fishboneDeg: 45 },
  nodeInnerPrefixList: [],
  nodeInnerPostfixList: [],
  addShape() {},
  removeShape() {},
  on() {},
  off() {}
})

test('布局枚举包含右鱼骨和表格，并且右鱼骨使用独立鱼头形状', async () => {
  const constants = await loadBundled('simple-mind-map/src/constants/constant.js')
  const layout = constants.CONSTANTS.LAYOUT
  assert.equal(layout.RIGHT_FISHBONE, 'rightFishbone')
  assert.equal(layout.RIGHT_FISHBONE2, 'rightFishbone2')
  assert.equal(layout.TABLE, 'table')
  assert.ok(constants.layoutValueList.includes(layout.TABLE))
  const Table = (await loadBundled('simple-mind-map/src/layouts/Table.js')).default
  assert.equal(typeof Table, 'function')

  const RightFishbone = (await loadBundled(
    'simple-mind-map/src/layouts/RightFishbone.js'
  )).default
  const selectors = []
  const lineDraw = {
    findOne(selector) {
      selectors.push(selector)
      return null
    }
  }
  const firstMindMap = createMindMapMock()
  const secondMindMap = createMindMapMock()
  const first = new RightFishbone(
    { mindMap: firstMindMap, lineDraw },
    layout.RIGHT_FISHBONE2
  )
  const second = new RightFishbone(
    { mindMap: secondMindMap, lineDraw },
    layout.RIGHT_FISHBONE2
  )
  assert.equal(first.getShapeInfo().fishHeadName, 'rightFishHead')
  assert.notEqual(first.fishTailClassName, second.fishTailClassName)
  first.removeFishTail()
  second.removeFishTail()
  assert.deepEqual(selectors, [
    `.${first.fishTailClassName}`,
    `.${second.fishTailClassName}`
  ])
})

test('右鱼骨的子节点按真实坐标向左排列，而不是依赖画布镜像', async () => {
  const utils = (await loadBundled(
    'simple-mind-map/src/layouts/rightFishboneUtils.js'
  )).default
  const first = { width: 20, height: 10, top: 0, left: 0, expandBtnSize: 0 }
  const second = { width: 30, height: 10, top: 0, left: 0, expandBtnSize: 0 }
  const node = {
    left: 100,
    top: 0,
    width: 80,
    height: 20,
    children: [first, second]
  }
  const ctx = {
    childIndent: 0.5,
    getMarginY: () => 5,
    getNodeActChildrenLength: () => 0
  }
  utils.top.computedLeftTopValue({ layerIndex: 1, node, ctx })
  assert.equal(first.left, 120)
  assert.equal(second.left, 85)
})

test('表格布局为每个节点绘制完整的单元格边框', async () => {
  const Table = (await loadBundled('simple-mind-map/src/layouts/Table.js')).default
  const paths = []
  const layout = Object.create(Table.prototype)
  layout.maxLayerWidthMap = { 0: 100 }
  layout.transformPath = pathValue => pathValue
  layout.lineDraw = {
    path() {
      return {
        plot(pathValue) {
          paths.push(pathValue)
        }
      }
    }
  }
  const node = {
    left: 10,
    top: 5,
    width: 100,
    height: 30,
    layerIndex: 0,
    children: [],
    childrenAreaHeight: 0,
    _lines: [],
    getData: () => false,
    style: { line() {} }
  }
  layout.renderLine(node, [], () => {})
  assert.equal(node._lines.length, 4)
  assert.equal(layout.nodeIsRemoveAllLines(), true)
  assert.equal(layout.getMarginX(1), 0)
  assert.equal(layout.getMarginY(1), 0)
  assert.deepEqual(paths, [
    'M 10,5 L 10,35',
    'M 10,5 L 110,5',
    'M 110,5 L 110,35',
    'M 10,35 L 110,35'
  ])
  layout.mindMap = { themeConfig: { nodeUseLineStyle: false } }
  let buttonTranslation = null
  layout.renderExpandBtn(
    { width: 100, height: 30 },
    {
      transform: () => ({ translateX: 0, translateY: 0 }),
      translate: (x, y) => {
        buttonTranslation = [x, y]
      }
    }
  )
  assert.deepEqual(buttonTranslation, [100, 15])
  const placeholder = {
    size(width, height) {
      this.width = width
      this.height = height
      return this
    },
    x(value) {
      this.left = value
      return this
    },
    y(value) {
      this.top = value
      return this
    }
  }
  layout.renderExpandBtnRect(placeholder, 20, 100, 30)
  assert.deepEqual(
    {
      width: placeholder.width,
      height: placeholder.height,
      left: placeholder.left,
      top: placeholder.top
    },
    {
      width: 20,
      height: 30,
      left: 100,
      top: 0
    }
  )
})

test('表格布局复用节点时先恢复内容尺寸再重新分配列宽', async () => {
  const Table = (await loadBundled('simple-mind-map/src/layouts/Table.js')).default
  const rootData = { data: { expand: true }, children: [] }
  const childData = { data: { expand: true }, children: [] }
  rootData.children.push(childData)
  const root = {
    width: 120,
    height: 15,
    layerIndex: 0,
    children: [],
    intrinsicWidth: 20,
    intrinsicHeight: 15,
    getSize() {
      const changed = this.width !== this.intrinsicWidth || this.height !== this.intrinsicHeight
      this.width = this.intrinsicWidth
      this.height = this.intrinsicHeight
      return changed
    },
    getData(key) {
      return key === 'expand' ? true : undefined
    }
  }
  const child = {
    width: 150,
    height: 10,
    layerIndex: 1,
    children: [],
    intrinsicWidth: 60,
    intrinsicHeight: 10,
    getSize() {
      const changed = this.width !== this.intrinsicWidth || this.height !== this.intrinsicHeight
      this.width = this.intrinsicWidth
      this.height = this.intrinsicHeight
      return changed
    },
    getData(key) {
      return key === 'expand' ? true : undefined
    }
  }
  const layout = Object.create(Table.prototype)
  layout.renderer = { renderTree: rootData }
  layout.createNode = (data, parent, isRoot, layerIndex) => {
    const node = isRoot ? root : child
    node.layerIndex = layerIndex
    node.children = node.children || []
    if (parent && !parent._node.children.includes(node)) parent._node.children.push(node)
    if (isRoot) layout.root = node
    data._node = node
    return node
  }
  layout.setNodeCenter = () => {}
  layout.getMarginY = () => 5
  layout.computedBaseValue()
  layout.computedMaxChildrenWidth()

  assert.deepEqual(layout.maxLayerWidthMap, { 0: 20, 1: 60 })
  assert.equal(root.width, 20)
  assert.equal(child.width, 60)
})

test('鱼骨布局切换前无根节点时只清理自身资源', async () => {
  const Fishbone = (await loadBundled('simple-mind-map/src/layouts/Fishbone.js')).default
  const layout = Object.create(Fishbone.prototype)
  let removedShape = false
  layout.layout = 'fishbone2'
  layout.root = null
  layout.fishTail = null
  layout.renderer = {
    lineDraw: { findOne: () => null }
  }
  layout.mindMap = {
    off() {},
    removeShape() {
      removedShape = true
    }
  }
  layout.fishTailClassName = 'smm-layout-fishbone-tail-test'
  layout.beforeChange()
  assert.equal(removedShape, false)
})

test('fit 默认使用包含所有渲染树和后代的画布边界', async () => {
  const View = (await loadBundled('simple-mind-map/src/core/view/View.js')).default
  const target = {
    mindMap: {
      renderer: {
        getAllRenderRoot: () => [
          { group: { rbox: () => ({ x: 10, y: 20, width: 30, height: 40 }) } },
          { group: { rbox: () => ({ x: -5, y: 50, width: 20, height: 10 }) } }
        ]
      },
      draw: { rbox: () => ({ x: -20, y: -10, width: 100, height: 120 }) }
    }
  }
  assert.deepEqual(View.prototype.getFitRect.call(target, () => {}), {
    x: -20,
    y: -10,
    width: 100,
    height: 120
  })
})

test('位置限制使用所有渲染树的联合边界', async () => {
  const View = (await loadBundled('simple-mind-map/src/core/view/View.js')).default
  const target = {
    mindMap: {
      draw: {
        transform: () => ({ scaleX: 1, scaleY: 1 }),
        rbox: () => ({ x: 0, y: 0, width: 500, height: 500 })
      },
      renderer: {
        getAllRenderRoot: () => [
          {
            group: { rbox: () => ({ x: 50, y: 40, width: 100, height: 60 }) },
            children: [
              { group: { rbox: () => ({ x: -40, y: 10, width: 20, height: 20 }) }, children: [] }
            ]
          },
          {
            group: { rbox: () => ({ x: 300, y: 200, width: 80, height: 90 }) },
            children: [
              { group: { rbox: () => ({ x: 390, y: 260, width: 40, height: 40 }) }, children: [] }
            ]
          }
        ],
        layout: { getRootCenterOffset: () => ({ x: 0, y: 0 }) }
      }
    }
  }
  target.getRenderNodeRects = View.prototype.getRenderNodeRects
  assert.deepEqual(View.prototype.getPositionLimit.call(target), {
    scale: 1,
    left: -40,
    right: -470,
    top: 10,
    bottom: -290
  })
})
