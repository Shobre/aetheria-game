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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const b = req.body || {};
  try {
    if (b.action === 'save') {
      await tursoExec('INSERT OR REPLACE INTO saves (username, slot, data, updated_at) VALUES (?, ?, ?, ?)', [b.username, b.slot, JSON.stringify(b.state), Date.now()]);
      return res.json({ ok: true });
    }
    if (b.action === 'load') {
      const r = await tursoExec('SELECT data FROM saves WHERE username=? AND slot=?', [b.username, b.slot]);
      const d = r.rows && r.rows[0] ? JSON.parse(r.rows[0][0]) : null;
      return res.json({ data: d });
    }
    if (b.action === 'list') {
      const r = await tursoExec('SELECT slot, updated_at FROM saves WHERE username=? ORDER BY slot', [b.username]);
      return res.json({ slots: r.rows || [] });
    }
    if (b.action === 'delete') {
      await tursoExec('DELETE FROM saves WHERE username=? AND slot=?', [b.username, b.slot]);
      return res.json({ ok: true });
    }
    if (b.action === 'register') {
      await tursoExec('INSERT OR IGNORE INTO users (username, password_hash, created_at) VALUES (?, ?, ?)', [b.username, b.hash, Date.now()]);
      return res.json({ ok: true });
    }
    if (b.action === 'login') {
      const r = await tursoExec('SELECT password_hash FROM users WHERE username=?', [b.username]);
      const ok = r.rows && r.rows[0] && r.rows[0][0] === b.hash;
      if (ok) await tursoExec('UPDATE users SET last_login=? WHERE username=?', [Date.now(), b.username]);
      return res.json({ ok });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch(e) { return res.status(500).json({ error: e.message }); }
}
