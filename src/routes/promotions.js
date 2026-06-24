const express = require('express');
const { getDb } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const router = express.Router();

function mapPromo(r) {
    return {
        id: r.id,
        code: r.code,
        description: r.description ?? '',
        discountPercent: Number(r.discount_percent),
        usageCount: Number(r.usage_count ?? 0),
        maxUsage: Number(r.max_usage ?? 100),
        startDate: new Date(r.start_date).toISOString(),
        endDate: new Date(r.end_date).toISOString(),
        active: r.active ?? true,
    };
}

router.get('/', async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`SELECT * FROM promotions ORDER BY created_at DESC`;
        res.json(rows.map(mapPromo));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/code/:code', async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`
            SELECT * FROM promotions
            WHERE code = ${req.params.code.toUpperCase()}
              AND active = TRUE
              AND NOW() BETWEEN start_date AND end_date
              AND usage_count < max_usage
            LIMIT 1
        `;
        if (!rows.length) return res.status(404).json({ error: 'Invalid or expired promo code' });
        res.json(mapPromo(rows[0]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`SELECT * FROM promotions WHERE id = ${req.params.id} LIMIT 1`;
        if (!rows.length) return res.status(404).json({ error: 'Promotion not found' });
        res.json(mapPromo(rows[0]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const { code, description, discountPercent, maxUsage, startDate, endDate, active } = req.body;
        const id = `PROMO-${Date.now()}`;
        const rows = await sql`
            INSERT INTO promotions (id, code, description, discount_percent, max_usage, start_date, end_date, active)
            VALUES (${id}, ${code.toUpperCase()}, ${description ?? ''}, ${discountPercent}, ${maxUsage ?? 100}, ${startDate}, ${endDate}, ${active ?? true})
            RETURNING *
        `;
        res.status(201).json(mapPromo(rows[0]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const p = req.body;
        const rows = await sql`
            UPDATE promotions SET
                code = COALESCE(${p.code ? p.code.toUpperCase() : null}, code),
                description = COALESCE(${p.description ?? null}, description),
                discount_percent = COALESCE(${p.discountPercent ?? null}, discount_percent),
                max_usage = COALESCE(${p.maxUsage ?? null}, max_usage),
                start_date = COALESCE(${p.startDate ?? null}, start_date),
                end_date = COALESCE(${p.endDate ?? null}, end_date),
                active = COALESCE(${p.active ?? null}, active)
            WHERE id = ${req.params.id} RETURNING *
        `;
        if (!rows.length) return res.status(404).json({ error: 'Promotion not found' });
        res.json(mapPromo(rows[0]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/toggle', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`UPDATE promotions SET active = NOT active WHERE id = ${req.params.id} RETURNING *`;
        if (!rows.length) return res.status(404).json({ error: 'Promotion not found' });
        res.json(mapPromo(rows[0]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        await sql`DELETE FROM promotions WHERE id = ${req.params.id}`;
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
