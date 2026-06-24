const express = require('express');
const { getDb } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const router = express.Router();

function mapCustomer(r) {
    return {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone ?? '',
        totalOrders: Number(r.total_orders ?? 0),
        totalSpent: Number(r.total_spent ?? 0),
        joinDate: new Date(r.join_date).toISOString(),
        lastOrder: r.last_order ? new Date(r.last_order).toISOString() : new Date(r.join_date).toISOString(),
    };
}

router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        // Return all registered customer-role users, enriched with CRM stats where available.
        // This ensures every sign-up appears immediately, even before they place an order.
        // Also includes users where role IS NULL (mobile registrations that predate the role column).
        const rows = await sql`
            SELECT
                u.id::text        AS id,
                u.full_name       AS name,
                u.email,
                COALESCE(u.phone, c.phone, '') AS phone,
                COALESCE(c.total_orders, 0)    AS total_orders,
                COALESCE(c.total_spent,  0)    AS total_spent,
                u.created_at                   AS join_date,
                c.last_order
            FROM users u
            LEFT JOIN customers c ON c.email = u.email
            WHERE u.role = 'customer' OR u.role IS NULL
            ORDER BY u.created_at DESC
        `;
        res.json(rows.map(mapCustomer));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/email/:email', authMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`SELECT * FROM customers WHERE email = ${req.params.email} LIMIT 1`;
        if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
        res.json(mapCustomer(rows[0]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`SELECT * FROM customers WHERE id = ${req.params.id} LIMIT 1`;
        if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
        res.json(mapCustomer(rows[0]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const { name, email, phone } = req.body;
        const id = `C-${Date.now()}`;
        const rows = await sql`
            INSERT INTO customers (id, name, email, phone)
            VALUES (${id}, ${name}, ${email}, ${phone ?? ''})
            ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone
            RETURNING *
        `;
        res.status(201).json(mapCustomer(rows[0]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const { name, phone } = req.body;
        const rows = await sql`
            UPDATE customers SET
                name = COALESCE(${name ?? null}, name),
                phone = COALESCE(${phone ?? null}, phone)
            WHERE id = ${req.params.id} RETURNING *
        `;
        if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
        res.json(mapCustomer(rows[0]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        await sql`DELETE FROM customers WHERE id = ${req.params.id}`;
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
