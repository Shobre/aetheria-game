export const config = { runtime: 'experimental-edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers });
  }

  try {
    const body = await req.json();
    const tursoUrl = process.env.TURSO_DB_URL;
    const tursoToken = process.env.DB_AUTH;

    if (!tursoUrl || !tursoToken) {
      return new Response(JSON.stringify({ error: 'not configured' }), { status: 500, headers });
    }

    const res = await fetch(tursoUrl.replace('libsql://', 'https://') + '/v2/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tursoToken },
      body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql: body.sql, args: body.args || [] } }] })
    });

    const data = await res.json();
    
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'HTTP ' + res.status, details: data }), { status: res.status, headers });
    }

    try {
      const r = data.results[0].response.result;
      const rows = (r.rows || []).map(row => row.map(c => c.value !== undefined ? c.value : c));
      return new Response(JSON.stringify({ rows }), { headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
}
