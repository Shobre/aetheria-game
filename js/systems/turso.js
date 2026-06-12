// Turso database client for cloud saves
const _tursoUrl = document.querySelector('meta[name="turso-url"]')?.content || '';
const _tursoToken = document.querySelector('meta[name="turso-token"]')?.content || '';

async function _tursoExec(sql, args) {
  args = args || [];
  if (!_tursoUrl || !_tursoToken) return { error: 'not configured' };
  try {
    const res = await fetch(_tursoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _tursoToken },
      body: JSON.stringify({ statements: [{ q: sql, args: args }] })
    });
    return await res.json();
  } catch(e) { return { error: e.message }; }
}

export async function tursoSave(username, slot, state) {
  return _tursoExec(
    'INSERT OR REPLACE INTO saves (username, slot, data, updated_at) VALUES (?, ?, ?, ?)',
    [username, slot, JSON.stringify(state), Date.now()]
  );
}

export async function tursoLoad(username, slot) {
  const res = await _tursoExec('SELECT data FROM saves WHERE username=? AND slot=?', [username, slot]);
  if (res && res.results && res.results[0] && res.results[0].rows && res.results[0].rows[0] && res.results[0].rows[0][0]) {
    return JSON.parse(res.results[0].rows[0][0]);
  }
  return null;
}

export async function tursoListSlots(username) {
  const res = await _tursoExec('SELECT slot, updated_at FROM saves WHERE username=? ORDER BY slot', [username]);
  if (res && res.results && res.results[0]) return res.results[0].rows || [];
  return [];
}

export async function tursoInit() {
  return _tursoExec('CREATE TABLE IF NOT EXISTS saves (username TEXT NOT NULL, slot INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (username, slot))');
}

export async function tursoDelete(username, slot) {
  return _tursoExec('DELETE FROM saves WHERE username=? AND slot=?', [username, slot]);
}
