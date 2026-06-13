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
      const { action, username, hash } = JSON.parse(body);
      if (!username || !hash) { res.statusCode = 400; res.end(JSON.stringify({ error: 'missing fields' })); return; }

      if (action === 'register') {
        const r = await tursoExec('INSERT OR IGNORE INTO users (username, password_hash, created_at) VALUES (?,?,?)', [username, hash, Date.now()]);
        if (r.error) { res.statusCode = 500; res.end(JSON.stringify({ error: r.error })); return; }
        const check = await tursoExec('SELECT password_hash FROM users WHERE username = ?', [username]);
        const exists = check.rows && check.rows[0];
        res.end(JSON.stringify({ ok: true, created: !exists || exists[0] === hash }));
        return;
      }

      if (action === 'login') {
        const r = await tursoExec('SELECT password_hash FROM users WHERE username = ?', [username]);
        if (r.error) { res.statusCode = 500; res.end(JSON.stringify({ error: r.error })); return; }
        const ok = r.rows && r.rows[0] && r.rows[0][0] === hash;
        if (ok) await tursoExec('UPDATE users SET last_login = ? WHERE username = ?', [Date.now(), username]);
        res.end(JSON.stringify({ ok }));
        return;
      }

      res.statusCode = 400; res.end(JSON.stringify({ error: 'unknown action' }));
    } catch (e) {
      res.statusCode = 500; res.end(JSON.stringify({ error: e.message }));
    }
  });
};
