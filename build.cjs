const fs=require('fs');
console.log('[build] API proxy mode - DB credentials stay server-side');
console.log('[build] TURSO_DB_URL set:', !!process.env['TURSO_DB_URL']);
