// Turso cloud save client - uses Vercel serverless proxy
const API = '/api/turso';
let _cloudAvailable = null;

async function call(action, body) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action }, body))
    });
    const data = await res.json();
    if (data.error) return { error: data.error };
    return data;
  } catch(e) { return { error: e.message }; }
}

async function checkCloud() {
  if (_cloudAvailable !== null) return _cloudAvailable;
  const r = await call('list', { username: '__ping__' });
  _cloudAvailable = !r.error || !r.error.includes('not configured');
  return _cloudAvailable;
}

export async function tursoSave(username, slot, state) {
  if (!await checkCloud()) return { localOnly: true };
  return call('save', { username, slot, state });
}

export async function tursoLoad(username, slot) {
  if (!await checkCloud()) return null;
  const r = await call('load', { username, slot });
  return r.data || null;
}

export async function tursoListSlots(username) {
  if (!await checkCloud()) return [];
  const r = await call('list', { username });
  return r.slots || [];
}

export async function tursoDelete(username, slot) {
  if (!await checkCloud()) return { localOnly: true };
  return call('delete', { username, slot });
}

export async function tursoRegister(username, hash) {
  return call('register', { username, hash });
}

export async function tursoLogin(username, hash) {
  const r = await call('login', { username, hash });
  return r.ok || false;
}

export async function tursoInit() {
  await checkCloud();
  return true;
}
