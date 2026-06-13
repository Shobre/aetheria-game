const {tursoExec}=require('./db.cjs');

module.exports=async function(req,res){
res.setHeader('Access-Control-Allow-Origin','*');
res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
res.setHeader('Access-Control-Allow-Headers','Content-Type');
if(req.method==='OPTIONS'){res.statusCode=204;res.end();return;}
if(req.method!=='POST'){res.statusCode=405;res.end('Method not allowed');return;}

try{
await tursoExec('CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY,password_hash TEXT NOT NULL,created_at INTEGER,last_login INTEGER)');
await tursoExec('CREATE TABLE IF NOT EXISTS saves (username TEXT NOT NULL,slot INTEGER NOT NULL,data TEXT NOT NULL,updated_at INTEGER,PRIMARY KEY(username,slot))');
res.end(JSON.stringify({ok:true}));
}catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}
};
