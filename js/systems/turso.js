// Turso cloud save client - direct API calls (Turso supports CORS)
function cfg() { return (window.__TURSO_CONFIG || {}); }

async function tursoExec(sql, args) {
  const c = cfg();
  if (!c.url || !c.token) return { error: 'not configured' };
  const res = await fetch(c.url.replace('libsql://', 'https://') + '/v2/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.token },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args: args || [] } }] })
  });
  if (!res.ok) return { error: 'HTTP ' + res.status };
  const data = await res.json();
  try {
    const r = data.results[0].response.result;
    return { rows: (r.rows || []).map(row => row.map(c => c.value !== undefined ? c.value : c)) };
  } catch(e) { return { error: e.message }; }
}

export async function tursoSave(username, slot, state) {
  return tursoExec('INSERT OR REPLACE INTO saves (username, slot, data, updated_at) VALUES (?, ?, ?, ?)', [username, slot, JSON.stringify(state), Date.now()]);
}
export async function tursoLoad(username, slot) {
  const r = (await tursoExec('SELECT data FROM saves WHERE username=? AND slot=?', [username, slot])).rows;
  if (r && r[0]) try { return JSON.parse(r[0][0]); } catch(e) {}
  return null;
}
export async function tursoListSlots(username) {
  return (await tursoExec('SELECT slot, updated_at FROM saves WHERE username=? ORDER BY slot', [username])).rows || [];
}
export async function tursoDelete(username, slot) {
  return tursoExec('DELETE FROM saves WHERE username=? AND slot=?', [username, slot]);
}
export async function tursoRegister(username, hash) {
  return tursoExec('INSERT OR IGNORE INTO users (username, password_hash, created_at) VALUES (?, ?, ?)', [username, hash, Date.now()]);
}
export async function tursoLogin(username, hash) {
  const r = (await tursoExec('SELECT password_hash FROM users WHERE username=?', [username])).rows;
  const ok = r && r[0] && r[0][0] === hash;
  if (ok) await tursoExec('UPDATE users SET last_login=? WHERE username=?', [Date.now(), username]);
  return ok;
}
export async function tursoInit() { return true; }
