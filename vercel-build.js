const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

const tursoUrl = process.env.TURSO_DB_URL || '';
const tursoToken = process.env.TURSO_TOKEN || '';

// Replace meta tag content values
html = html.replace(
  /<meta name="turso-url" content="[^"]*"/,
  '<meta name="turso-url" content="' + tursoUrl.replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '"'
);
html = html.replace(
  /<meta name="turso-token" content="[^"]*"/,
  '<meta name="turso-token" content="' + tursoToken.replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '"'
);

// Also update vercel-build.js's own reference (it's index.html only)
fs.writeFileSync(htmlPath, html);
console.log('[build] Injected Turso config into index.html');
