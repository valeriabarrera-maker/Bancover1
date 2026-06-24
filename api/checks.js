// API de estado compartido de checkboxes (REQ marcados).
// Lee/escribe en Redis (Vercel KV / Upstash) usando la REST API, sin dependencias.
// Estado global: todos los dispositivos comparten el mismo conjunto de REQ marcados.

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'sgdea_req_checks';

async function redis(cmd) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return r.json();
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (!URL || !TOKEN) {
    response.status(500).json({ error: 'storage_not_configured' });
    return;
  }

  try {
    if (request.method === 'GET') {
      const out = await redis(['HGETALL', KEY]);
      const arr = out.result || [];
      const checks = {};
      // HGETALL devuelve [campo, valor, campo, valor, ...]
      for (let i = 0; i < arr.length; i += 2) checks[arr[i]] = true;
      response.status(200).json({ checks });
      return;
    }

    if (request.method === 'POST') {
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : (request.body || {});
      const id = body.id;
      const value = !!body.value;
      if (!id) {
        response.status(400).json({ error: 'missing id' });
        return;
      }
      if (value) await redis(['HSET', KEY, id, '1']);
      else await redis(['HDEL', KEY, id]);
      response.status(200).json({ ok: true });
      return;
    }

    response.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    response.status(500).json({ error: String(e && e.message || e) });
  }
}
