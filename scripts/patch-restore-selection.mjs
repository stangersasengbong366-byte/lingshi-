import fs from 'node:fs';
const path = 'scripts/audit-supabase.mjs';
let s = fs.readFileSync(path, 'utf8');
const old = `const byId = new Map();\nfor (const row of shares) {\n  for (const p of arr(row.payload)) {\n    if (p?.id) byId.set(p.id, p);\n  }\n}\nconst products = [...byId.values()];`;
const next = `const completeness = p => {\n  let n = 0;\n  if (+p?.core?.liveLessons) n += 3;\n  if (+p?.core?.knowledgeVideos) n += 3;\n  if (+p?.pricing?.singlePerSubject) n += 5;\n  if (Array.isArray(p?.giftSelections)) n += p.giftSelections.length;\n  if (Array.isArray(p?.customGiftItems)) n += p.customGiftItems.length;\n  if (p?.core?.servicePeriod) n += 2;\n  return n;\n};\nconst byId = new Map();\nfor (const row of shares) {\n  for (const p of arr(row.payload)) {\n    if (!p?.id) continue;\n    const old = byId.get(p.id);\n    if (!old || completeness(p) > completeness(old)) byId.set(p.id, p);\n  }\n}\nconst products = [...byId.values()];`;
if (!s.includes(old)) throw new Error('restore selection block not found');
s = s.replace(old, next);
fs.writeFileSync(path, s);
console.log('restore selection patched: completeness-first');
