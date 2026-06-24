const express = require('express');
const { getDb } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const router = express.Router();

function mapPayment(r) {
    return {
        id: r.id,
        orderId: r.order_id,
        customer: r.customer,
        method: r.method,
        transactionCode: r.transaction_code,
        amount: Number(r.amount),
        status: r.status,
        date: new Date(r.date).toISOString(),
    };
}

router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`SELECT * FROM payments ORDER BY date DESC`;
        res.json(rows.map(mapPayment));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`SELECT * FROM payments WHERE id = ${req.params.id} LIMIT 1`;
        if (!rows.length) return res.status(404).json({ error: 'Payment not found' });
        res.json(mapPayment(rows[0]));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const { orderId, customerName, method, transactionCode, amount } = req.body;
        const id = `PAY-${Date.now()}`;
        const rows = await sql`
            INSERT INTO payments (id, order_id, customer, method, transaction_code, amount, status)
            VALUES (${id}, ${orderId}, ${customerName}, ${method ?? 'M-Pesa'}, ${transactionCode}, ${amount}, 'Paid')
            RETURNING *
        `;
        await sql`UPDATE orders SET payment_status = 'Paid', transaction_code = ${transactionCode} WHERE id = ${orderId}`;
        res.status(201).json(mapPayment(rows[0]));
    } catch (err) {
        console.error('POST /payments error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const { status } = req.body;
        await sql`UPDATE payments SET status = ${status} WHERE id = ${req.params.id}`;
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
