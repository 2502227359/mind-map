// 扩展节点形状插件

// 形状路径统一使用 100 x 100 的坐标系，渲染时由 svg.js 按节点尺寸缩放。
const SHAPES = [
  {
    nameShow: '心型',
    name: 'heart',
    path: 'M50 92 C44 86 8 65 8 34 C8 14 31 5 50 24 C69 5 92 14 92 34 C92 65 56 86 50 92 Z',
    shapeRatio: 1.18,
    extraRatio: 0.4
  },
  {
    nameShow: '五角星',
    name: 'fivePointedStar',
    path: 'M50 4 L61 36 L95 36 L68 56 L78 90 L50 70 L22 90 L32 56 L5 36 L39 36 Z',
    shapeRatio: 1.06,
    extraRatio: 0.5
  },
  {
    nameShow: '三角形',
    name: 'triangle',
    path: 'M50 3 L97 94 L3 94 Z',
    shapeRatio: 1.12,
    extraRatio: 0.5
  },
  {
    nameShow: '花朵',
    name: 'flower',
    path: 'M50 14 C35 -2 9 6 19 29 C-4 20 -5 49 19 50 C-2 62 14 89 34 70 C35 96 65 96 66 70 C86 89 102 62 81 50 C105 49 104 20 81 29 C91 6 65 -2 50 14 Z',
    shapeRatio: 1.025,
    extraRatio: 0.2
  },
  {
    nameShow: '云',
    name: 'cloud',
    path: 'M8 70 C2 52 15 37 31 37 C34 17 54 7 70 19 C84 16 96 27 92 42 C105 55 94 74 78 74 L23 74 C15 74 10 73 8 70 Z',
    shapeRatio: 1.25,
    extraRatio: 0.2
  },
  {
    nameShow: '云2',
    name: 'cloud2',
    path: 'M9 65 C1 46 20 31 37 37 C38 17 61 9 76 25 C94 22 103 43 89 55 C101 68 86 83 70 77 L22 77 C16 77 11 72 9 65 Z',
    shapeRatio: 1.3,
    extraRatio: 0.2
  },
  {
    nameShow: '云3',
    name: 'cloud3',
    path: 'M5 67 C0 51 12 38 27 36 C29 18 46 8 61 15 C73 5 95 15 93 34 C105 44 99 63 85 69 C76 77 60 74 50 77 C35 84 18 78 5 67 Z',
    shapeRatio: 1.57,
    extraRatio: 0.2
  },
  {
    nameShow: '云4',
    name: 'cloud4',
    path: 'M4 70 C0 55 11 42 27 39 C29 22 44 10 61 16 C75 6 95 16 93 37 C105 45 100 63 86 70 L18 78 C11 78 6 75 4 70 Z',
    shapeRatio: 1.51,
    extraRatio: 0.2
  },
  {
    nameShow: '爆炸',
    name: 'explosion',
    path: 'M38 8 L50 25 L61 5 L63 29 L85 16 L74 37 L98 40 L76 50 L94 66 L69 63 L74 88 L55 70 L44 96 L39 71 L15 87 L26 63 L2 59 L25 48 L6 34 L32 37 Z',
    shapeRatio: 1,
    extraRatio: 0.3
  },
  {
    nameShow: '水滴',
    name: 'waterDroplet',
    path: 'M50 3 C61 18 83 35 83 59 C83 82 68 97 50 97 C32 97 17 82 17 59 C17 35 39 18 50 3 Z',
    shapeRatio: 0.8,
    extraRatio: 0
  },
  {
    nameShow: '水滴2',
    name: 'waterDroplet2',
    path: 'M45 3 L90 3 L90 48 C90 75 73 95 48 95 C22 95 5 78 5 54 C5 27 24 7 45 3 Z',
    shapeRatio: 1,
    extraRatio: 0
  },
  {
    nameShow: '火',
    name: 'fire',
    path: 'M62 8 C58 24 48 31 41 37 C42 24 35 13 25 8 C27 25 15 33 12 48 C7 70 23 91 48 94 C73 97 91 79 88 56 C86 40 76 27 62 8 Z M47 83 C36 79 31 69 34 60 C36 54 42 49 47 42 C53 51 63 58 62 68 C61 76 56 81 47 83 Z',
    shapeRatio: 0.796,
    extraRatio: 0.2
  },
  {
    nameShow: '标记',
    name: 'mark',
    path: 'M5 4 H95 V92 L50 70 L5 92 Z',
    shapeRatio: 1.03,
    extraRatio: 0
  }
]

export const moreShapeNames = SHAPES.map(item => item.name)

export const getShapePadding = ({
  width,
  height,
  paddingX,
  paddingY,
  shapeRatio = 1,
  extraRatio = 0
}) => {
  const contentWidth = Math.max(width + paddingX * 2, 1)
  const contentHeight = Math.max(height + paddingY * 2, 1)
  const ratio = Math.max(shapeRatio, 0.01)
  let targetWidth = contentWidth
  let targetHeight = contentHeight
  if (contentWidth / contentHeight < ratio) {
    targetWidth = contentHeight * ratio
    targetHeight = contentHeight * (1 + extraRatio)
  } else {
    targetWidth = contentWidth * (1 + extraRatio)
    targetHeight = targetWidth / ratio
  }
  return {
    paddingX: Math.max(0, (targetWidth - contentWidth) / 2),
    paddingY: Math.max(0, (targetHeight - contentHeight) / 2)
  }
}

const createShape = (path, node) => {
  const shape = node.shapeInstance.createPath(path)
  const { width, height } = node.shapeInstance.getNodeSize()
  shape.size(width, height)
  return shape
}

export const createMoreShapes = () =>
  SHAPES.map(item => ({
    nameShow: item.nameShow,
    name: item.name,
    path: item.path,
    createShape: node => createShape(item.path, node),
    getPadding: params =>
      getShapePadding({
        ...params,
        shapeRatio: item.shapeRatio,
        extraRatio: item.extraRatio
      })
  }))

class MoreShapes {
  constructor({ mindMap }) {
    this.mindMap = mindMap
    this.shapes = createMoreShapes()
    this.bindEvent()
  }

  bindEvent() {
    this.shapes.forEach(shape => this.mindMap.addShape(shape))
  }

  unBindEvent() {
    this.shapes.forEach(shape => this.mindMap.removeShape(shape.name))
  }

  beforePluginRemove() {
    this.unBindEvent()
  }

  beforePluginDestroy() {
    this.unBindEvent()
  }
}

MoreShapes.instanceName = 'moreShapes'

export default MoreShapes
