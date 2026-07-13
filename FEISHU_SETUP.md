# 飞书竞品数据源填写说明

这次要对接的飞书多维表格是：

`https://bwi7u5ha9he.feishu.cn/base/XzhrbVLaXaFcENslLujcOKrcnib`

其中这份 base 的 `app_token` 就是：

`XzhrbVLaXaFcENslLujcOKrcnib`

这个页面不是直接在 HTML 里手填竞品信息，而是通过：

`飞书多维表格 -> Node 接口 -> preview.html`

页面请求地址是：

`/api/competitor?grade=新高一`

后端代码在 [server.js](./server.js)，页面在 [preview.html](./preview.html)。

## 1. 先填写 .env

参考 [`.env.example`](./.env.example) 新建一个 `.env`，填写下面几项：

```env
PORT=3001

FEISHU_APP_ID=你的飞书应用 App ID
FEISHU_APP_SECRET=你的飞书应用 App Secret
FEISHU_APP_TOKEN=XzhrbVLaXaFcENslLujcOKrcnib
FEISHU_COMPETITOR_PRODUCTS_TABLE_ID=competitor_products 这张表的 table_id
FEISHU_ADVANTAGE_BLOCKS_TABLE_ID=advantage_blocks 这张表的 table_id
```

也就是说，你这次只需要再补：

- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_COMPETITOR_PRODUCTS_TABLE_ID`
- `FEISHU_ADVANTAGE_BLOCKS_TABLE_ID`

## 2. 表一：competitor_products

这张表存顶部竞品对比表的数据。

建议表名就叫：

`competitor_products`

建议每一行代表一个品牌在某个年级下的一套产品。

### 推荐字段

| 字段名 | 是否必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `grade` | 是 | `新高一` | 支持 `新高一`、`新高二`、`新高三` |
| `brand` | 是 | `有道领世` | 表头品牌名 |
| `class_name` | 是 | `新高一半年卡（赠冲刺）` | 班型名称 |
| `product_content` | 是 | `暑：10节直播\n秋：16节直播+40节视频` | 产品内容，支持换行 |
| `live_lesson_count` | 是 | `26` | 直播课节数 |
| `live_lesson_duration` | 是 | `2h` | 每节直播时长 |
| `video_lesson_count` | 是 | `40` | 视频课节数 |
| `total_class_hours` | 是 | `144` | 总课时量 |
| `single_subject_price` | 是 | `3980` | 单科价格 |
| `single_subject_hourly_price` | 是 | `28` | 单科价格 / 每课时 |
| `combo_price` | 是 | `10140` | 联报价格 |
| `combo_hourly_price` | 是 | `23` | 联报价格 / 每课时 |
| `is_youdao` | 建议 | `true` | 是否高亮成有道领世列 |
| `badge` | 否 | `高性价比` | 品牌头部小标签 |
| `content_badge` | 否 | `唯一含知识视频` | 产品内容下面的橙色标签 |
| `sort_order` | 建议 | `1` | 控制品牌列顺序 |

### 你最少要保证

`grade`
`brand`
`class_name`
`product_content`
`live_lesson_count`
`live_lesson_duration`
`video_lesson_count`
`total_class_hours`
`single_subject_price`
`single_subject_hourly_price`
`combo_price`
`combo_hourly_price`

## 3. 表二：advantage_blocks

建议表名就叫：

`advantage_blocks`

这张表存下面几个说明模块：

`note`
`product_composition`
`price_advantage`
`knowledge_video`
`live_method`
`tutoring_service`
`price_card`

建议每个 `grade + block_key` 对应一行。

### 通用字段

| 字段名 | 是否必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `grade` | 是 | `新高一` | 年级 |
| `block_key` | 是 | `price_advantage` | 模块标识 |
| `title` | 否 | `价格优势` | 模块标题 |
| `label` | 否 | `B` | 模块左上角序号 |
| `headline` | 否 | `单科每课时 28 元...` | 主文案 |
| `description` | 否 | `以学生为中心...` | 说明文案 |
| `badge` | 否 | `唯一配备 40 节知识视频` | 蓝色标签等 |
| `slogan` | 否 | `价格更优 · 内容更全 · 学习闭环更完整` | 口号 |
| `items` | 否 | 多行文本或 JSON 数组 | 要点列表 |
| `steps` | 否 | 多行文本或 JSON 数组 | 步骤列表 |
| `price_rows` | 否 | JSON 数组 | 右侧价格卡 |
| `payload_json` | 否 | JSON 对象 | 扩展配置 |
| `sort_order` | 建议 | `1` | 排序 |

## 4. 各模块怎么填

### `note`

- 用 `description` 填表格下方那行提示语。

### `product_composition`

- `title`：产品组成
- `label`：A
- `headline`：例如 `学法直播 + 知识视频 + 辅导服务`
- `steps`：建议填 JSON 数组

示例：

```json
[
  { "icon": "▶", "title": "学法直播", "description": "每节约2小时\n考点讲解与方法应用" },
  { "icon": "▶", "title": "知识视频", "description": "40节系统视频\n补充知识体系" },
  { "icon": "♙", "title": "辅导服务", "description": "九步教学服务\n全程陪伴" }
]
```

### `price_advantage`

- `title`：价格优势
- `label`：B
- `headline`：大号价格文案
- `items`：下方两条或多条勾选文案

`items` 用多行文本也可以，例如：

```text
在主流竞品中处于低位，兼顾价格优势与内容完整度
不仅有直播，更额外配备40节知识视频
```

### `knowledge_video`

- `title`：独家知识视频｜仅有道领世有
- `label`：C
- `items`：4 条卖点
- `badge`：底部蓝色胶囊标签

### `live_method`

- `title`：学法直播
- `label`：D
- `items`：4 条卖点

### `tutoring_service`

- `title`：辅导服务｜九步教学服务法
- `label`：E
- `steps`：建议填 JSON 数组
- `description`：底部说明文字

示例：

```json
[
  { "icon": "📋", "title": "知学情" },
  { "icon": "🗓️", "title": "做计划" },
  { "icon": "🎬", "title": "看视频" },
  { "icon": "✎", "title": "做练习" },
  { "icon": "📺", "title": "观直播" },
  { "icon": "?", "title": "勤答疑" },
  { "icon": "🧾", "title": "温错题" },
  { "icon": "📊", "title": "月反馈" },
  { "icon": "📄", "title": "析试卷" }
]
```

### `price_card`

- `title`：右侧橙色卡的大标题
- `slogan`：底部圆角口号
- `price_rows`：建议填 JSON 数组

示例：

```json
[
  { "name": "单科每课时", "value": "28", "unit": "元" },
  { "name": "联报每课时", "value": "23", "unit": "元" }
]
```

## 5. 怎么实现实时更新

不是改 HTML 文件。

你需要改的是飞书多维表格里的两张表数据。页面每次刷新时会重新请求后端接口，后端再去飞书取最新数据。

使用方式：

1. 启动服务：`pnpm start`
2. 打开：`http://localhost:3001`
3. 修改飞书表内容
4. 刷新页面

这样就能看到最新内容。

## 本地预览最简单的方式

如果你只是想看“改完是什么效果”，不要直接双击 `preview.html`。

直接双击这两个文件即可：

- [启动本地预览.command](/Users/admin/Documents/有道领世%20产品权益/启动本地预览.command)
- [停止本地预览.command](/Users/admin/Documents/有道领世%20产品权益/停止本地预览.command)

推荐日常使用流程：

1. 双击 `启动本地预览.command`
2. 浏览器会自动打开本地预览页
3. 修改飞书后刷新页面查看效果
4. 不看了再双击 `停止本地预览.command`

## 6. 注意

- 不要用 `file://.../preview.html` 打开页面，这样不会请求本地 API。
- 一定要通过 `http://localhost:3001` 访问。
- 如果页面出现“数据加载失败，请稍后刷新”，优先检查：
  - `.env` 是否已填写
  - 飞书应用权限是否已开通
  - 两张表的 `table_id` 是否正确
  - 记录里的 `grade` 是否写成了 `新高一 / 新高二 / 新高三`
