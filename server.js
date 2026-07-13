import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";
const FEISHU_API = "https://open.feishu.cn/open-apis";

let tokenCache = {
  value: "",
  expiresAt: 0,
};

const productAliases = {
  grade: ["grade", "年级"],
  brand: ["brand", "品牌", "对比项"],
  className: ["class_name", "班型名称", "班型"],
  productContent: ["product_content", "产品内容", "课程内容"],
  liveLessonCount: ["live_lesson_count", "直播课节数"],
  liveLessonDuration: [
    "live_lesson_duration",
    "直播课时长 / 节",
    "直播课时长/节",
    "直播课时长",
    "直播课时长 / 节（2h=4课时）",
    "直播课时长/节（2h=4课时）",
  ],
  videoLessonCount: ["video_lesson_count", "视频课节数"],
  totalClassHours: [
    "total_class_hours",
    "单科总课时量（直播加视频）",
    "单科总课时量(直播加视频)",
    "单科总课时量",
    "总课时量",
  ],
  singleSubjectPrice: ["single_subject_price", "单科价格"],
  singleSubjectHourlyPrice: ["single_subject_hourly_price", "单科价格 / 每课时", "单科价格/每课时"],
  comboPrice: ["combo_price", "3科联报价格", "3科联报价", "联报价格"],
  comboHourlyPrice: [
    "combo_hourly_price",
    "3科联报价格 / 每课时",
    "3科联报价格/每课时",
    "3科联报价 / 每课时",
    "3科联报价/每课时",
    "联报价格 / 每课时",
    "联报价格/每课时",
  ],
  isYoudao: ["is_youdao", "是否有道领世", "是否有道"],
  badge: ["badge", "标签"],
  contentBadge: ["content_badge", "内容标签"],
  sortOrder: ["sort_order", "排序", "顺序"],
};

const normalizedKnownProductFieldNames = buildAliasSet(productAliases);

const blockAliases = {
  grade: ["grade", "年级"],
  key: ["block_key", "模块标识", "模块", "key"],
  title: ["title", "标题"],
  label: ["label", "序号", "模块序号"],
  headline: ["headline", "主文案", "核心文案"],
  description: ["description", "说明", "描述"],
  badge: ["badge", "标签"],
  slogan: ["slogan", "口号"],
  items: ["items", "条目", "要点"],
  steps: ["steps", "步骤"],
  priceRows: ["price_rows", "价格行"],
  payload: ["payload_json", "payload", "JSON配置"],
  sortOrder: ["sort_order", "排序", "顺序"],
};

app.use(express.json());

app.get("/", (_request, response) => {
  response.sendFile(path.join(__dirname, "preview.html"));
});

app.use(express.static(__dirname, { index: false }));

app.get("/api/competitor", async (request, response) => {
  try {
    const grade = String(request.query.grade || "新高一").trim();
    const [productRecords, blockRecords] = await Promise.all([
      listBitableRecords(requiredEnv("FEISHU_COMPETITOR_PRODUCTS_TABLE_ID")),
      listBitableRecords(requiredEnv("FEISHU_ADVANTAGE_BLOCKS_TABLE_ID")),
    ]);

    const products = productRecords
      .map((record, index) => normalizeProduct(record, index))
      .filter((product) => product.grade === grade);

    const advantageBlocks = blockRecords
      .map((record, index) => normalizeAdvantageBlock(record, index))
      .filter((block) => block.grade === grade)
      .sort(bySortOrder)
      .reduce((blocks, block) => {
        blocks[block.key] = block;
        return blocks;
      }, {});

    response.json({
      grade,
      products,
      advantageBlocks,
    });
  } catch (error) {
    console.error(error);
    response.status(502).json({
      message: "数据加载失败，请稍后刷新",
    });
  }
});

app.listen(port, host, () => {
  console.log(`Competitor page is running at http://${host}:${port}`);
});

async function listBitableRecords(tableId) {
  const appToken = requiredEnv("FEISHU_APP_TOKEN");
  const token = await getTenantAccessToken();
  const items = [];
  let pageToken = "";

  do {
    const url = new URL(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables/${tableId}/records`);
    url.searchParams.set("page_size", "500");
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const result = await fetchJson(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (result.code !== 0) {
      throw new Error(result.msg || `飞书多维表格读取失败：${tableId}`);
    }

    items.push(...(result.data?.items || []));
    pageToken = result.data?.page_token || "";
  } while (pageToken);

  return items;
}

async function getTenantAccessToken() {
  const now = Date.now();
  if (tokenCache.value && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.value;
  }

  const result = await fetchJson(`${FEISHU_API}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: requiredEnv("FEISHU_APP_ID"),
      app_secret: requiredEnv("FEISHU_APP_SECRET"),
    }),
  });

  if (result.code !== 0 || !result.tenant_access_token) {
    throw new Error(result.msg || "飞书 tenant_access_token 获取失败");
  }

  tokenCache = {
    value: result.tenant_access_token,
    expiresAt: now + Number(result.expire || 7200) * 1000,
  };

  return tokenCache.value;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`飞书接口请求失败：${response.status}`);
  }
  return response.json();
}

function normalizeProduct(record, index) {
  const fields = record.fields || {};
  const brand = readField(fields, productAliases.brand);
  const extraFields = collectExtraProductFields(fields);

  return {
    id: record.record_id || `product-${index}`,
    grade: readField(fields, productAliases.grade),
    brand,
    className: readField(fields, productAliases.className),
    productContent: readField(fields, productAliases.productContent),
    liveLessonCount: readField(fields, productAliases.liveLessonCount),
    liveLessonDuration: readField(fields, productAliases.liveLessonDuration),
    videoLessonCount: readField(fields, productAliases.videoLessonCount),
    totalClassHours: readField(fields, productAliases.totalClassHours),
    singleSubjectPrice: readField(fields, productAliases.singleSubjectPrice),
    singleSubjectHourlyPrice: readField(fields, productAliases.singleSubjectHourlyPrice),
    comboPrice: readField(fields, productAliases.comboPrice),
    comboHourlyPrice: readField(fields, productAliases.comboHourlyPrice),
    isYoudao: parseBoolean(readRawField(fields, productAliases.isYoudao)) || brand.includes("有道"),
    badge: readField(fields, productAliases.badge),
    contentBadge: readField(fields, productAliases.contentBadge),
    sortOrder: parseSortOrder(readRawField(fields, productAliases.sortOrder), index),
    extraFields,
  };
}

function normalizeAdvantageBlock(record, index) {
  const fields = record.fields || {};
  const payload = parseJson(readField(fields, blockAliases.payload));
  const key = normalizeBlockKey(readField(fields, blockAliases.key));
  const items = normalizeList(readRawField(fields, blockAliases.items));
  const steps = normalizeList(readRawField(fields, blockAliases.steps));
  const priceRows = normalizeList(readRawField(fields, blockAliases.priceRows));

  return {
    key,
    grade: readField(fields, blockAliases.grade),
    title: readField(fields, blockAliases.title),
    label: readField(fields, blockAliases.label),
    headline: readField(fields, blockAliases.headline),
    description: readField(fields, blockAliases.description),
    badge: readField(fields, blockAliases.badge),
    slogan: readField(fields, blockAliases.slogan),
    items,
    steps,
    priceRows,
    sortOrder: parseSortOrder(readRawField(fields, blockAliases.sortOrder), index),
    ...payload,
  };
}

function readField(fields, aliases) {
  return normalizeValue(readRawField(fields, aliases));
}

function readRawField(fields, aliases) {
  const exactKey = aliases.find((alias) => Object.prototype.hasOwnProperty.call(fields, alias));
  if (exactKey) return fields[exactKey];

  const normalizedAliases = new Set(aliases.map(normalizeFieldName));
  const fieldKey = Object.keys(fields).find((key) => normalizedAliases.has(normalizeFieldName(key)));
  if (fieldKey) return fields[fieldKey];

  const normalizedFieldEntries = Object.keys(fields).map((key) => ({
    key,
    normalized: normalizeFieldName(key),
  }));

  const normalizedAliasList = aliases
    .map(normalizeFieldName)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  for (const normalizedAlias of normalizedAliasList) {
    const containingAlias = normalizedFieldEntries
      .filter(({ normalized }) => normalized.includes(normalizedAlias))
      .sort((left, right) => left.normalized.length - right.normalized.length);

    if (containingAlias.length > 0) {
      return fields[containingAlias[0].key];
    }
  }

  for (const normalizedAlias of normalizedAliasList) {
    const reverseFuzzyMatches = normalizedFieldEntries
      .filter(({ normalized }) => (
        normalizedAlias.includes(normalized) &&
        normalized.length / normalizedAlias.length >= 0.8
      ))
      .sort((left, right) => right.normalized.length - left.normalized.length);

    if (reverseFuzzyMatches.length > 0) {
      return fields[reverseFuzzyMatches[0].key];
    }
  }

  for (const alias of aliases) {
    const normalizedAlias = normalizeFieldName(alias);
    const fuzzyField = normalizedFieldEntries.find(({ normalized }) => (
      normalized === normalizedAlias
    ));
    if (fuzzyField) return fields[fuzzyField.key];
  }

  return "";
}

function normalizeValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(normalizeValue).filter(Boolean).join("\n");
  if (typeof value === "object") {
    if ("text" in value) return normalizeValue(value.text);
    if ("name" in value) return normalizeValue(value.name);
    if ("en_name" in value) return normalizeValue(value.en_name);
    if ("value" in value) return normalizeValue(value.value);
    if ("link" in value) return normalizeValue(value.link);
    return Object.values(value).map(normalizeValue).filter(Boolean).join("\n");
  }
  return String(value).trim();
}

function normalizeFieldName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）]/g, "")
    .replace(/[/:：]/g, "")
    .replace(/[·]/g, "")
    .replace(/[，,]/g, "")
    .replace(/[。.\-—_]/g, "");
}

function buildAliasSet(aliasMap) {
  return new Set(
    Object.values(aliasMap)
      .flat()
      .map(normalizeFieldName)
      .filter(Boolean)
  );
}

function collectExtraProductFields(fields) {
  return Object.entries(fields).flatMap(([fieldName, rawValue], index) => {
    const normalizedField = normalizeFieldName(fieldName);
    if (!normalizedField || normalizedKnownProductFieldNames.has(normalizedField)) {
      return [];
    }

    const value = normalizeValue(rawValue);
    if (!value) {
      return [];
    }

    return [{
      key: `extra:${normalizedField}`,
      label: String(fieldName || "").trim(),
      value,
      sortOrder: index,
    }];
  });
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeList(item)).filter(Boolean);
  }

  const normalized = normalizeValue(value);
  if (!normalized) return [];

  const parsed = parseJson(normalized);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") return [parsed];

  return normalized
    .split(/\n+/)
    .map((item) => item.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, "").trim())
    .filter(Boolean);
}

function parseJson(value) {
  if (!value || typeof value !== "string") return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function parseBoolean(value) {
  const normalized = normalizeValue(value).toLowerCase();
  return ["true", "1", "yes", "y", "是", "有道", "有道领世"].includes(normalized);
}

function parseSortOrder(value, fallback) {
  const number = Number(normalizeValue(value));
  return Number.isFinite(number) ? number : fallback;
}

function normalizeBlockKey(value) {
  const normalized = String(value || "").trim();
  const lower = normalized.toLowerCase();
  const keyMap = {
    product_composition: "product_composition",
    price_advantage: "price_advantage",
    knowledge_video: "knowledge_video",
    live_method: "live_method",
    tutoring_service: "tutoring_service",
    price_card: "price_card",
    note: "note",
  };

  if (keyMap[lower]) return keyMap[lower];
  if (normalized.includes("产品组成")) return "product_composition";
  if (normalized.includes("价格优势")) return "price_advantage";
  if (normalized.includes("知识视频")) return "knowledge_video";
  if (normalized.includes("学法直播")) return "live_method";
  if (normalized.includes("辅导服务")) return "tutoring_service";
  if (normalized.includes("价格卡")) return "price_card";
  if (normalized.includes("备注") || normalized.includes("说明")) return "note";
  return lower || "block";
}

function bySortOrder(a, b) {
  return a.sortOrder - b.sortOrder;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量：${name}`);
  return value;
}
