const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("../../web/node_modules/esbuild");

const repoRoot = path.resolve(__dirname, "../..");
const nodeModules = path.join(repoRoot, "web/node_modules");

class MindMapStub {
  static dataKeys = [];

  static extendNodeDataNoStylePropList(keys) {
    this.dataKeys.push(...keys);
  }

  constructor() {
    this.nodeInnerPrefixList = [];
    this.nodeInnerPostfixList = [];
    this.commands = new Map();
    this.command = {
      add: (name, fn) => this.commands.set(name, fn),
      remove: name => this.commands.delete(name)
    };
    this.renderer = { activeNodeList: [], findNodeByUid: () => null };
    this.opt = { readonly: false, hoverRectColor: "#3f9cfc" };
    this.renderCount = 0;
    this.events = new Map();
  }

  execCommand(name, ...args) {
    if (name === "SET_NODE_DATA") Object.assign(args[0].data, args[1]);
    else if (name === "GO_TARGET_NODE") this.targetUid = args[0];
    else this.commands.get(name)?.(...args);
  }

  render() {
    this.renderCount += 1;
  }

  on(name, fn) {
    this.events.set(name, fn);
  }

  off(name, fn) {
    if (this.events.get(name) === fn) this.events.delete(name);
  }
}

class NodeStub {
  constructor(text, parent = null) {
    this.uid = text;
    this.parent = parent;
    this.children = [];
    this.layerIndex = parent ? parent.layerIndex + 1 : 0;
    this.data = { text };
    if (parent) parent.children.push(this);
  }

  getData(key) {
    return key ? this.data[key] : this.data;
  }

  getIndexInBrothers() {
    return this.parent ? this.parent.children.indexOf(this) : -1;
  }
}

async function loadBundled(entryPoint, exportName) {
  const entry = path.join(repoRoot, entryPoint);
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    nodePaths: [nodeModules],
    logLevel: "silent"
  });
  const compiled = new Module(entry, module);
  compiled.filename = entry;
  compiled.paths = Module._nodeModulePaths(path.dirname(entry));
  compiled._compile(result.outputFiles[0].text, entry);
  return exportName ? compiled.exports[exportName] : compiled.exports.default || compiled.exports;
}

test("子节点编号保存配置并按父子层级生成编号", async () => {
  const NodeNumbers = await loadBundled(
    "simple-mind-map/src/plugins/NodeNumbers.js"
  );
  const map = new MindMapStub();
  const root = new NodeStub("root");
  const first = new NodeStub("first", root);
  const second = new NodeStub("second", root);
  const nested = new NodeStub("nested", first);
  const plugin = new NodeNumbers({ mindMap: map });

  plugin.setNumber([root], { type: 1, level: 0 });
  assert.deepEqual(root.data.number, { type: 1, level: 0 });
  assert.equal(plugin.getNodeNumber(first), "1");
  assert.equal(plugin.getNodeNumber(second), "2");
  assert.equal(plugin.getNodeNumber(nested), "1.1");
});

test("待办命令和子节点批量操作只写入 checkbox 数据", async () => {
  const NodeTodo = await loadBundled("simple-mind-map/src/plugins/NodeTodo.js");
  const map = new MindMapStub();
  const root = new NodeStub("root");
  const first = new NodeStub("first", root);
  const second = new NodeStub("second", root);
  const plugin = new NodeTodo({ mindMap: map });

  plugin.setCheckbox([root], { done: false });
  plugin.setChildrenTodo([root], "add");
  assert.deepEqual(first.data.checkbox, { done: false });
  assert.deepEqual(second.data.checkbox, { done: false });
  plugin.setChildrenTodo([root], "complete");
  assert.equal(first.data.checkbox.done, true);
  plugin.setChildrenTodo([root], "delete");
  assert.equal(first.data.checkbox, null);
  assert.equal(second.data.checkbox, null);
});

test("节点描述和正文隐藏命令可回退且保留数据", async () => {
  const NodeDescription = await loadBundled(
    "simple-mind-map/src/plugins/NodeDescription.js"
  );
  const map = new MindMapStub();
  const node = new NodeStub("node");
  const plugin = new NodeDescription({ mindMap: map });

  plugin.setDesc([node], "说明文字", { fontSize: 20, color: "#f00" });
  plugin.setHideText([node], true);
  assert.equal(node.data.desc, "说明文字");
  assert.deepEqual(node.data.descStyle, { fontSize: 20, color: "#f00" });
  assert.equal(node.data.hideText, true);
  plugin.setHideText([node], false);
  assert.equal(node.data.hideText, false);
});

test("节点内段落编号复用编号格式并支持普通文本处理", async () => {
  const NodeTextNumber = await loadBundled(
    "simple-mind-map/src/plugins/NodeTextNumber.js"
  );
  const map = new MindMapStub();
  const node = new NodeStub("node");
  const plugin = new NodeTextNumber({ mindMap: map });

  plugin.setNumber([node], 2);
  assert.equal(plugin.handleNodeText(node, "甲\n乙"), "1. 甲\n2. 乙");
  plugin.setNumber([node], "");
  assert.equal(plugin.handleNodeText(node, "甲\n乙"), "甲\n乙");
});

test("节点跳转和圈画命令保存参考插件的数据契约", async () => {
  const NodeLink = await loadBundled("simple-mind-map/src/plugins/NodeLink.js");
  const NodeNotation = await loadBundled(
    "simple-mind-map/src/plugins/NodeNotation.js"
  );
  const map = new MindMapStub();
  const source = new NodeStub("source");
  const target = new NodeStub("target");
  map.renderer.findNodeByUid = uid => (uid === target.uid ? target : null);
  const link = new NodeLink({ mindMap: map });
  const notation = new NodeNotation({ mindMap: map });

  link.setNodeLink([source], target.uid);
  notation.setNotation([source], true, {
    type: "box",
    padding: 8,
    strokeWidth: 2,
    animate: false
  });
  assert.equal(source.data.nodeLink, "target");
  assert.equal(source.data.notation.show, true);
  assert.equal(source.data.notation.config.type, "box");
  assert.equal(source.data.notation.config.strokeWidth, 2);
  assert.equal(source.data.notation.config.animate, false);
  assert.deepEqual(notation.defaultConfig.brackets, ["left", "right"]);
  assert.equal(link.checkTargetExist("target"), true);
});

test("节点跳转能识别折叠树中的目标并写入反向链接", async () => {
  const NodeLink = await loadBundled("simple-mind-map/src/plugins/NodeLink.js");
  const map = new MindMapStub();
  const source = new NodeStub("source");
  const hiddenTarget = { data: { uid: "hidden-target" }, children: [] };
  map.renderer.findNodeByUid = () => null;
  map.renderer.getAllRenderTree = () => [
    { data: { uid: "root" }, children: [hiddenTarget] }
  ];
  const link = new NodeLink({ mindMap: map });

  link.setNodeLink([source], hiddenTarget.data.uid, true);
  assert.equal(link.checkTargetExist(hiddenTarget.data.uid), true);
  assert.equal(hiddenTarget.data.nodeLink, source.uid);
});

test("节点跳转只读时不会写入折叠目标的反向链接", async () => {
  const NodeLink = await loadBundled("simple-mind-map/src/plugins/NodeLink.js");
  const map = new MindMapStub();
  map.opt.readonly = true;
  const source = new NodeStub("source");
  const hiddenTarget = { data: { uid: "hidden-target" }, children: [] };
  map.renderer.findNodeByUid = () => null;
  map.renderer.getAllRenderTree = () => [
    { data: { uid: "root" }, children: [hiddenTarget] }
  ];
  const link = new NodeLink({ mindMap: map });

  link.setNodeLink([source], hiddenTarget.data.uid, true);
  assert.equal(source.data.nodeLink, undefined);
  assert.equal(hiddenTarget.data.nodeLink, undefined);
});

test("圈画矩阵把CSS像素归一化到节点本地尺寸", async () => {
  const getAnnotationToNodeMatrix = await loadBundled(
    "simple-mind-map/src/plugins/NodeNotation.js",
    "getAnnotationToNodeMatrix"
  );
  const matrix = getAnnotationToNodeMatrix(
    {
      getBoundingClientRect: () => ({ left: 110, top: 108, width: 109.62, height: 92.8 }),
      getBBox: () => ({ x: 4, y: 11, width: 189, height: 160 }),
      getScreenCTM: () => ({ a: 0.58, b: 0, c: 0, d: 0.58, e: 0, f: 0 })
    },
    {
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 58, height: 58 })
    },
    {
      getScreenCTM: () => ({ a: 0.58, b: 0, c: 0, d: 0.58, e: 0, f: 0 })
    }
  );

  assert.ok(Math.abs(matrix.a - 189 / 109.62) < 0.0001);
  assert.ok(Math.abs(matrix.d - 160 / 92.8) < 0.0001);
  assert.ok(Math.abs(matrix.a * 10 + matrix.e - 4) < 0.0001);
  assert.ok(Math.abs(matrix.d * 8 + matrix.f - 11) < 0.0001);
  const sourceCenter = { x: 10 + 109.62 / 2, y: 8 + 92.8 / 2 };
  const targetCenter = {
    x: matrix.a * sourceCenter.x + matrix.e,
    y: matrix.d * sourceCenter.y + matrix.f
  };
  assert.ok(Math.abs(targetCenter.x - (4 + 189 / 2)) < 0.0001);
  assert.ok(Math.abs(targetCenter.y - (11 + 160 / 2)) < 0.0001);
  assert.equal(matrix.b, 0);
  assert.equal(matrix.c, 0);
});

test("节点自定义坐标为零时不回退到布局坐标", async () => {
  const previousDocument = global.document;
  global.document = { documentElement: {}, body: { style: {} } };
  let MindMapNode;
  try {
    MindMapNode = await loadBundled(
      "simple-mind-map/src/core/render/node/MindMapNode.js"
    );
  } finally {
    global.document = previousDocument;
  }
  const node = Object.create(MindMapNode.prototype);
  node.customLeft = 0;
  node.customTop = 0;
  node._left = 42;
  node._top = 24;

  assert.equal(node.left, 0);
  assert.equal(node.top, 0);
});
