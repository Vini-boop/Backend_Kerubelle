const express = require('express');
const { getDb } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const router = express.Router();

function mapExpense(r) {
    return { id: r.id, name: r.name, category: r.category, amount: Number(r.amount), date: new Date(r.date).toISOString() };
}

router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`SELECT * FROM expenses ORDER BY date DESC`;
        res.json(rows.map(mapExpense));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`SELECT * FROM expenses WHERE id = ${req.params.id} LIMIT 1`;
        if (!rows.length) return res.status(404).json({ error: 'Expense not found' });
        res.json(mapExpense(rows[0]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const { name, category, amount, date } = req.body;
        const id = `EXP-${Date.now()}`;
        const rows = await sql`
            INSERT INTO expenses (id, name, category, amount, date)
            VALUES (${id}, ${name}, ${category}, ${amount}, ${date ?? new Date().toISOString()})
            RETURNING *
        `;
        res.status(201).json(mapExpense(rows[0]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const { name, category, amount, date } = req.body;
        const rows = await sql`
            UPDATE expenses SET
                name = COALESCE(${name ?? null}, name),
                category = COALESCE(${category ?? null}, category),
                amount = COALESCE(${amount ?? null}, amount),
                date = COALESCE(${date ?? null}, date)
            WHERE id = ${req.params.id} RETURNING *
        `;
        if (!rows.length) return res.status(404).json({ error: 'Expense not found' });
        res.json(mapExpense(rows[0]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        await sql`DELETE FROM expenses WHERE id = ${req.params.id}`;
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
