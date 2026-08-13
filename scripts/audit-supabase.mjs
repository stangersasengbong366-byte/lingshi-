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

const endpoint = `${url}/rest/v1/benefit_configs?id=in.(products_published,products)&select=id,payload,updated_at`;
const origin = 'https://stangersasengbong366-byte.github.io';

async function run(label, headers) {
  const response = await fetch(endpoint, { headers, cache: 'no-store' });
  const body = await response.text();
  console.log(`=== ${label} ===`);
  console.log(JSON.stringify({
    status: response.status,
    ok: response.ok,
    allowOrigin: response.headers.get('access-control-allow-origin'),
    allowHeaders: response.headers.get('access-control-allow-headers'),
    contentType: response.headers.get('content-type'),
    bodyPreview: body.slice(0, 700),
  }));
}

await run('APIKEY_ONLY', { apikey: key, Origin: origin });
await run('APIKEY_AND_AUTH', { apikey: key, Authorization: `Bearer ${key}`, Origin: origin });

const options = await fetch(`${url}/rest/v1/benefit_configs`, {
  method: 'OPTIONS',
  headers: {
    Origin: origin,
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'apikey,authorization',
  },
});
console.log('=== PREFLIGHT ===');
console.log(JSON.stringify({
  status: options.status,
  ok: options.ok,
  allowOrigin: options.headers.get('access-control-allow-origin'),
  allowMethods: options.headers.get('access-control-allow-methods'),
  allowHeaders: options.headers.get('access-control-allow-headers'),
}));
