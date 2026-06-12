const fs = require('fs');
const url = process.env['TURSO_DB_URL'] || '';
const token = process.env['TURSO_TOKEN'] || '';
const content = 'window.__TURSO_CONFIG={url:' + JSON.stringify(url) + ',token:' + JSON.stringify(token) + '};';
fs.writeFileSync('config.js', content);
console.log('[build] config.js generated');
