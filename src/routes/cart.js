const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

// GET /api/cart/:userId
router.get('/:userId', async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`
            SELECT ci.quantity, p.id, p.name, p.price, p.image_url
            FROM cart_items ci
            JOIN products p ON p.id = ci.product_id
            WHERE ci.user_id = ${Number(req.params.userId)}
            ORDER BY ci.added_at
        `;
        res.json(rows.map(r => ({
            id: String(r.id),
            name: r.name,
            price: Number(r.price),
            image: r.image_url ?? '',
            quantity: Number(r.quantity),
        })));
    } catch (err) {
        console.error('GET /cart/:userId error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/cart/:userId/item — upsert item
router.put('/:userId/item', async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        if (!productId || quantity == null) return res.status(400).json({ error: 'productId and quantity are required' });

        const sql = getDb();
        await sql`
            INSERT INTO cart_items (user_id, product_id, quantity)
            VALUES (${Number(req.params.userId)}, ${Number(productId)}, ${quantity})
            ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = ${quantity}
        `;
        res.json({ ok: true });
    } catch (err) {
        console.error('PUT /cart/:userId/item error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/cart/:userId/item/:productId
router.delete('/:userId/item/:productId', async (req, res) => {
    try {
        const sql = getDb();
        await sql`
            DELETE FROM cart_items
            WHERE user_id = ${Number(req.params.userId)}
              AND product_id = ${Number(req.params.productId)}
        `;
        res.json({ ok: true });
    } catch (err) {
        console.error('DELETE /cart/:userId/item/:productId error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/cart/:userId — clear entire cart
router.delete('/:userId', async (req, res) => {
    try {
        const sql = getDb();
        await sql`DELETE FROM cart_items WHERE user_id = ${Number(req.params.userId)}`;
        res.json({ ok: true });
    } catch (err) {
        console.error('DELETE /cart/:userId error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
