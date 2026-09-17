import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/worker.js";

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

test("运营端可用无需预检的 POST 请求保存 Cloudflare 配置", async () => {
  const records = new Map();
  const env = {
    ADMIN_PASSWORD_HASH: await sha256("lingshi2026"),
    BENEFIT_CONFIGS: {
      get: async (key) => records.get(key) ?? null,
      put: async (key, value) => records.set(key, value),
    },
  };
  const request = new Request("https://example.com/configs/products_draft", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      Origin: "https://stangersasengbong366-byte.github.io",
    },
    body: JSON.stringify({ products: [{ id: "product-1" }], adminPassword: "lingshi2026" }),
  });

  const response = await worker.fetch(request, env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://stangersasengbong366-byte.github.io");
  const stored = JSON.parse(records.get("products_draft"));
  assert.deepEqual(stored.products, [{ id: "product-1" }]);
  assert.equal("adminPassword" in stored, false);
});

test("运营端可把年级课程库独立保存到 Cloudflare KV", async () => {
  const records = new Map();
  const env = {
    ADMIN_PASSWORD_HASH: await sha256("lingshi2026"),
    BENEFIT_CONFIGS: {
      get: async (key) => records.get(key) ?? null,
      put: async (key, value) => records.set(key, value),
    },
  };
  const payload = {
    grade: "高一",
    data: { live: { 数学: [{ title: "测试直播" }] }, video: { 数学: [{ title: "测试视频" }] } },
    uploadNames: { live: "直播.xlsx", video: "视频.xlsx" },
    version: "uploaded-test",
  };
  const response = await worker.fetch(new Request("https://example.com/configs/course_library_g1", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ ...payload, adminPassword: "lingshi2026" }),
  }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(records.get("course_library_g1")).data, payload.data);
});

test("课程卡片图片单独写入 Cloudflare KV，避免产品配置压缩后丢失", async () => {
  const records = new Map();
  const env = {
    ADMIN_PASSWORD_HASH: await sha256("lingshi2026"),
    BENEFIT_CONFIGS: {
      get: async (key) => records.get(key) ?? null,
      put: async (key, value) => records.set(key, value),
    },
  };
  const payload = {
    productId: "product-1",
    media: { "cloud-media:root.customGiftItems.0.image": "data:image/png;base64,abc" },
  };
  const write = await worker.fetch(new Request("https://example.com/configs/product_media_product-1", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ ...payload, adminPassword: "lingshi2026" }),
  }), env);
  assert.equal(write.status, 200);
  const read = await worker.fetch(new Request("https://example.com/configs/product_media_product-1"), env);
  assert.equal(read.status, 200);
  assert.deepEqual((await read.json()).payload.media, payload.media);
});
