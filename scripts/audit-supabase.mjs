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
  const r = await fetch(`${url}/rest/v1/${table}${path}`, { headers: H });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

const core = await get('?id=in.(products,products_draft,products_published)&select=id,payload,updated_at');
const shares = await get('?id=like.share_%25&select=id,payload,updated_at&order=updated_at.desc&limit=1000');
const arr = (p) => Array.isArray(p) ? p : Array.isArray(p?.products) ? p.products : [];
const generic = (name) => /新产品|未命名|待配置|测试产品/.test(String(name || ''));
const score = (p) => {
  let n = 0;
  if (p?.name && !generic(p.name)) n += 12;
  if (p?.grade) n += 2;
  if (p?.stage) n += 2;
  if (p?.status === '在售') n += 2;
  if (p?.core?.servicePeriod || p?.serviceDateRange) n += 3;
  if (+p?.core?.liveLessons) n += 2;
  if (+p?.core?.knowledgeVideos) n += 2;
  const z = p?.pricing || {};
  if ([z.originalPerSubject,z.singlePerSubject,z.twoPerSubject,z.threePlusPerSubject].some(v => Number(v) > 0)) n += 6;
  if (Array.isArray(p?.giftSelections) && p.giftSelections.length) n += 3;
  if (Array.isArray(p?.physicalGiftSelections) && p.physicalGiftSelections.length) n += 2;
  if (Array.isArray(p?.customGiftItems) && p.customGiftItems.length) n += 3;
  if (Array.isArray(p?.customPhysicalItems) && p.customPhysicalItems.length) n += 2;
  if (p?.customCourseData || p?.parsedCourseData || p?.annualCourseData) n += 3;
  return n;
};

console.log('=== CORE ROWS ===');
for (const row of core) {
  const ps = arr(row.payload);
  console.log(JSON.stringify({
    id: row.id,
    updated_at: row.updated_at,
    count: ps.length,
    names: ps.slice(0, 30).map(p => `${p.grade || ''}|${p.name || ''}|${p.stage || ''}|${p.status || ''}`),
    genericCount: ps.filter(p => generic(p?.name)).length,
    hasLibraries: Boolean(row.payload?.gradeCourseLibraries && Object.keys(row.payload.gradeCourseLibraries).length),
  }));
}

const bestById = new Map();
const add = (p, source, at) => {
  if (!p?.id || generic(p?.name)) return;
  const c = { p, source, at: at || '', s: score(p) };
  const o = bestById.get(p.id);
  if (!o || c.s > o.s || (c.s === o.s && c.at > o.at)) bestById.set(p.id, c);
};
core.forEach(r => arr(r.payload).forEach(p => add(p, r.id, r.updated_at)));
for (const r of shares) {
  const ps = arr(r.payload);
  for (const p of ps) add(p, r.id, r.updated_at);
}

const bySemantic = new Map();
for (const x of bestById.values()) {
  if (x.s < 12) continue;
  const k = `${x.p.grade || ''}|${x.p.name || ''}|${x.p.stage || ''}`;
  const o = bySemantic.get(k);
  if (!o || x.s > o.s || (x.s === o.s && x.at > o.at)) bySemantic.set(k, x);
}
const candidates = [...bySemantic.values()].sort((a,b) => String(a.p.grade).localeCompare(String(b.p.grade),'zh-CN') || String(a.p.name).localeCompare(String(b.p.name),'zh-CN'));
console.log('=== SHARE SNAPSHOTS ===');
console.log(JSON.stringify({ shareCount: shares.length, candidateCount: candidates.length }));
console.log('=== CANDIDATES ===');
for (const x of candidates) {
  console.log(JSON.stringify({
    id: x.p.id,
    grade: x.p.grade,
    name: x.p.name,
    stage: x.p.stage,
    status: x.p.status,
    score: x.s,
    source: x.source,
    updated_at: x.at,
    liveLessons: x.p?.core?.liveLessons,
    knowledgeVideos: x.p?.core?.knowledgeVideos,
    servicePeriod: x.p?.core?.servicePeriod,
    singlePrice: x.p?.pricing?.singlePerSubject,
    giftCount: Array.isArray(x.p?.giftSelections) ? x.p.giftSelections.length : 0,
    customGiftCount: Array.isArray(x.p?.customGiftItems) ? x.p.customGiftItems.length : 0,
  }));
}
