const fs = require('fs');
const path = require('path');
const tursoUrl = process.env['TURSO_DB_URL'] || '';
const tursoToken = process.env['TURSO_TOKEN'] || '';
const config = { url: tursoUrl, token: tursoToken };
const content = 'window.__TURSO_CONFIG=' + JSON.stringify(config) + ';';
fs.writeFileSync(path.join(__dirname, 'config.js'), content);
console.log('[build] Generated config.js');
