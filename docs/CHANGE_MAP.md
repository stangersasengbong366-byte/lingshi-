# 修改定位地图

这份地图用于把普通需求缩短为“查表 → 搜索 → 打开 1～3 个文件”。如果需求跨越多个区域，再阅读 `ARCHITECTURE.md`。

## 按需求找文件

| 想修改什么 | 首要文件 | 可能关联 | 最少验证 |
| --- | --- | --- | --- |
| 产品名称、年级、状态、价格、服务期 | `src/data/products.js` | `src/main.jsx` | 后台保存、销售筛选、价格卡 |
| 产品覆盖阶段 | `src/data/products.js` | `src/data/annualCourseLibrary.js`、`src/main.jsx` | 年级/阶段/科目课表和统计 |
| 全年课程数据 | 源 Excel、`scripts/build-annual-course-library.mjs` | `src/data/annualCourseLibrary.js`、`src/data/courseCatalog.js` | 三年级、阶段、九科、班型 |
| 特殊产品课程上传 | `src/lib/courseWorkbookParser.js` | `src/main.jsx` | 两份表、九科解析、保存后展示 |
| 高一秋实卡课程 | `src/data/g1AutumnCourseData.js` | `src/main.jsx` | 16 节直播、40 节目标/菁英知识视频 |
| 通用赠课名称、价值、课时、描述 | `src/data/giftCatalog.js` | `src/main.jsx` | 清单版、明细版、触发规则 |
| 高一秋实卡赠课 | `src/data/g1AutumnGiftData.js` | `src/main.jsx` | 对应学科、去重、课程大纲 |
| 教辅资料与年级/学科图片 | `src/data/teachingAidCatalog.js` | `public/assets`、`src/main.jsx` | 对应年级、对应学科、图片比例 |
| 实物赠礼及门槛 | `src/data/products.js`、`src/data/giftCatalog.js` | `src/main.jsx` | 买一/二/三科触发，待上线不展示 |
| 销售端产品/科目/班型选择 | `src/main.jsx` | `src/data/products.js` | 多科独立班型、在售状态过滤 |
| 清单版布局 | `src/main.jsx` | `src/styles.css` | 桌面、手机、分享链接、长图 |
| 明细版课表布局 | `src/main.jsx` | `src/styles.css` | 直播两列、知识视频两列、完整大纲 |
| 信封主视觉 | `src/main.jsx` | `src/styles.css`、`public/assets` | 页面与导出一致、移动端不变形 |
| 赠课卡片排列 | `src/main.jsx` | `src/styles.css` | 无大空白、图片不拉伸、课程可读 |
| 长图导出 | `src/main.jsx` | `src/styles.css` | 信封、素材比例、无色块、完整长图 |
| 分享链接参数 | `src/main.jsx` | `src/data/products.js` | 产品、科目、独立班型、页面模式 |
| 云端读取与保存 | `src/main.jsx` | `supabase/schema.sql`、`.env.example` | 保存、刷新、跨设备读取、失败提示 |
| GitHub Pages 发布 | `package.json`、`vite.config.js` | `public/assets` | `npm run build:pages`、线上资源路径 |
| 本地/代理接口 | `server.js` | `netlify/functions/competitor.js` | 接口错误与前端降级 |

## 推荐搜索词

找不到具体位置时，优先搜索页面上可见的唯一文字或以下关键词：

```text
benefit_configs
localStorage
html2canvas
share
subjects
tracks
view
赠课
实物赠送
知识视频大纲
学法直播大纲
导出长图
```

## 大文件热点与拆分目标

| 当前文件 | 规模 | 主要问题 | 目标去向 |
| --- | ---: | --- | --- |
| `src/main.jsx` | 4,000+ 行 | 页面、规则、请求、导出混合 | `app`、`components`、`domain`、`services` |
| `src/styles.css` | 9,000+ 行 | 多页面、多断点、导出样式混合 | `styles/admin.css`、`sales.css`、`benefits.css`、`export.css` |
| `src/data/annualCourseLibrary.js` | 26,000+ 行 | 生成数据巨大 | `data/generated`，保留生成脚本和来源说明 |
| `src/data/courseCatalog.js` | 21,000+ 行 | 生成数据巨大 | `data/generated`，避免手工编辑 |
| `src/data/g1AutumnCourseData.js` | 3,000+ 行 | 产品专项数据过大 | 按直播/知识视频或年级阶段拆分 |
| `preview.html` | 1,900+ 行 | 独立预览实现可能重复 | 明确是否仍使用，再决定归档或复用 |

## 分批改造清单

### 批次 1：导航系统

- `AGENTS.md`
- `ARCHITECTURE.md`
- `docs/CHANGE_MAP.md`

只新增说明，不改变页面。

### 批次 2：稳定配置层

计划新增：

- `src/config/options.js`
- `src/config/giftPresentation.js`
- `src/config/runtime.js`

计划调整：

- `src/main.jsx`

迁移年级/阶段标签、赠送规则选项、赠礼分类展示、图片映射和运行环境常量。

### 批次 3：业务规则层

计划新增：

- `src/domain/courseSelectors.js`
- `src/domain/giftRules.js`
- `src/domain/pricing.js`
- `src/domain/shareState.js`

计划调整：

- `src/main.jsx`
- 对应数据模块

迁移课程筛选、班型 40 节组合、赠课触发与去重、价格计算、分享参数转换。

### 批次 4：数据服务层

计划新增：

- `src/services/configRepository.js`
- `src/services/supabaseClient.js`
- `src/services/localConfigStore.js`

计划调整：

- `src/main.jsx`
- `supabase/schema.sql`

集中云端/本地读取、保存状态和错误提示。

### 批次 5：页面组件拆分

计划新增：

- `src/components/admin/*`
- `src/components/sales/*`
- `src/components/benefits/*`
- `src/components/shared/*`

优先拆独立、低耦合区域，再拆页面容器；每次只移动一个区域并做截图比对。

### 批次 6：样式拆分

计划新增：

- `src/styles/base.css`
- `src/styles/admin.css`
- `src/styles/sales.css`
- `src/styles/benefits.css`
- `src/styles/export.css`

保留选择器和优先级，逐组迁移，避免一次性重排全部 CSS。

## 完成标准

普通修改最终应满足：

```text
读取 AGENTS.md
→ 读取 docs/CHANGE_MAP.md
→ 搜索关键词
→ 打开 1～3 个目标文件
→ 修改
→ 局部验证
```

不再需要先通读 `src/main.jsx`、`src/styles.css`、全部数据和全部接口。
