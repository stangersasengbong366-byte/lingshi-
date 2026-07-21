# 项目协作指南

## 项目用途

这是“有道领世产品权益清单”工具，用于把产品、正课、赠课、实物/教辅资料和价格权益整理成销售可操作、家长可阅读的清单与明细页面。

核心目标：

1. 销售快速选择产品、科目、班型，并生成可分享链接。
2. 家长清楚看到“花多少钱、获得哪些正课/赠课/资料/服务”。
3. 运营后续维护产品、课程、赠课、实物和教辅时，尽量通过配置修改，减少改代码成本。

## 技术栈

- 前端：React + Vite
- 样式：单体 CSS，当前主要在 `src/styles.css`
- 图标：`lucide-react`
- 表格解析：`xlsx`
- 长图导出：`html2canvas`
- 本地接口：Express，入口由 `package.json` 指向 `server.js`
- 环境变量：`dotenv`
- 云端同步：Supabase 配置与表结构约定，静态站点可部署到 GitHub Pages

## 核心目录及职责

| 路径 | 职责 |
| --- | --- |
| `src/main.jsx` | 当前主应用入口，包含页面状态、销售选择、后台配置、分享页、导出和部分业务联动逻辑 |
| `src/styles.css` | 全局样式，包含后台、销售页、分享页、移动端和导出相关样式 |
| `src/data/products.js` | 产品初始配置 |
| `src/data/annualCourseLibrary.js` | 全年课程库，属于大体量生成数据 |
| `src/data/courseCatalog.js` | 课程目录，属于大体量生成数据 |
| `src/data/g1AutumnCourseData.js` | 高一秋实卡课程数据 |
| `src/data/g1AutumnGiftData.js` | 高一秋实卡赠课数据 |
| `src/data/giftCatalog.js` | 赠课目录 |
| `src/data/teachingAidCatalog.js` | 教辅资料目录 |
| `src/domain/pricing.js` | 价格计算相关逻辑 |
| `src/domain/giftRules.js` | 赠课/赠礼触发规则 |
| `src/config/options.js` | 年级、科目、班型等选项配置 |
| `src/config/runtime.js` | 运行时配置 |
| `src/config/giftPresentation.js` | 赠礼展示配置 |
| `src/lib/courseWorkbookParser.js` | Excel 课表解析逻辑 |
| `scripts/build-annual-course-library.mjs` | 年度课程库生成脚本 |
| `supabase/schema.sql` | Supabase 表结构约定 |
| `docs/CHANGE_MAP.md` | 修改导航表，用于快速定位文件 |
| `docs/PROJECT_STATE.md` | 当前项目状态交接文档 |

## 启动、构建、测试命令

```bash
npm run dev
npm run api
npm run build
npm run build:pages
npm run preview
```

- `npm run dev`：启动 Vite 本地页面，监听 `0.0.0.0`
- `npm run api` / `npm run start`：启动本地 Express 服务
- `npm run build`：普通生产构建
- `npm run build:pages`：GitHub Pages 构建，base 为 `/lingshi-/`
- `npm run preview`：本地预览构建结果

当前 `package.json` 未配置自动化 `test` 或 `lint` 脚本。涉及页面和数据联动时，需要用构建加人工回归验证。

## 编码规范

1. 普通修改先读 `AGENTS.md`，再读 `docs/CHANGE_MAP.md`，只打开目标文件和直接依赖。
2. 不把产品名称、价格、课程、赠课、赠送规则硬写进 JSX 或 CSS；优先放入 `src/data`、`src/domain` 或 `src/config`。
3. 大体量课程数据优先通过源表或生成脚本更新，不直接手工编辑成千上万行的生成文件。
4. 业务规则放在 `src/domain`，展示配置放在 `src/config`，静态业务数据放在 `src/data`。
5. 页面视觉修改要兼顾桌面端、移动端、分享页和长图导出。
6. 修改已有脏文件前先确认差异，不回退与当前任务无关的用户修改。

## 禁止修改的内容

- 不提交 `.env`、Token、密钥、账号凭证。
- 不随手升级 React、Vite 等主要依赖。
- 不更换技术栈。
- 不删除或回滚用户已有数据配置，除非用户明确要求。
- 不把后台配置数据重新散落进组件文件。
- 不一次性重构整个项目；拆分必须小批次、可验证、可回滚。

## 每次修改后的验证要求

| 修改类型 | 最少验证 |
| --- | --- |
| 文档/导航 | `git diff --check`，确认路径存在 |
| 产品配置 | 产品、科目、班型、价格展示联动 |
| 正课数据 | 年级、阶段、科目、班型筛选和课时统计 |
| 赠课规则 | 买一科、买两科、买三科触发；对应学科不重复展示 |
| 实物/教辅 | 年级、学科、门槛、图片比例和赠送规则 |
| 云端同步 | 保存、刷新、另一浏览器读取；表缺失时提示清楚 |
| 页面视觉 | 桌面端、手机端、分享页、长图导出一致性 |
| 部署 | `npm run build:pages`，检查 GitHub Pages 静态资源路径 |

## 默认工作流

一次普通修改应尽量控制为：

1. 读取 `AGENTS.md`
2. 读取 `docs/CHANGE_MAP.md`
3. 搜索关键词
4. 打开 1～3 个目标文件
5. 修改
6. 局部验证

避免每次都通读 `src/main.jsx`、`src/styles.css` 和全部数据文件。
