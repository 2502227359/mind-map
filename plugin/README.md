# 个人思维导图 0.2.0

这是一个仅供个人使用的桌面端 Obsidian 思维导图插件。当前方案直接复用本仓库 `plugin/reference/` 中的公开参考插件源码，并用当前 fork 的 `simple-mind-map` 引擎构建；个人化改动集中在插件标识、`.smm.md` 格式校验、保存保护和库内资源落盘。

本轮已完成构建、隔离库集中验收及 CMBK 安装启动检查。请以 [验收记录](验收记录.md) 的实际命令输出和场景结果为准，不把本说明中的能力清单当成“全部已通过”。

## 范围

- 首版只支持电脑端，`plugin/manifest.json` 声明 `isDesktopOnly: true`，最低 Obsidian 版本为 1.14.4。
- 在 Obsidian 内新建、编辑、保存和重新打开 `.smm.md` 思维导图。
- 尽量保留参考网页编辑器的工具栏、主题、布局、样式、富文本、图片、导入导出、大纲、只读和 Markdown 预览入口；源码存在不等于每个入口已在目标库验收通过。
- AI、OAuth/账号、VIP、图床、云服务、联网协作和手机端不属于本版本。参考源码中的通用文案或未接线服务入口不构成本插件的服务承诺。
- CMBK 参考插件目录保持只读；两个插件不能同时对同一个 `.smm.md` 文件建立可写视图。
- 当前没有需要保留的旧真实数据，不兼容本项目旧版 `.mindmap.md` 文件，也不读取参考插件的 `data.json`。

## 源码和构建关系

参考源码来源、固定提交和本地差异见 [来源与改动](reference/来源与改动.md)。实际入口与构建链如下：

| 位置 | 作用 |
| --- | --- |
| `plugin/src/main.js` | 最小入口，加载 `plugin/reference/main.js` 的默认插件类 |
| `plugin/reference/main.js` | 注册视图、命令、菜单、设置、Markdown 后处理和工作区行为 |
| `plugin/reference/SmmEditView.js` | `TextFileView`、编辑器挂载、当前文件生命周期、数据保存和关闭恢复 |
| `plugin/reference/ob/` | Obsidian 文件识别、命令、菜单、设置页、Markdown 后处理和预览辅助 |
| `plugin/reference/src/` | 原 Vue 编辑器、工具栏、样式、翻译和页面组件 |
| `plugin/src/document/format.js` | `.smm.md` 四段格式的创建、严格解析、序列化和字段校验 |
| `plugin/src/document/save.js` | 防抖、最长等待、串行写入、冲突和删除状态 |
| `plugin/src/assets.js` | 图片/附件落库、压缩、路径安全和独立 SVG |
| `web/webpack.obsidian.js` | 将 `@` 指向 `plugin/reference/src`，将 `simple-mind-map` 指向当前 fork，并 external 化宿主模块 |

前端使用参考公开源码的 UI 和 Obsidian 适配方向；本项目不是把本地 0.2.12 安装包声称为完全可复现的源码，也不声称公开源码包含参考产品的全部后续功能。

## 构建与测试

命令从 `web` 目录执行：

```powershell
npm ci --no-audit --no-fund
npm run build:obsidian
npm run test:obsidian
```

`build:obsidian` 执行 `web/scripts/buildObsidian.js`，使用 `web/webpack.obsidian.js`，输出 `plugin/dist/`，并复制 manifest、根许可证、参考源码许可证和第三方声明。当前依赖明确锁定了参考源码需要的 `i18next@25.2.1`、`lz-string@1.5.0`、`monkey-around@3.0.0`，以及 Webpack 4 兼容的 `sass@1.89.2`、`sass-loader@10.5.2`。

当前只保留 13 个必要测试用例：格式 5 个、保存协调 5 个、附件/隐藏目录 3 个。它们只覆盖本项目自有的持久化风险，不是上游引擎或 UI 的完整测试套件；最终运行结果由验收记录填写。

## 安装

1. 构建后，将 `plugin/dist/` 中的 `main.js`、`styles.css`、`manifest.json`、`LICENSE`、`LICENSE-REFERENCE.txt` 和 `THIRD_PARTY_NOTICES.md` 复制到目标库的 `.obsidian/plugins/personal-mindmap/`。
2. 在 Obsidian 中启用“个人思维导图”。不要覆盖 CMBK 的 `simple-mind-map` 目录，也不要复制其他插件的 `data.json`。
3. 先在隔离库新建一个 `.smm.md`，验证保存、重开、Markdown 阅读和恢复流程，再处理正式库。
4. 若同一库同时保留参考插件，请让两个插件使用不同测试文件，并在编辑同一文件前停用其中一个；不同插件 ID 不能消除文件写入竞争。

CMBK 已安装并启用 `personal-mindmap` 0.2.0，旧 `simple-mind-map` 已停用，其目录及数据保留。安装仅复制构建文件并调整这两个插件的启用状态，未创建测试笔记。

## 新建、打开和保存

- 功能区按钮及命令创建新的 `.smm.md`，文件名、目录、默认布局和主题来自设置；重名时提示文件已存在，不覆盖原文件。
- `.smm.md` 文件会进入思维导图视图；普通 Markdown 不会被转换。用户显式切换到 Markdown 源视图后，不应立即被插件抢回。
- 编辑器变化会先生成完整导图数据快照，默认每 5 秒自动保存 Markdown 数据。自动保存只写数据和派生文本/链接投影，不自动导出新的 SVG。
- 手动“保存并更新图像”才导出 SVG，并按设置写入独立 SVG 或内嵌 SVG；普通手动保存只提交当前数据。
- 保存使用原文比较保护：外部修改、文件删除或写入失败不会静默覆盖原文件。关闭视图时会先尝试保存，仍有脏数据时尝试创建恢复副本。

## `.smm.md` 文件格式

文件是 Markdown 外壳，正文固定包含以下顺序的四个区段：`metadata`、`svgdata`、`linkdata`、`textdata`。

````markdown
---
path: maps/示例.smm.md
tags:
  - simplemindmap
---
> 请勿修改除YAML外的任何信息
# metadata
```metadata
<LZString.compressToBase64(JSON.stringify(导图数据))>
```
# svgdata
![[.smm-embed-image-files/maps/示例.svg]]
> updateAt: <时间戳>
# linkdata
- [[notes/home.md]]_[notes/home.md]
# textdata
中心主题 ^节点uid
````

`plugin/src/document/format.js` 的规则是：

- frontmatter 必须存在并闭合；受管标签包含 `simplemindmap`，其他 YAML 行尽量保留。
- `metadata` 必须是 `metadata` 代码块；内容可识别为 JSON 或 LZString Base64，解压后必须有合法的 `root/data/children` 节点结构。
- `svgdata` 可以是独立 SVG 的 wikilink，也可以是 `svgData` 代码块；它是预览投影，不是节点权威数据。
- `linkdata` 和 `textdata` 是由节点数据派生的 Obsidian 链接/搜索投影；完整导图快照仍只以 `metadata` 为准。
- 区段标题必须各出现一次、顺序固定，损坏或不完整文件会报告格式错误，不用示例内容覆盖原文件。

不把 `.smm.md` 当普通 Markdown 正文编辑。需要改节点时使用导图视图；需要恢复或处理 YAML 时先复制原文件。

## 编辑能力边界

`plugin/reference/src/` 提供原编辑器组件和当前 fork 引擎的注册入口，目标范围包括：

- 工具栏、布局、主题、节点/基础/连线/标签/外框样式和设置面板；
- 普通文本、富文本、节点备注、标签、图标、关联线、公式、小地图等源码已有入口；
- 图片节点、剪贴板图片、库内图片、图片压缩和附件路径配置；
- `.smm`/JSON/XMind/Markdown 导入，以及 PNG/JPEG/WEBP/SVG/PDF/JSON/SMM/Markdown/TXT 导出入口；
- 大纲、搜索、缩放、画布导航、只读、Markdown 阅读和思维导图预览；
- Obsidian 笔记选择、内部链接、标题/区块子路径和网页链接。

这些是复用源码的目标范围，必须以隔离库人工验收为准。当前不承诺 `smm` 代码块渲染；公开参考源码没有该功能接线。

## 图片和独立 SVG

`plugin/src/assets.js` 的 `AssetStore` 负责资源路径和写盘：

- 只接受库内相对路径，拒绝绝对盘符、绝对路径和 `..`；
- 隐藏目录或文件即使不在 Vault 索引中，也通过 adapter 检查真实存在性，避免重复创建目录；权限和 IO 错误继续抛出；
- 只压缩 JPEG、PNG、WEBP；SVG 和 GIF 不改写，并释放临时 Object URL；
- 目标文件重名不覆盖既有附件；写盘成功后调用方才把路径放入节点数据；`AssetStore` 不扫描或清理旧附件/孤立 SVG，Markdown 后处理只更新缓存，不删除或重命名其他 SVG 资产；
- 独立 SVG 按源文件目录保留路径结构，避免 `a/b.smm.md` 与 `a_b.smm.md` 生成同一个文件。

## 设置

设置页在 `plugin/reference/ob/SmmSettingTab.js`，默认值在 `plugin/reference/ob/constant.js`。设置由 Obsidian 插件数据保存，编辑器运行时配置与文件 `metadata` 分开：

- 基础：由 Obsidian 语言初始化的 `lang`、主题模式、默认布局、亮/暗色默认主题（当前没有独立的语言跟随开关）；
- 文件：文件名格式、创建目录和自动保存间隔；
- 图片/附件：图片和附件目录、压缩开关、最大宽高、质量、透明背景、粘贴文件名格式；
- 嵌入：独立 SVG、SVG 目录、嵌入双击打开方式、链接新窗口；
- 其他：Obsidian 搜索文本、是否保存画布视口、Markdown 标题级别和编辑器运行时配置。

默认自动保存间隔为 5 秒；当前视图将 0 或无效值按 5 秒处理。设置页存在不等于每个选项已被真实消费，尤其是图片粘贴命名、编辑器运行时配置和资源路径仍需在验收记录中确认调用链。

## 不处理的内容

- 不实现 AI 接入、OAuth/账号、VIP、图床、云服务或联网协作。
- 不实现旧 `.mindmap.md` 迁移，不读取 CMBK 的插件配置，不自动改写全库节点链接。
- 不承诺手机、macOS、Linux、独立弹出窗口、超大导图性能、第三方插件组合或断电/强杀进程时的零丢失。
- 不把公开源码与本地参考插件 0.2.12 的差异隐藏成兼容承诺，也不把 `plugin/dist` 构建产物当作可编辑源码。

详细的需求—实现—验收对照、保存时序、最小测试和未验证风险见 [开发计划](../docs/Obsidian思维导图插件开发计划.md)。
