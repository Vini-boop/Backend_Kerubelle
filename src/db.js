const { neon, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

// Required for Node.js environment — neon serverless uses WebSocket for connections
neonConfig.webSocketConstructor = ws;
neonConfig.fetchConnectionCache = true;
neonConfig.pipelineTLS = false;
neonConfig.pipelineConnect = false;

let _sql = null;

function getDb() {
    if (!_sql) {
        const url = process.env.NEON_URL || process.env.DATABASE_URL;
        if (!url) throw new Error('DATABASE_URL or NEON_URL is not set');
        _sql = neon(url);
    }
    return _sql;
}

module.exports = { getDb };
