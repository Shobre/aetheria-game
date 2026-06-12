// Turso cloud save client
function getCfg() {
  return (window.__TURSO_CONFIG || {});
}

async function tursoExec(sql, args) {
  const cfg = getCfg();
  if (!cfg.url || !cfg.token) return { error: 'Turso not configured' };
  const res = await fetch(cfg.url.replace('libsql://', 'https://') + '/v2/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.token },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args: args || [] } }] })
  });
  const data = await res.json();
  try {
    const r = data.results[0].response.result;
    return { rows: (r.rows || []).map(row => row.map(c => c.value !== undefined ? c.value : c)) };
  } catch(e) { return { error: e.message }; }
}

function rows(res) { return res.rows || []; }

export async function tursoSave(username, slot, state) {
  return tursoExec('INSERT OR REPLACE INTO saves (username, slot, data, updated_at) VALUES (?, ?, ?, ?)', [username, slot, JSON.stringify(state), Date.now()]);
}
export async function tursoLoad(username, slot) {
  const r = rows(await tursoExec('SELECT data FROM saves WHERE username=? AND slot=?', [username, slot]));
  if (r[0]) try { return JSON.parse(r[0][0]); } catch(e) {}
  return null;
}
export async function tursoListSlots(username) {
  return rows(await tursoExec('SELECT slot, updated_at FROM saves WHERE username=? ORDER BY slot', [username]));
}
export async function tursoDelete(username, slot) {
  return tursoExec('DELETE FROM saves WHERE username=? AND slot=?', [username, slot]);
}
export async function tursoRegister(username, hash) {
  return tursoExec('INSERT OR IGNORE INTO users (username, password_hash, created_at) VALUES (?, ?, ?)', [username, hash, Date.now()]);
}
export async function tursoLogin(username, hash) {
  const r = rows(await tursoExec('SELECT password_hash FROM users WHERE username=?', [username]));
  const ok = r[0] && r[0][0] === hash;
  if (ok) await tursoExec('UPDATE users SET last_login=? WHERE username=?', [Date.now(), username]);
  return ok;
}
export async function tursoInit() { return true; }
