# 项目状态交接

更新时间：2026-07-20

## 当前已经完成的功能

- 运营侧后台配置：维护产品基础信息、课程权益、赠课、实物/教辅资料等内容。
- 销售侧选择：选择产品、科目、班型，生成清单页或明细页。
- 家长分享页：通过 URL 参数携带产品、科目、班型和视图类型，打开后展示对应权益。
- 清单版页面：用于快速说明产品覆盖阶段、正课权益、价格和报名赠送。
- 明细版页面：用于展示更完整的正课大纲、知识视频大纲、赠课大纲和实物/教辅资料。
- 长图导出：使用 `html2canvas` 将页面导出为图片。
- Excel 解析：通过 `xlsx` 和 `src/lib/courseWorkbookParser.js` 解析课程表。
- 数据配置化雏形：产品、课程、赠课、教辅、价格和赠送规则已经部分拆到 `src/data`、`src/domain`、`src/config`。
- Supabase 云端同步入口：项目已有云端配置相关逻辑和表结构约定；当云端表未创建或配置不可用时，会回退到本机保存提示。
- GitHub Pages 构建：`npm run build:pages` 使用 `/lingshi-/` 作为部署 base。

## 当前页面和模块结构

当前仍是一个 Vite React 单页应用，主要结构如下：

- `src/main.jsx`
  - 应用入口
  - 页面路由/视图状态
  - 后台配置界面
  - 销售选择界面
  - 分享页渲染
  - 清单版/明细版展示
  - 长图导出触发
  - 部分云端同步和本地回退逻辑
- `src/styles.css`
  - 后台样式
  - 销售端样式
  - 分享页样式
  - 移动端适配
  - 导出图片相关样式
- `src/data/*`
  - 产品、课程、赠课、教辅等静态/生成数据
- `src/domain/*`
  - 价格和赠送规则等业务计算
- `src/config/*`
  - 选项、运行时、赠礼展示等配置
- `src/lib/courseWorkbookParser.js`
  - Excel 文件解析

典型分享参数：

```text
?share=1&product=g1-autumn-card&subjects=数学,英语&tracks=数学:目标班,英语:目标班&view=detail
```

其中：

- `share=1`：进入分享展示模式
- `product`：产品 ID
- `subjects`：已选科目
- `tracks`：各科目对应班型
- `view`：`list` 或 `detail`

## 核心数据流

1. 产品初始数据来自 `src/data/products.js`。
2. 年度课程库和课程目录来自 `src/data/annualCourseLibrary.js`、`src/data/courseCatalog.js`，部分由 `scripts/build-annual-course-library.mjs` 生成。
3. 高一秋实卡当前仍保留专门数据文件：`src/data/g1AutumnCourseData.js`、`src/data/g1AutumnGiftData.js`。
4. 销售选择产品、科目、班型后，页面根据所选科目读取课程、价格、赠课和教辅资料。
5. 价格计算由 `src/domain/pricing.js` 承担。
6. 赠课和实物触发由 `src/domain/giftRules.js` 承担。
7. 展示层在 `src/main.jsx` 中组合数据并渲染清单版或明细版。
8. 配置保存优先尝试云端同步；云端不可用时回退到本机保存状态，并显示“云端数据表未创建，仅保存在本机”等提示。
9. 导出图片时通过 `html2canvas` 截取页面 DOM，因此页面样式和导出样式必须一起验证。

## 关键技术决策

- 保持单页应用，不引入新框架。
- GitHub Pages 使用静态部署，因此线上访问依赖构建后的静态文件和可公开读取的数据接口。
- 业务数据逐步配置化，但历史页面代码仍有大量展示和状态逻辑集中在 `src/main.jsx`。
- 年度课程库属于大体量生成数据，应通过源表/生成脚本维护，而不是手工改生成结果。
- 长图导出依赖浏览器渲染结果；任何图片比例、信封主视觉、移动端布局改动，都必须同时检查实际页面和导出图。
- 云端同步需要 Supabase 表结构、URL、公开 key 和权限策略都正确，缺一项都会进入本机保存回退。

## 重要文件路径

| 文件 | 说明 |
| --- | --- |
| `package.json` | 脚本和依赖 |
| `src/main.jsx` | 当前最大入口文件和主要页面逻辑 |
| `src/styles.css` | 当前最大样式文件 |
| `src/data/products.js` | 产品配置 |
| `src/data/annualCourseLibrary.js` | 年度课程库 |
| `src/data/courseCatalog.js` | 课程目录 |
| `src/data/giftCatalog.js` | 赠课目录 |
| `src/data/teachingAidCatalog.js` | 教辅资料目录 |
| `src/domain/pricing.js` | 价格计算 |
| `src/domain/giftRules.js` | 赠送触发规则 |
| `src/lib/courseWorkbookParser.js` | Excel 解析 |
| `src/config/options.js` | 年级、科目、班型等选项 |
| `src/config/runtime.js` | 运行时配置 |
| `src/config/giftPresentation.js` | 赠礼展示配置 |
| `scripts/build-annual-course-library.mjs` | 年度课程库生成脚本 |
| `server.js` | 本地 API 服务入口 |
| `supabase/schema.sql` | Supabase 表结构约定 |
| `docs/CHANGE_MAP.md` | 修改导航 |
| `docs/PROJECT_STATE.md` | 当前交接文档 |

## 已知问题

- `src/main.jsx` 和 `src/styles.css` 仍然偏大，后续小改动容易被迫读取大量上下文。
- 后台、销售端、分享页、清单页、明细页和导出逻辑仍有耦合。
- 当前未配置自动化测试和 lint 脚本。
- 云端同步依赖 Supabase 表和环境配置；表未创建或权限不对时，外部用户无法看到本机最新配置。
- 移动端展示、导出长图和实际页面可能出现视觉不一致，尤其是信封主视觉和素材图片比例。
- 课程数据存在“年度通用库”和“高一秋实卡专用数据”并存，后续要注意不要改错来源。
- 赠课、实物、教辅同时涉及“买满几科触发”和“对应学科赠对应资料”，规则容易重复展示或漏展示。

## 待办事项

1. 拆分 `src/main.jsx`：
   - 后台配置页
   - 销售选择页
   - 分享页
   - 清单版
   - 明细版
   - 导出逻辑
2. 拆分 `src/styles.css`：
   - 基础变量
   - 后台样式
   - 销售样式
   - 分享样式
   - 导出样式
   - 移动端样式
3. 完善 Supabase 初始化流程：
   - 明确表结构
   - 明确 RLS/权限策略
   - 明确本地和线上环境变量
   - 增加“一键检测云端状态”的运营提示
4. 明确年度课程库生成链路：
   - 源 Excel
   - 解析脚本
   - 生成文件
   - 页面筛选规则
5. 优化赠课配置：
   - 通用赠课池
   - 对应学科赠课
   - 实物赠礼池
   - 教辅资料池
   - 买一科/买两科/买三科及以上触发规则
6. 建立最小验证清单：
   - 单科
   - 两科
   - 三科
   - 不同班型
   - 清单版
   - 明细版
   - 手机端
   - 长图导出

## 后续修改时容易踩坑的地方

- 不要只看本地页面正常就认为线上正常；GitHub Pages 需要 `npm run build:pages`，并检查静态资源路径。
- 不要把 `127.0.0.1` 或 `localhost` 链接发给别人；那只对本机有效。
- 不要把后台本机保存误认为云端同步成功；必须确认 Supabase 表存在并能从另一浏览器读取。
- 不要直接手工改 `annualCourseLibrary.js`、`courseCatalog.js` 这类大文件，优先改源表或生成脚本。
- 不要在清单页展示后台语言，例如“已配置”“解析完成”“云端表未创建”等，这些只适合后台或调试态。
- 不要让实物赠礼显示课时字段；实物只展示价值、规则、说明和图片。
- 不要让对应学科赠课重复展示多次；多科购买时应按学科匹配，但同一通用赠课只展示一次。
- 不要只调网页样式而忘记导出样式；导出图可能因 `html2canvas`、图片跨域、对象适配和临时导出类导致比例变化。
- 不要把产品价格只按科目数粗暴计算；部分产品还涉及年级、文理/文综、班型、优惠后单科价和总价。
