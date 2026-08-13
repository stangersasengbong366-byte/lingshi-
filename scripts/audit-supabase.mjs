import fs from 'node:fs';

function parseEnv(path) {
  const text = fs.readFileSync(path, 'utf8');
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = parseEnv('.env.production');
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Supabase env missing');

const H = { apikey: key, Authorization: `Bearer ${key}` };
const table = 'benefit_configs';
async function get(path) {
  const r = await fetch(`${url}/rest/v1/${table}${path}`, { headers: H, cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}
async function upsert(id, payload) {
  const r = await fetch(`${url}/rest/v1/${table}?on_conflict=id`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id, payload, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}

const sourceIds = [
  'share_1s3d523e4',
  'share_0o6f0a5a2',
  'share_4x4m4t4w1',
  'share_3e2637374',
  'share_5n4b1l6o1',
  'share_5m6240412',
];

const core = await get('?id=in.(products,products_draft,products_published)&select=id,payload,updated_at');
const coreById = Object.fromEntries(core.map(r => [r.id, r]));
const shares = await get(`?id=in.(${sourceIds.join(',')})&select=id,payload,updated_at`);

const arr = p => Array.isArray(p) ? p : Array.isArray(p?.products) ? p.products : [];
const byId = new Map();
for (const row of shares) {
  for (const p of arr(row.payload)) {
    if (p?.id) byId.set(p.id, p);
  }
}
const products = [...byId.values()];
if (products.length !== 6) {
  throw new Error(`恢复候选数量异常：期望6个，实际${products.length}个`);
}

const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, '-');
await upsert(`recovery_backup_${stamp}_draft`, coreById.products_draft?.payload ?? null);
await upsert(`recovery_backup_${stamp}_published`, coreById.products_published?.payload ?? null);

const latestWithLibraries = [...core]
  .filter(r => r.payload?.gradeCourseLibraries && Object.keys(r.payload.gradeCourseLibraries).length)
  .sort((a,b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0];
const gradeCourseLibraries = latestWithLibraries?.payload?.gradeCourseLibraries || {};

const payload = {
  products,
  gradeCourseLibraries,
  version: Date.now(),
  recoveredAt: new Date().toISOString(),
  recoveredFrom: sourceIds,
};

await upsert('products_draft', payload);
await upsert('products_published', payload);

const verify = await get('?id=in.(products_draft,products_published)&select=id,payload,updated_at');
console.log('=== SUPABASE RESTORE VERIFIED ===');
for (const row of verify) {
  const ps = arr(row.payload);
  console.log(JSON.stringify({
    id: row.id,
    updated_at: row.updated_at,
    count: ps.length,
    products: ps.map(p => ({
      id: p.id,
      grade: p.grade,
      name: p.name,
      stage: p.stage,
      status: p.status,
      liveLessons: p?.core?.liveLessons,
      knowledgeVideos: p?.core?.knowledgeVideos,
      singlePrice: p?.pricing?.singlePerSubject,
      giftCount: Array.isArray(p?.giftSelections) ? p.giftSelections.length : 0,
    })),
    hasLibraries: Boolean(row.payload?.gradeCourseLibraries && Object.keys(row.payload.gradeCourseLibraries).length),
  }));
  if (ps.length !== 6) throw new Error(`${row.id} 回读数量不是6`);
  if (ps.some(p => /新产品|未命名|待配置|测试产品/.test(String(p?.name || '')))) {
    throw new Error(`${row.id} 仍包含错误模板产品`);
  }
}
console.log(`RESTORE_OK backup_prefix=recovery_backup_${stamp}`);
