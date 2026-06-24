const express = require('express');
const { getDb } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const router = express.Router();

// GET /api/inventory — returns all products as inventory items
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`SELECT id, name, stock, created_at FROM products ORDER BY name`;
        res.json(rows.map(r => ({
            productId: String(r.id),
            productName: r.name,
            currentStock: Number(r.stock),
            lowStockThreshold: 5,
            lastRestocked: new Date(r.created_at).toISOString(),
            history: [],
        })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/inventory/stats/low-stock
router.get('/stats/low-stock', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`SELECT * FROM products WHERE stock <= 5 ORDER BY stock ASC`;
        res.json(rows.map(r => ({
            productId: String(r.id),
            productName: r.name,
            currentStock: Number(r.stock),
            lowStockThreshold: 5,
            lastRestocked: new Date(r.created_at).toISOString(),
            history: [],
        })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/inventory/stats/summary
router.get('/stats/summary', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`SELECT COUNT(*) as total, SUM(stock) as total_stock, COUNT(*) FILTER (WHERE stock <= 5) as low_stock FROM products`;
        res.json({ totalProducts: Number(rows[0].total), totalStock: Number(rows[0].total_stock), lowStockCount: Number(rows[0].low_stock) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/inventory/:productId
router.get('/:productId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`SELECT id, name, stock, created_at FROM products WHERE id = ${Number(req.params.productId)} LIMIT 1`;
        if (!rows.length) return res.status(404).json({ error: 'Product not found' });
        const r = rows[0];
        res.json({ productId: String(r.id), productName: r.name, currentStock: Number(r.stock), lowStockThreshold: 5, lastRestocked: new Date(r.created_at).toISOString(), history: [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/inventory/:productId/restock
router.post('/:productId/restock', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const { quantity } = req.body;
        if (!quantity || quantity <= 0) return res.status(400).json({ error: 'quantity must be positive' });
        await sql`UPDATE products SET stock = stock + ${quantity} WHERE id = ${Number(req.params.productId)}`;
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
