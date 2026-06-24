const { getDb } = require('./src/db'); require('dotenv').config(); const sql = getDb(); sql\SELECT 1\.then(() => console.log('DB works')).catch(console.error);
