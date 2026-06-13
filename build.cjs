const fs=require('fs');
const url=process.env['TURSO_DB_URL']||'';
const token=process.env['TURSO_TOKEN']||'';
const out='window.__TURSO_CONFIG={url:'+JSON.stringify(url)+',token:'+JSON.stringify(token)+'};';
fs.writeFileSync('config.js',out);
console.log('[build] config.js generated, url len:',url.length,'token len:',token.length);
