// Turso database client for cloud saves
const _metaUrl = document.querySelector('meta[name="turso-url"]');
const _metaToken = document.querySelector('meta[name="turso-token"]');
const _tursoUrl = _metaUrl ? _metaUrl.content : '';
const _tursoToken = _metaToken ? _metaToken.content : '';

async function _tursoExec(sql, args) {
  args = args || [];
  if (!_tursoUrl || !_tursoToken) return { error: 'Turso not configured' };
  try {
    const res = await fetch(_tursoUrl.replace('libsql://', 'https://') + '/v2/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _tursoToken },
      body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql: sql, args: args } }] })
    });
    const json = await res.json();
    return json;
  } catch(e) { return { error: e.message }; }
}

// Extract rows from Turso v2 response
function _rows(res) {
  try {
    const r = res.results[0].response.result;
    if (!r || !r.rows) return [];
    return r.rows.map(row => row.map(cell => cell.value !== undefined ? cell.value : cell));
  } catch(e) { return []; }
}

export async function tursoSave(username, slot, state) {
  return _tursoExec(
    'INSERT OR REPLACE INTO saves (username, slot, data, updated_at) VALUES (?, ?, ?, ?)',
    [username, slot, JSON.stringify(state), Date.now()]
  );
}

export async function tursoLoad(username, slot) {
  const res = await _tursoExec('SELECT data FROM saves WHERE username=? AND slot=?', [username, slot]);
  const rows = _rows(res);
  if (rows.length > 0 && rows[0][0]) {
    try { return JSON.parse(rows[0][0]); } catch(e) { return null; }
  }
  return null;
}

export async function tursoListSlots(username) {
  const res = await _tursoExec('SELECT slot, updated_at FROM saves WHERE username=? ORDER BY slot', [username]);
  return _rows(res);
}

export async function tursoInit() {
  await _tursoExec('CREATE TABLE IF NOT EXISTS saves (username TEXT NOT NULL, slot INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (username, slot))');
  await _tursoExec('CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL, last_login INTEGER)');
  return true;
}

export async function tursoDelete(username, slot) {
  return _tursoExec('DELETE FROM saves WHERE username=? AND slot=?', [username, slot]);
}

export async function tursoRegister(username, passwordHash) {
  return _tursoExec(
    'INSERT OR IGNORE INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
    [username, passwordHash, Date.now()]
  );
}

export async function tursoLogin(username) {
  const res = await _tursoExec('SELECT username FROM users WHERE username=?', [username]);
  const rows = _rows(res);
  if (rows.length > 0) {
    await _tursoExec('UPDATE users SET last_login=? WHERE username=?', [Date.now(), username]);
    return true;
  }
  return false;
}

export async function tursoCheckPassword(username, passwordHash) {
  const res = await _tursoExec('SELECT password_hash FROM users WHERE username=?', [username]);
  const rows = _rows(res);
  if (rows.length > 0 && rows[0][0] === passwordHash) {
    await _tursoExec('UPDATE users SET last_login=? WHERE username=?', [Date.now(), username]);
    return true;
  }
  return false;
}
