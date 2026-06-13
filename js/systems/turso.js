// Turso cloud save client - calls server-side API proxy
const PROXY='/api/turso';

async function proxyCall(sql, args) {
  const r = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, args: args || [] })
  });
  return r.json();
}

export async function tursoSave(username, slot, state) {
  return proxyCall('INSERT OR REPLACE INTO saves (username, slot, data, updated_at) VALUES (?, ?, ?, ?)', [username, slot, JSON.stringify(state), Date.now()]);
}
export async function tursoLoad(username, slot) {
  const r = await proxyCall('SELECT data FROM saves WHERE username=? AND slot=?', [username, slot]);
  if (r.rows && r.rows[0]) try { return JSON.parse(r.rows[0][0]); } catch(e) {}
  return null;
}
export async function tursoListSlots(username) {
  const r = await proxyCall('SELECT slot, updated_at FROM saves WHERE username=? ORDER BY slot', [username]);
  return r.rows || [];
}
export async function tursoDelete(username, slot) {
  return proxyCall('DELETE FROM saves WHERE username=? AND slot=?', [username, slot]);
}
export async function tursoRegister(username, hash) {
  return proxyCall('INSERT OR IGNORE INTO users (username, password_hash, created_at) VALUES (?, ?, ?)', [username, hash, Date.now()]);
}
export async function tursoLogin(username, hash) {
  const r = await proxyCall('SELECT password_hash FROM users WHERE username=?', [username]);
  const ok = r.rows && r.rows[0] && r.rows[0][0] === hash;
  if (ok) await proxyCall('UPDATE users SET last_login=? WHERE username=?', [Date.now(), username]);
  return ok;
}
export async function tursoInit() {
  try {
    await proxyCall('CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, created_at INTEGER, last_login INTEGER)', []);
    await proxyCall('CREATE TABLE IF NOT EXISTS saves (username TEXT NOT NULL, slot INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER, PRIMARY KEY (username, slot))', []);
  } catch(e) {}
  return true;
}
