# Obsidian 个人思维导图插件 0.2.0 开发计划

日期：2026-10-28
状态：直接复用参考源码的版本已完成构建及集中验收；实际证据见 plugin/验收记录.md，未验证项仍按本文边界保留。

## 1. 目标和边界

### 1.1 目标

交付一个仅供个人使用的桌面端 Obsidian 插件：在 Obsidian 内新建、编辑、保存和重新打开 `.smm.md` 思维导图，并尽量保留参考开源项目的编辑体验。实现优先复用本地参考源码和当前仓库的 `simple-mind-map` fork，而不是另建一套简化网页编辑器。

首版目标：

1. 视图、命令、菜单、设置和 Markdown 预览按参考 Obsidian 插件的调用方向接入。
2. 工具栏、主题、布局、样式面板、富文本、图片、导入导出、大纲、只读、搜索等公开 UI 入口随源码接入；代码存在只表示已复用，最终是否可用由隔离库人工验收决定。
3. 文件使用四段 Markdown 外壳，`metadata` 保留 LZString 压缩的完整导图 JSON，`svgdata` 保留独立或内嵌 SVG 预览，`linkdata/textdata` 提供 Obsidian 链接和搜索投影。
4. 自动保存默认 5 秒，只提交导图数据快照；手动“保存并更新图像”才生成并保存新的 SVG。
5. 保存、外部修改、删除、关闭和恢复副本不能静默覆盖用户文件。

### 1.2 不做

- AI、OAuth/账号、VIP、图床、云服务、联网协作和云端同步。
- 旧版 `.mindmap.md` 迁移、参考插件 `data.json` 读取或两个插件之间的数据兼容层。当前没有需要保留的旧真实数据。
- `smm` Markdown 代码块渲染；公开参考源码没有这项接线，不能把它列入完成范围。
- 参考产品本地 0.2.12 的全部闭源或后续能力、多根自由节点等未从公开源码接入的能力。
- 手机端。本轮只验收 `manifest.json` 声明的桌面端；macOS、Linux、独立弹窗、大型导图性能和第三方插件组合不作已验证承诺。
- 上游 UI、引擎和每一种主题/导入格式的自动化测试矩阵；只保留本项目持久化风险的必要测试。

### 1.3 隔离规则

- 开发验收在隔离库进行，CMBK 原参考插件目录和笔记保持原位。本轮用户已明确授权安装成品：只写入新的 personal-mindmap 目录并切换插件启用状态，不写入测试笔记或恢复文件。
- 验收使用独立 Obsidian 库；本插件和参考插件不能同时对同一个 `.smm.md` 文件建立可写视图。不同插件 ID 不能消除 Vault 文件竞争。
- 目标库安装前先备份；本项目没有旧真实数据，因此不为 0.1 的 `.mindmap.md` 保留兼容层。

## 2. 参考来源与复用策略

参考项目：`wanglin2/obsidian-simplemindmap`，固定提交：

```text
42d367c23176bbe08d4cd9e58e4780ea0c096dba
```

源码快照和本地改动见 [plugin/reference/来源与改动](../plugin/reference/来源与改动.md)。这里的“复用”准确指复制公开源码目录并按当前构建入口接线，不表示公开源码与本地参考插件 0.2.12 安装包完全相同。公开源码仍可能包含未使用的通用 UI 文案或服务分支；本项目不为这些分支提供 AI、账号、VIP、图床或云服务实现。

审查用的本地比较约为：公开 `src/` 快照 354 个文件，当前 `plugin/reference/` 同路径文件 345 个，326 个字节一致，19 个文件做了必要适配；构建配置、依赖目录和锁文件没有复制。这些数字只说明复制范围，不是功能等同性证明。

## 3. 真实架构和依赖

### 3.1 入口和目录职责

| 职责 | 真实位置 | 调用关系 |
| --- | --- | --- |
| 插件入口 | `plugin/src/main.js` | 直接加载 `plugin/reference/main.js` 默认导出 |
| 参考插件主类 | `plugin/reference/main.js` | 注册视图、命令、菜单、设置、状态栏、Markdown 后处理和工作区补丁 |
| Obsidian 视图 | `plugin/reference/SmmEditView.js` | `TextFileView` 读取当前文件，挂载 `plugin/reference/src/main.js`，接收编辑器 `$obsidianAPI` 回调 |
| Obsidian 辅助 | `plugin/reference/ob/` | 文件格式辅助、命令、菜单、设置页、Markdown 后处理、预览和文件名操作 |
| Vue 编辑器 | `plugin/reference/src/` | 原网页 UI、Vuex store、翻译、样式、导入导出和引擎插件注册 |
| 引擎 | `simple-mind-map/` | `web/webpack.obsidian.js` alias 指向当前 fork |
| 文档格式 | `plugin/src/document/format.js` | 严格解析/创建/序列化 `.smm.md`，供视图加载和保存保护使用 |
| 保存保护 | `plugin/src/document/save.js` | `SmmEditView` 的 `SaveCoordinator` 串行提交当前 raw |
| 资源落库 | `plugin/src/assets.js` | `SmmEditView` 保存图片和独立 SVG |
| 构建 | `web/webpack.obsidian.js`、`web/scripts/buildObsidian.js` | external 化 `obsidian/electron/fs`，单 chunk 输出 `plugin/dist/` |

`plugin/reference/src/main.js` 为每个编辑器实例创建 Vue、Vuex、i18n 和事件总线，并把当前视图的 API 放入 `$obsidianAPI`。实例数据不得通过模块级“当前文件”变量共享；视图销毁时必须停止观察、释放编辑器和定时器。

### 3.2 依赖和构建约束

当前 `web/package.json` 明确包含参考源码需要的：

- `i18next@25.2.1`、`lz-string@1.5.0`、`monkey-around@3.0.0`；
- `sass@1.89.2`、`sass-loader@10.5.2`，适配现有 Webpack 4；
- 原 Vue 2、Element UI、Vuex、主题包和当前 fork 所需依赖。

`web/webpack.obsidian.js` 的关键约束：

- 入口为 `plugin/src/main.js`；
- alias `@` 指向 `plugin/reference/src`；
- `simple-mind-map$` 和 `simple-mind-map` 指向仓库内 `simple-mind-map`；
- `obsidian`、`electron`、`fs` 由宿主提供，不打进 bundle；
- `LimitChunkCountPlugin` 限制为单 chunk，CSS/字体/图片随插件构建复制；
- `buildObsidian.js` 复制 manifest、根许可证、`LICENSE-REFERENCE.txt` 和第三方声明。

## 4. `.smm.md` 格式契约

### 4.1 固定结构

`plugin/src/document/format.js` 的受管区段必须按以下顺序各出现一次：

1. frontmatter；
2. `# metadata`，下一行必须是 ````metadata```` 代码块；
3. `# svgdata`，内容为独立 SVG wikilink 或 ````svgData```` 代码块；
4. `# linkdata`；
5. `# textdata`。

示意：

````markdown
---
path: maps/示例.smm.md
tags:
  - simplemindmap
---
> 请勿修改除YAML外的任何信息
# metadata
```metadata
<LZString 压缩后的导图 JSON Base64>
```
# svgdata
![[.smm-embed-image-files/maps/示例.svg]]
> updateAt: <时间戳>
# linkdata
- [[notes/home.md]]_[notes/home.md]
# textdata
中心主题 ^root-uid
````

### 4.2 权威区和派生区

| 区域 | 规则 | 权威性 |
| --- | --- | --- |
| frontmatter | 保留 `path`、标签和未受管 YAML；自动补 `simplemindmap` 标签 | 文件元数据 |
| `metadata` | `JSON.stringify(data)` 后 `LZString.compressToBase64()`；解析后校验 root/data/children | 完整导图唯一权威快照 |
| `svgdata` | 独立 SVG 使用 wikilink 和 `updateAt`；否则保存内嵌 SVG 压缩串 | 预览投影 |
| `linkdata` | 从节点超链接、富文本内部链接和图片路径收集；映射变更只回写对应字段 | 派生投影 |
| `textdata` | 按节点纯文本和 UID 生成，受 `supportObSearch` 控制 | 搜索/阅读投影 |

解析失败、压缩数据损坏、区段重复/乱序、节点结构非法或代码块未闭合时必须报错。不能用示例数据覆盖原文件。`linkdata`/`textdata` 不能反向代替 `metadata` 重建完整导图。

### 4.3 新建和识别

新建文件始终使用 `.smm.md`，默认加入 `simplemindmap` 标签；文件名和目录遵循设置，重名时提示文件已存在，不覆盖原文件。自动打开只对 `.smm.md`、`.smm` 扩展或带有效 `simplemindmap` 标签的候选文件执行，最终仍必须通过严格格式解析。普通 Markdown 不自动转换；本项目不迁移旧 `.mindmap.md`。

## 5. 宿主 API 和编辑器接线

参考编辑器以 `$obsidianAPI` 调用宿主。`SmmEditView` 必须保持下列职责，不将 Obsidian 细节散落到 Vue 组件：

| API 方向 | 当前实现 | 最小验收 |
| --- | --- | --- |
| 初始化/回写数据 | `getInitMindMapData` 读取解析后的 `metadata.content`；`getMindMapCurrentData` 重新生成 Markdown raw 并交给 coordinator | 编辑节点、布局、主题和视口后重开不丢 |
| 保存 | `saveMindMapData` 只在传入 SVG 时更新 `svgdata`，然后 flush；自动保存不传 SVG | 自动保存不改旧预览；手动更新图像能写 SVG |
| 引擎配置 | `get/saveMindMapConfig` 写入插件设置 | 配置不混入文件 metadata |
| 本地编辑配置 | `get/saveMindMapLocalConfig` 写入插件设置并按 Obsidian 主题计算 `isDark` | 两个实例不串配置 |
| 设置 | `getSettings/updateSettings` 读取/保存插件设置 | 设置 UI 有真实消费者，孤立项不当作完成 |
| 图片/附件 | `saveFileToVault` → `AssetStore.saveFile`；资源路径 → `AssetStore.getResourcePath` | 写盘成功后节点才引用有效路径 |
| 当前文件和 Vault | 查询当前 `TFile`、全部文件、URI、库内链接 | 中文、空格和标题/区块链接可判定 |
| 打开链接 | 内部链接交给 Obsidian workspace，网页链接交给宿主 | 目标类型正确，外链不执行脚本协议 |
| 提示/确认/重命名 | 使用 Notice、确认对话框和同目录唯一文件名 | 失败可见，不吞掉关键错误 |
| 导出 | 原编辑器生成 payload，宿主桌面保存对话框写文件 | 导出错误不覆盖源导图 |

新接口必须有真实调用点；仅为“看起来兼容”保留的无调用接口不得写成已交付能力。

## 6. 保存、冲突和关闭

### 6.1 数据保存时序

1. 编辑器数据变化时，通过 `getMindMapCurrentData` 生成最新 `.smm.md` raw。
2. `SaveCoordinator.update()` 保存 current raw、base raw 和脏状态，并设置 `autoSaveTime` 对应的 debounce/maxWait。
3. 到期或手动保存时，`vault.process(file, callback)` 只在磁盘内容仍等于预期 base raw 时提交；期间有外部变化则抛出 `SaveConflictError`。
4. 自动保存不导出 SVG；手动“保存并更新图像”通过 `saveToLocal(true, true)` 导出 SVG，写入独立文件或内嵌 `svgdata`，随后提交 Markdown。

默认 `autoSaveTime=5`。当前视图将 0 或无效值回退为 5 秒；设置文案、代码和验收记录必须保持这一语义一致。

### 6.2 外部变化和删除

- 外部修改到达时，若视图干净且没有进行中的写入，重新解析并刷新编辑器。
- 若本地有脏数据或写入进行中，进入冲突状态，停止静默覆盖；用户需重新加载或另存副本。
- 文件删除后停止新的写入，并提示另存副本；当前快照保持在内存中供恢复。
- 加载到无效外部内容时显示错误，原文件不被本插件覆盖。

### 6.3 关闭和恢复

视图关闭/插件停用时先请求编辑器生成最新数据并 `flush()`；保存失败时在原目录创建唯一的“恢复”副本，恢复也失败则报告两个错误。随后销毁编辑器、取消观察和 coordinator。断电、强制结束进程、Vault 本身不可写时不承诺零丢失。

## 7. 资源和预览

### 7.1 `AssetStore` 安全规则

`plugin/src/assets.js` 必须保持以下边界：

- 库内路径只能是相对路径；拒绝盘符、绝对路径和 `..`；
- 隐藏目录/文件可能不在 Vault 索引中，先用 adapter 的真实存在性检查再创建；并发建目录只恢复明确的“已存在”错误，权限/IO 错误继续传播；
- JPEG、PNG、WEBP 才进入 canvas 压缩；SVG、GIF 不重编码；临时 Object URL 在成功和失败路径都释放；
- 同名附件不覆盖原文件；失败不把失效路径写入节点；`AssetStore` 不扫描或清理旧附件/孤立 SVG，源文件删除/重命名时的 Markdown 后处理行为另行按参考流程验收；
- 独立 SVG 按源文件目录稳定命名，例如 `a/b.smm.md` → `.smm-embed-image-files/a/b.svg`，`a_b.smm.md` → `.smm-embed-image-files/a_b.svg`。

### 7.2 Markdown 后处理

`plugin/reference/ob/MarkdownPostProcessor.js` 负责 `.smm.md` 在 Markdown 阅读/嵌入场景中的 SVG 预览、修改/删除/重命名监听和 Object URL 回收。它不提供 `smm` 代码块功能，也不能以代码块能力作为本版验收项。预览监听必须在插件卸载时解除，URL 必须回收。

## 8. 设置契约

默认值位于 `plugin/reference/ob/constant.js`，界面位于 `plugin/reference/ob/SmmSettingTab.js`，保存调用参考插件的 `loadData/saveData`。设置分区和关键值如下：

- 基础：由 Obsidian 语言初始化的 `lang`、`themeMode`、`defaultLayout`、`defaultTheme`、`defaultThemeDark`；当前没有独立的 `langFollowOb` 设置开关；
- 文件：`fileNameFormat`、`filePathType/filePath`、`autoSaveTime`；
- 图片/附件：路径类型和子路径、`compressImage`、最大宽高 1200、质量 0.8、透明背景、粘贴文件名格式；
- 嵌入：`embedImageIsSeparateFile`、目录 `.smm-embed-image-files`、双击打开方式、链接新窗口；
- 其他：`supportObSearch`、`saveCanvasViewData`、`nodeTextToMarkdownTitleMaxLevel=3` 和编辑器运行时配置；当前没有可承诺的代码块设置；
- `mindMapConfig` 和 `mindMapLocalConfig` 是插件运行时配置，不是文件内容。

图床开关固定为 `useImgHosting=false`，设置页不提供图床配置。图片粘贴命名、编辑器运行时配置和资源路径等项目必须在真实调用链确认后才能标记完成；孤立设置应删除或在验收记录中明确“未接通”，不能靠设置页存在证明功能完成。

## 9. 分阶段实施与验证

### 阶段一：来源、入口和隔离

1. 固定参考提交、保留许可证和第三方声明。
   **verify：** `plugin/reference/来源与改动.md`、`LICENSE.txt`、`plugin/THIRD_PARTY_NOTICES.md` 可追溯。
2. 核对 `plugin/src/main.js`、manifest 和 Webpack alias。
   **verify：** 构建入口加载 reference 主类，插件 ID 为 `personal-mindmap`。
3. 建立隔离库和测试文件。
   **verify：** 开发测试文件不写入 CMBK；正式安装的 6 项成品哈希一致，两个插件不同时接管同一文件。

### 阶段二：格式和生命周期

1. 以 `format.js` 的四段、LZString 和严格节点校验作为唯一文件格式。
   **verify：** 新建、解析、序列化、损坏文件拒绝、未知 YAML 保留。
2. 让 `SmmEditView` 用 coordinator 保存当前 raw，并通过 `vault.process` 做原文比较。
   **verify：** 连续编辑、外部冲突、删除、保存失败和关闭恢复均不静默覆盖。
3. 接通 Markdown/思维导图视图切换和视图销毁。
   **verify：** 同文件不出现两个可写实例；切换后监听、浮层、URL 和编辑器能释放。

### 阶段三：复用 UI 和宿主能力

1. 使用 reference `src/` 的 Vue、Vuex、翻译、样式和 `simple-mind-map` 插件注册。
   **verify：** 工具栏、主题、布局、样式、富文本和基础节点操作能进入当前视图。
2. 接通图片、链接、导入导出、大纲、只读、搜索、备注和预览入口。
   **verify：** 代表性操作保存后重开，错误不覆盖源数据；未接通入口不写成完成。
3. 关闭 AI/账号/VIP/图床/云服务范围。
   **verify：** 构建和人工验收不依赖登录、OAuth、图床或联网服务；遗留入口若可见，记录为范围风险而非服务能力。

### 阶段四：资源、构建和验收

1. 通过 `AssetStore` 落库图片和独立 SVG，执行路径、冲突、隐藏目录和权限检查。
   **verify：** `assets.test.cjs` 及人工图片场景通过。
2. 执行构建并安装到隔离库。
   **verify：** `npm run build:obsidian` 成功，dist 包包含 manifest、CSS、许可证和第三方声明；最终构建仍以验收记录为准。
3. 运行 13 个必要自动化用例，再执行集中人工场景。
   **verify：** 结果、环境、失败项、截图/日志由主代理写入 `plugin/验收记录.md`。

## 10. 最小测试和人工验收

### 10.1 自动化测试：只保留 13 个用例

| 文件 | 用例数 | 覆盖范围 | 保留理由 |
| --- | ---: | --- | --- |
| `plugin/tests/format.test.cjs` | 5 | 四段结构、LZ 数据、字段往返、链接投影、非法内容和特殊正文 | 错误格式可能破坏 Markdown 或覆盖文件 |
| `plugin/tests/save.test.cjs` | 5 | 写入期间更新、失败脏状态、外部冲突、自写事件和删除保护 | 异步写入风险不能靠手动偶测 |
| `plugin/tests/assets.test.cjs` | 2 | 隐藏目录/文件不索引时重复保存和源路径不碰撞；权限错误传播 | 对应已复现的 Obsidian 真实故障 |

不新增按钮、主题、平台或上游引擎测试矩阵。只有新的持久化故障才补针对性回归用例。

### 10.2 集中人工场景

| 编号 | 场景 | 通过条件 |
| --- | --- | --- |
| A | 新建 → 编辑 → 等待自动保存 → 重开 → 重启 Obsidian | `.smm.md` 四段有效，节点/主题/布局/视口数据保留；自动保存不意外更新旧 SVG |
| B | 手动保存并更新图像、独立 SVG/内嵌 SVG、Markdown 阅读 | SVG 路径或压缩内容有效，预览可刷新，URL/监听可释放 |
| C | 富文本、图片、导入、导出、大纲、只读、搜索、备注 | 代表性入口可用，失败不覆盖当前导图；未接通功能明确记录 |
| D | 两个导图分屏、同文件 Markdown 切换、设置/备注/图片弹层 | store、bus、快捷键、浮层和资源不串实例 |
| E | 中文/空格笔记路径、别名、标题/区块链接、网页链接 | 选择、显示、打开方式正确，外链不执行脚本协议 |
| F | 外部改文件、删除、保存失败、立即关闭、停用插件 | 冲突拒写、删除保护、恢复副本或明确错误，原文件不静默覆盖 |
| G | 与 CMBK 参考插件共存 | CMBK 原参考目录保留；安装时停用旧插件、启用个人插件，避免两个接管者同时写入 |

## 11. 需求—实现—验收对照

| 需求 | 实现位置 | 验收证据 |
| --- | --- | --- |
| 桌面端个人插件 | `plugin/manifest.json`、`plugin/src/main.js`、`plugin/reference/main.js` | 阶段一、G |
| 尽量复刻参考前后端 | `plugin/reference/main.js`、`SmmEditView.js`、`ob/`、`src/`；Webpack alias | B、C、D、来源说明 |
| `.smm.md` 四段 LZ 格式 | `plugin/src/document/format.js` | 格式 5 用例、A、B |
| 完整导图快照和配置 | `SmmEditView` `$obsidianAPI`、reference `src` store | A、C |
| 自动保存数据 | `SmmEditView` `_createSaveCoordinator`、reference `Edit.vue` `saveToLocal` | A、保存 5 用例 |
| 手动更新 SVG | `SmmEditView.saveMindMapData`、`AssetStore.saveSvg` | B、资产 2 用例 |
| 冲突/删除/关闭恢复 | `document/save.js`、`SmmEditView` 外部变化和关闭流程 | F、保存 5 用例 |
| 图片和附件落库 | `plugin/src/assets.js`、reference `Edit/NodeImage/NodeNote` | C、B、资产 2 用例 |
| 导入导出 | reference `Import.vue`/`Export.vue` 与 Obsidian 宿主保存 | C |
| Markdown 预览 | `plugin/reference/ob/MarkdownPostProcessor.js` | B、F |
| 设置保存 | `reference/ob/constant.js`、`SmmSettingTab.js`、`main.js` load/save | C、设置调用链清单 |
| 不做 AI/账号/VIP/图床/云服务 | `useImgHosting=false`、不接入服务端；范围审查 | C、G、构建检查 |
| 不兼容旧格式 | `format.js` 严格识别 `.smm.md` 四段 | 格式非法用例、README |

若某项没有实际调用点或验收证据，只能标为“未完成/未验证”；不能因为文件或按钮存在就判定完成。

## 12. 已知风险和未验证项

### 12.1 本轮确认及后续验收

1. 构建成功；13 个必要自动化用例通过。依赖及参考源码均已进入实际构建链。
2. 富文本最后输入、主题/布局/图片路径回读、5 秒自动保存、重复 SVG 写入、Markdown 嵌入、只读和大纲切换已在隔离库验证。
3. 外部修改实测发现 TextFileView 自带刷新会绕过插件监听；已将 setViewData 的刷新统一送入冲突处理，复验外部原文与本地恢复副本均保留。
4. 同文件分屏、独立窗口、全部设置和全部导入/导出格式未穷举验收；这些入口沿用参考源码，不把源码存在当作全部通过。
5. 附件测试覆盖隐藏目录、权限错误和根目录中文附件；实际 PNG 落库及 SVG 图片内嵌已验证。
6. 原参考方法中存在长函数。为保留源码可比性，本轮不把它们拆成另一套架构；后续只围绕实际问题做局部调整。

### 12.2 首版可接受边界

- 旧 `.mindmap.md` 没有迁移器；无旧真实数据时不为迁移增加兼容复杂度。
- 笔记重命名后的全库节点链接不自动改写。
- 断电、强制结束、Vault 不可写和恢复副本目录不可写时不能保证零丢失。
- 手机、非 Windows 桌面平台、独立弹窗、超大导图和第三方 CSS 冲突留给后续阶段。
- 公开源码与本地 0.2.12 不是完整等同；本计划只覆盖能从当前代码和接口证实的范围。

## 13. 交付纪律

1. 代码、构建和测试都保持最小范围；不为 AI、账号、云服务或旧数据迁移新增抽象。
2. 新函数、设置和接口逐项核对真实调用点；孤立项删除或列为未实现。
3. 构建包不含用户配置、凭证、测试库、日志、本机绝对路径或临时文件。
4. 自动化测试只覆盖上述 13 个必要用例；最终数量、运行环境和结果统一写入 `plugin/验收记录.md`，不在 README/计划中复制成永久通过声明。
5. 本文和来源说明是纯文档变更；验收记录由主代理统一维护；CMBK 只执行用户明确授权的成品安装和启用切换。
