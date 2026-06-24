require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { bootstrapDatabase } = require('./bootstrap');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: [
        'http://localhost:8081',   // Expo web
        'http://localhost:19006',  // Expo web (legacy)
        'http://localhost:5173',   // Vite web app
        'http://localhost:3000',   // Web app alt port
        /^http:\/\/10\./,          // Local network (Expo Go on phone)
        /^http:\/\/192\.168\./,    // Local network alt range
        /^http:\/\/172\./,         // Docker/VPN networks
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── Mobile app routes ──────────────────────────────────────────
app.use('/api/products', require('./routes/products'));
app.use('/api/users', require('./routes/users'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));

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

// Start
bootstrapDatabase()
    .then(() => {
        startServer();
    })
    .catch(err => {
        console.error('❌ Failed to bootstrap database:', err.message);
        if (err.message?.includes('402') || err.message?.includes('quota') || err.message?.includes('exceeded')) {
            console.warn('⚠️  Neon data transfer quota exceeded. Server starting anyway — DB calls may fail until quota resets or plan is upgraded.');
            console.warn('   → Go to https://console.neon.tech to upgrade or wait for monthly reset.');
            startServer();
        } else {
            console.error('Fatal DB error — cannot start server.');
            process.exit(1);
        }
    });

function startServer() {
    const server = app.listen(PORT, () => {
        console.log(`🚀 Kerubelle API running on http://localhost:${PORT}`);
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
