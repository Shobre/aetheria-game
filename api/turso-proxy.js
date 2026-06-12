export const config = { runtime: 'edge' };

const TURSO_URL = process.env['TURSO_DB_URL'] || '';
const tursoToken = process.env['TURSO_TOKEN'] || '';

async function tursoExec(sql, args) {
  if (!TURSO_URL || !tursoToken) { return { error: 'not configured' }; }
  const res = await fetch(TURSO_URL.replace('libsql://', 'https://') + '/v2/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tursoToken },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args: args || [] } }] })
  });
  const data = await res.json();
  try {
    const r = data.results[0].response.result;
    return { rows: (r.rows || []).map(row => row.map(c => c.value !== undefined ? c.value : c)) };
  } catch(e) { return { error: e.message }; }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }});
  }
  try {
    const b = await req.json();
    const action = b.action;
    const username = b.username;
    if (action === 'save') {
      await tursoExec('INSERT OR REPLACE INTO saves (username, slot, data, updated_at) VALUES (?, ?, ?, ?)', [username, b.slot, JSON.stringify(b.state), Date.now()]);
      return Response.json({ ok: true }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    if (action === 'load') {
      const r = await tursoExec('SELECT data FROM saves WHERE username=? AND slot=?', [username, b.slot]);
      const d = r.rows && r.rows[0] ? JSON.parse(r.rows[0][0]) : null;
      return Response.json({ data: d }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    if (action === 'list') {
      const r = await tursoExec('SELECT slot, updated_at FROM saves WHERE username=? ORDER BY slot', [username]);
      return Response.json({ slots: r.rows || [] }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    if (action === 'delete') {
      await tursoExec('DELETE FROM saves WHERE username=? AND slot=?', [username, b.slot]);
      return Response.json({ ok: true }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    if (action === 'register') {
      await tursoExec('INSERT OR IGNORE INTO users (username, password_hash, created_at) VALUES (?, ?, ?)', [username, b.hash, Date.now()]);
      return Response.json({ ok: true }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    if (action === 'login') {
      const r = await tursoExec('SELECT password_hash FROM users WHERE username=?', [username]);
      const ok = r.rows && r.rows[0] && r.rows[0][0] === b.hash;
      if (ok) await tursoExec('UPDATE users SET last_login=? WHERE username=?', [Date.now(), username]);
      return Response.json({ ok }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
  } catch(e) {
    return Response.json({ error: e.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
