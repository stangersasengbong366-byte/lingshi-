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
