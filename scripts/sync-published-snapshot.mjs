import fs from "node:fs";

const endpoint = process.argv[2]
  ?? "https://lingshi-benefits-api.stangersasengbong366.workers.dev/configs/products_published";
const response = await fetch(endpoint, { cache: "no-store" });
if (!response.ok) throw new Error(`读取 Cloudflare 已发布配置失败：${response.status}`);
const record = await response.json();
const products = record?.payload?.products;
if (!Array.isArray(products)) throw new Error("Cloudflare 已发布配置中缺少 products 数组");

const output = `// Generated snapshot of the Cloudflare published configuration.\n// Used only when the cloud configuration endpoint is unavailable.\nexport const publishedProductSnapshot = ${JSON.stringify(products, null, 2)};\n`;
fs.writeFileSync("src/data/publishedProductSnapshot.js", output);
console.log(`已同步 ${products.length} 个产品到 src/data/publishedProductSnapshot.js`);
