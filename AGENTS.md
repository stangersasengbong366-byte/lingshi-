# 项目协作指南

## 项目目标

这是“有道领世产品权益清单”工具，包含运营配置、销售选择、家长分享、长图导出和云端配置同步。后续修改应优先保证：

1. 销售可以快速选择产品、科目和班型。
2. 家长看到的清单与明细准确、清晰，且移动端可读。
3. 运营修改产品、课程、赠课和实物后，不需要重新理解整套项目。

## 默认修改路径

每次开始普通修改时，按以下顺序操作：

1. 阅读本文件。
2. 阅读 `docs/CHANGE_MAP.md`，定位需求对应的 1～3 个主文件。
3. 用关键词搜索具体组件、配置项或样式名。
4. 只打开目标文件及其直接依赖。
5. 完成局部修改和局部验证。

只有涉及数据流、部署或跨页面联动时，才需要补读 `ARCHITECTURE.md`。

## 常用命令

```bash
npm run dev
npm run build
npm run build:pages
npm run api
```

- 本地页面：`npm run dev`
- 普通生产构建：`npm run build`
- GitHub Pages 构建：`npm run build:pages`
- 本地接口服务：`npm run api`

## 数据来源约定

- 产品初始配置：`src/data/products.js`
- 全年课程库：`src/data/annualCourseLibrary.js`
- 课程目录：`src/data/courseCatalog.js`
- 高一秋实卡课程：`src/data/g1AutumnCourseData.js`
- 赠课目录：`src/data/giftCatalog.js`
- 高一秋实卡赠课：`src/data/g1AutumnGiftData.js`
- 教辅资料目录：`src/data/teachingAidCatalog.js`
- Excel 解析：`src/lib/courseWorkbookParser.js`
- Supabase 表结构：`supabase/schema.sql`

`annualCourseLibrary.js`、`courseCatalog.js` 等大体量课程文件属于生成数据。优先修改源表或生成脚本 `scripts/build-annual-course-library.mjs`，不要直接手工改动成千上万行的数据。

## 编辑边界

- 不改变现有技术栈，不顺手升级主要依赖。
- 不把产品名称、价格、赠送规则重新写进 JSX 或 CSS。
- 不提交 `.env`、Token、密钥或账号凭证。
- 不回退工作区中与当前任务无关的已有修改。
- 大文件拆分按小批次推进，每批可独立验证、独立回滚、独立提交。
- 页面视觉修改必须同时检查桌面端、手机端和导出长图。
- 云端同步修改必须同时检查本地回退逻辑与 Supabase 表不存在时的提示。

## 验证矩阵

| 修改类型 | 最少验证 |
| --- | --- |
| 文档、导航 | 链接和路径存在，`git diff --check` |
| 产品配置 | 产品选择、价格、科目、班型联动 |
| 课程数据 | 年级、阶段、科目、班型筛选与课时统计 |
| 赠课规则 | 买一科、买两科、买三科触发；对应学科不重复 |
| 实物与教辅 | 年级、学科、门槛及图片比例 |
| 云端同步 | 保存、刷新、另一浏览器读取、失败回退 |
| 页面样式 | 桌面端、手机端、分享页、长图导出 |
| 部署 | `npm run build:pages`，检查 GitHub Pages 路径和静态资源 |

## 当前高风险文件

- `src/main.jsx`：页面、状态、业务规则、云端同步和导出逻辑集中。
- `src/styles.css`：后台、销售端、分享页、移动端和导出样式集中。
- `src/data/annualCourseLibrary.js`、`src/data/courseCatalog.js`：超大生成数据。

在这些文件拆分完成前，修改时必须先在 `docs/CHANGE_MAP.md` 中确认目标区域，避免通读整个文件。
