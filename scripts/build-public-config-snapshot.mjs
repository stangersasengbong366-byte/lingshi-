import { writeFile } from "node:fs/promises";

const origins = [
  "https://lingshi-benefits-api.stangersasengbong366.workers.dev",
  "https://lingshi-benefits-api-pages.stangersasengbong366.workers.dev",
];
const previousSnapshotUrl = "https://stangersasengbong366-byte.github.io/lingshi-/cloud-config.json";

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function getConfig(id) {
  let lastError;
  for (const origin of origins) {
    try {
      return await getJson(`${origin}/configs/${id}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

let snapshot;
try {
  const record = await getConfig("products_published");
  const products = record?.payload?.products;
  if (!Array.isArray(products) || !products.length) throw new Error("云端产品配置为空");
  // 这个文件是销售端首次访问的快速降级通道，不能携带大体积课程库和
  // base64 图片。课程已随站点打包，当前产品图片会在选中后按需读取。
  snapshot = { source: "products_published", syncedAt: new Date().toISOString(), products };
} catch (error) {
  console.warn(`云端暂不可达，保留上次成功同步的配置: ${error.message}`);
  snapshot = await getJson(previousSnapshotUrl);
  if (snapshot?.source !== "products_published" || !Array.isArray(snapshot.products) || !snapshot.products.length) {
    throw new Error("没有可用的运营配置快照");
  }
  // 旧版快照可能超过 7 MB。云端暂不可达时也只继承其中的产品配置，
  // 避免定时发布把超大文件原样复制回线上。
  snapshot = { source: "products_published", syncedAt: snapshot.syncedAt, products: snapshot.products };
}

await writeFile("dist/cloud-config.json", JSON.stringify(snapshot));
console.log(`销售备用配置: ${snapshot.syncedAt}, ${snapshot.products.length} 个产品`);
