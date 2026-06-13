// Turso cloud save client - uses CORS proxy
const PROXY='/api/turso';
let useProxy=true;

async function proxyCall(sql,args){
if(!useProxy)return directCall(sql,args);
try{
const r=await fetch(PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sql,args:args||[]})});
const d=await r.json();
if(d&&d.rows!==undefined)return d;
if(d&&d.error){useProxy=false;return directCall(sql,args);}
return d;
}catch(e){useProxy=false;return directCall(sql,args);}
}

// Direct Turso call (fallback - may have CORS issues)
function cfg(){return(window.__TURSO_CONFIG||{});}
async function directCall(sql,args){
const c=cfg();
if(!c.url||!c.token)return{error:'not configured'};
const res=await fetch(c.url.replace('libsql://','https://')+'/v2/pipeline',{
method:'POST',
headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.token},
body:JSON.stringify({requests:[{type:'execute',stmt:{sql,args:args||[]}}]})
});
const data=await res.json();
const r=data.results[0].response.result;
return{rows:(r.rows||[]).map(row=>row.map(c=>c.value!==undefined?c.value:c))};
}

export async function tursoSave(username,slot,state){
return proxyCall('INSERT OR REPLACE INTO saves (username,slot,data,updated_at) VALUES (?,?,?,?)',[username,slot,JSON.stringify(state),Date.now()]);
}
export async function tursoLoad(username,slot){
const r=await proxyCall('SELECT data FROM saves WHERE username=? AND slot=?',[username,slot]);
if(r.rows&&r.rows[0])try{return JSON.parse(r.rows[0][0]);}catch(e){}
return null;
}
export async function tursoListSlots(username){
const r=await proxyCall('SELECT slot,updated_at FROM saves WHERE username=? ORDER BY slot',[username]);
return r.rows||[];
}
export async function tursoDelete(username,slot){
return proxyCall('DELETE FROM saves WHERE username=? AND slot=?',[username,slot]);
}
export async function tursoRegister(username,hash){
return proxyCall('INSERT OR IGNORE INTO users (username,password_hash,created_at) VALUES (?,?,?)',[username,hash,Date.now()]);
}
export async function tursoLogin(username,hash){
const r=await proxyCall('SELECT password_hash FROM users WHERE username=?',[username]);
const ok=r.rows&&r.rows[0]&&r.rows[0][0]===hash;
if(ok)await proxyCall('UPDATE users SET last_login=? WHERE username=?',[Date.now(),username]);
return ok;
}
export async function tursoInit(){
try{
await proxyCall('CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY,password_hash TEXT NOT NULL,created_at INTEGER,last_login INTEGER)',[]);
await proxyCall('CREATE TABLE IF NOT EXISTS saves (username TEXT NOT NULL,slot INTEGER NOT NULL,data TEXT NOT NULL,updated_at INTEGER,PRIMARY KEY(username,slot))',[]);
}catch(e){}
return true;
}
