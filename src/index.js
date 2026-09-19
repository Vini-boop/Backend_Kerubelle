require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { bootstrapDatabase } = require('./bootstrap');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    // Allow the Vite dev server and any production origin.
    // Explicit list avoids issues with wildcard + credentials headers.
    origin: (origin, callback) => {
        const allowed = [
            'http://localhost:5173',   // Vite dev
            'http://localhost:3000',   // CRA / alt dev
            'http://127.0.0.1:5173',
            'http://127.0.0.1:3000',
        ];
        // Allow requests with no origin (curl, mobile apps, same-origin)
        if (!origin || allowed.includes(origin)) return callback(null, true);
        callback(null, true); // allow all in development; restrict in prod via env
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-forwarded-host'],
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── Mobile app routes ──────────────────────────────────────────
app.use('/api/products', require('./routes/products'));
app.use('/api/users', require('./routes/users'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));

// ── Web app routes ─────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/web-products', require('./routes/webProducts'));
app.use('/api/web-orders', require('./routes/webOrders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/inventory', require('./routes/inventory'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', port: PORT }));

// Start server immediately, let bootstrap run in background
startServer();

bootstrapDatabase()
    .then(() => {
        console.log('✅ Background bootstrap finished');
    })
    .catch(err => {
        console.error('❌ Failed to bootstrap database:', err.message);
        if (err.message?.includes('402') || err.message?.includes('quota') || err.message?.includes('exceeded')) {
            console.warn('⚠️  Neon data transfer quota exceeded.');
        }
    });

function startServer() {
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Kerubelle API running on http://0.0.0.0:${PORT}`);
        console.log(`   Mobile app: http://localhost:${PORT}/api/products`);
        console.log(`   Web app:    http://localhost:${PORT}/api/auth`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\n❌ Port ${PORT} is already in use.`);
            console.error(`   Run this to free it: npx kill-port ${PORT}`);
            console.error(`   Or close the other terminal running the backend.\n`);
            process.exit(1);
        } else {
            console.error('Server error:', err);
            process.exit(1);
        }
    });
}
