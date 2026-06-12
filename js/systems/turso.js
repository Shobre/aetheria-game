// Turso cloud save client - uses Vercel serverless proxy
const API = '/api/turso';

async function call(action, body) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action }, body))
    });
    return await res.json();
  } catch(e) { return { error: e.message }; }
}

export async function tursoSave(username, slot, state) {
  return call('save', { username, slot, state });
}

export async function tursoLoad(username, slot) {
  const r = await call('load', { username, slot });
  return r.data || null;
}

export async function tursoListSlots(username) {
  const r = await call('list', { username });
  return r.slots || [];
}

export async function tursoDelete(username, slot) {
  return call('delete', { username, slot });
}

export async function tursoRegister(username, hash) {
  return call('register', { username, hash });
}

export async function tursoLogin(username, hash) {
  const r = await call('login', { username, hash });
  return r.ok || false;
}

export async function tursoInit() { return true; }
