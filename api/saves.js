const { tursoExec } = require('./db.cjs');

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed' })); return; }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { action, username, slot, state } = JSON.parse(body);
      if (!username) { res.statusCode = 400; res.end(JSON.stringify({ error: 'missing username' })); return; }

      if (action === 'save') {
        const data = JSON.stringify(state);
        const r = await tursoExec('INSERT OR REPLACE INTO saves (username, slot, data, updated_at) VALUES (?,?,?,?)', [username, slot, data, Date.now()]);
        if (r.error) { res.statusCode = 500; res.end(JSON.stringify({ error: r.error })); return; }
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (action === 'load') {
        const r = await tursoExec('SELECT data FROM saves WHERE username = ? AND slot = ?', [username, slot]);
        if (r.error) { res.statusCode = 500; res.end(JSON.stringify({ error: r.error })); return; }
        if (r.rows && r.rows[0]) {
          try { res.end(JSON.stringify({ ok: true, state: JSON.parse(r.rows[0][0]) })); return; }
          catch (e) { res.end(JSON.stringify({ ok: false })); return; }
        }
        res.end(JSON.stringify({ ok: false }));
        return;
      }

      if (action === 'list') {
        const r = await tursoExec('SELECT slot, updated_at FROM saves WHERE username = ? ORDER BY slot', [username]);
        if (r.error) { res.statusCode = 500; res.end(JSON.stringify({ error: r.error })); return; }
        res.end(JSON.stringify({ ok: true, slots: r.rows || [] }));
        return;
      }

      if (action === 'delete') {
        const r = await tursoExec('DELETE FROM saves WHERE username = ? AND slot = ?', [username, slot]);
        if (r.error) { res.statusCode = 500; res.end(JSON.stringify({ error: r.error })); return; }
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.statusCode = 400; res.end(JSON.stringify({ error: 'unknown action' }));
    } catch (e) {
      res.statusCode = 500; res.end(JSON.stringify({ error: e.message }));
    }
  });
};
