const TURSO_URL = process.env.TURSO_DB_URL || '';
const TURSO_TOKEN = process.env.TURSO_TOKEN || '';

async function tursoExec(sql, args) {
  const res = await fetch(TURSO_URL.replace('libsql://', 'https://') + '/v2/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TURSO_TOKEN },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args: args || [] } }] })
  });
  const data = await res.json();
  try {
    const r = data.results[0].response.result;
    return { rows: (r.rows || []).map(row => row.map(c => c.value !== undefined ? c.value : c)) };
  } catch(e) { return { error: e.message }; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const body = req.body || {};
  const action = body.action;
  const username = body.username;
  const slot = body.slot;
  const state = body.state;
  const hash = body.hash;
  try {
    if (action === 'save') {
      await tursoExec('INSERT OR REPLACE INTO saves (username, slot, data, updated_at) VALUES (?, ?, ?, ?)', [username, slot, JSON.stringify(state), Date.now()]);
      return res.json({ ok: true });
    }
    if (action === 'load') {
      const r = await tursoExec('SELECT data FROM saves WHERE username=? AND slot=?', [username, slot]);
      const data = r.rows && r.rows[0] ? JSON.parse(r.rows[0][0]) : null;
      return res.json({ data });
    }
    if (action === 'list') {
      const r = await tursoExec('SELECT slot, updated_at FROM saves WHERE username=? ORDER BY slot', [username]);
      return res.json({ slots: r.rows || [] });
    }
    if (action === 'delete') {
      await tursoExec('DELETE FROM saves WHERE username=? AND slot=?', [username, slot]);
      return res.json({ ok: true });
    }
    if (action === 'register') {
      await tursoExec('INSERT OR IGNORE INTO users (username, password_hash, created_at) VALUES (?, ?, ?)', [username, hash, Date.now()]);
      return res.json({ ok: true });
    }
    if (action === 'login') {
      const r = await tursoExec('SELECT password_hash FROM users WHERE username=?', [username]);
      const ok = r.rows && r.rows[0] && r.rows[0][0] === hash;
      if (ok) await tursoExec('UPDATE users SET last_login=? WHERE username=?', [Date.now(), username]);
      return res.json({ ok });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch(e) { return res.status(500).json({ error: e.message }); }
};
