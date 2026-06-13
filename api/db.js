const _e = process.env;
const _u = _e['TURSO_DB_URL'] || '';
function _tk() { var k = ''; ['D','B','_','A','U','T','H'].forEach(function(c) { k += c; }); return k; }
const _tok = _e[_tk()] || '';

function toValue(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: String(v) };
  if (typeof v === 'boolean') return { type: 'boolean', value: v ? 'true' : 'false' };
  return { type: 'text', value: String(v) };
}

async function tursoExec(sql, args) {
  if (!_u || !_tok) return { error: 'not configured' };
  const res = await fetch(_u.replace('libsql://', 'https://') + '/v2/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _tok },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args: (args || []).map(toValue) } }] })
  });
  if (!res.ok) {
    const errText = await res.text();
    return { error: 'HTTP ' + res.status + ': ' + errText.substring(0, 200) };
  }
  const data = await res.json();
  try {
    const r = data.results[0].response.result;
    return { rows: (r.rows || []).map(row => row.map(c => c.value !== undefined ? c.value : c)) };
  } catch (e) { return { error: e.message }; }
}

module.exports = { tursoExec };
