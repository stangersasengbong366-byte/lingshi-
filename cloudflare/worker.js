const ALLOWED_ORIGINS = new Set([
  "https://stangersasengbong366-byte.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const readableConfigIds = new Set(["products_published", "products_draft"]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    ...(origin && ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  };
}

function json(request, body, status = 200, cacheControl = "public, max-age=60, s-maxage=600, stale-while-revalidate=86400") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      ...corsHeaders(request),
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request) });

    const url = new URL(request.url);
    if (url.pathname === "/health") return json(request, { ok: true, storage: "kv" }, 200, "no-store");

    const match = url.pathname.match(/^\/configs\/([a-z0-9_-]+)$/);
    const configId = match?.[1];
    if (!configId || !readableConfigIds.has(configId)) return json(request, { error: "not_found" }, 404, "no-store");

    if (request.method === "PUT") {
      const passwordHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(request.headers.get("X-Admin-Password") || ""));
      const received = Array.from(new Uint8Array(passwordHash), (byte) => byte.toString(16).padStart(2, "0")).join("");
      if (!env.ADMIN_PASSWORD_HASH || received !== env.ADMIN_PASSWORD_HASH) return json(request, { error: "unauthorized" }, 401, "no-store");
      try {
        const payload = await request.json();
        if (!Array.isArray(payload?.products)) return json(request, { error: "invalid_payload" }, 400, "no-store");
        await env.BENEFIT_CONFIGS.put(configId, JSON.stringify({ ...payload, updatedAt: new Date().toISOString() }));
        return json(request, { ok: true, id: configId }, 200, "no-store");
      } catch {
        return json(request, { error: "invalid_payload" }, 400, "no-store");
      }
    }

    if (request.method !== "GET") return json(request, { error: "method_not_allowed" }, 405, "no-store");

    // 迁移期运营端读取与销售端相同的已发布配置，杜绝继续读取受限的 Supabase 草稿。
    const stored = await env.BENEFIT_CONFIGS.get(configId) || (configId === "products_draft"
      ? await env.BENEFIT_CONFIGS.get("products_published")
      : null);
    if (!stored) return json(request, { error: "config_not_found" }, 404, "no-store");

    try {
      return json(request, { id: configId, payload: JSON.parse(stored) });
    } catch {
      return json(request, { error: "invalid_config" }, 500, "no-store");
    }
  },
};
