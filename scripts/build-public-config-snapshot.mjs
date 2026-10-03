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
  const record = await getConfig("products_draft");
  const products = record?.payload?.products;
  if (!Array.isArray(products) || !products.length) throw new Error("云端产品配置为空");
  const courseLibraries = {};
  const grades = [...new Set(products.map((product) => product.grade))];
  for (const grade of grades) {
    const id = { 高一: "course_library_g1", 高二: "course_library_g2", 高三: "course_library_g3" }[grade];
    if (!id) continue;
    try {
      const library = await getConfig(id);
      if (library?.payload?.data) courseLibraries[grade] = library.payload;
    } catch (error) {
      console.warn(`${grade}课程库未同步到快照: ${error.message}`);
    }
  }
  snapshot = { source: "products_draft", syncedAt: new Date().toISOString(), products, courseLibraries };
} catch (error) {
  console.warn(`云端暂不可达，保留上次成功同步的配置: ${error.message}`);
  snapshot = await getJson(previousSnapshotUrl);
  if (snapshot?.source !== "products_draft" || !Array.isArray(snapshot.products) || !snapshot.products.length) {
    throw new Error("没有可用的运营配置快照");
  }
}

await writeFile("dist/cloud-config.json", JSON.stringify(snapshot));
console.log(`销售备用配置: ${snapshot.syncedAt}, ${snapshot.products.length} 个产品`);
