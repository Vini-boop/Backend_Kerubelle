const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

// POST /api/orders — create order from mobile cart
router.post('/', async (req, res) => {
    try {
        const { userId, cartItems } = req.body;
        if (!userId || !cartItems?.length) return res.status(400).json({ error: 'userId and cartItems are required' });

        const sql = getDb();
        const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
        const shipping = 500;
        const total = subtotal + shipping;

        // Get user info for customer fields
        const userRows = await sql`SELECT full_name, email FROM users WHERE id = ${userId} LIMIT 1`;
        const userName = userRows[0]?.full_name ?? '';
        const userEmail = userRows[0]?.email ?? '';

        const orderId = `ORD-${Date.now()}`;
        const statusHistory = [{ status: 'Processing', date: new Date().toISOString() }];

        await sql`
            INSERT INTO orders (id, user_id, customer_name, customer_email, status, subtotal, delivery, total, status_history)
            VALUES (${orderId}, ${userId}, ${userName}, ${userEmail}, 'pending', ${subtotal}, ${shipping}, ${total}, ${JSON.stringify(statusHistory)})
        `;

        for (const item of cartItems) {
            await sql`
                INSERT INTO order_items (order_id, product_id, product_name, name, price, unit_price, quantity, image_url)
                VALUES (${orderId}, ${Number(item.id)}, ${item.name}, ${item.name}, ${item.price}, ${item.price}, ${item.quantity}, ${item.image})
            `;
        }

        res.status(201).json({
            id: orderId,
            status: 'pending',
            subtotal: Number(subtotal),
            shipping: Number(shipping),
            total: Number(total),
            createdAt: new Date().toISOString(),
            items: cartItems.map((i, idx) => ({
                id: idx,
                productId: i.id,
                name: i.name,
                price: i.price,
                quantity: i.quantity,
                image: i.image,
            })),
        });
    } catch (err) {
        console.error('POST /orders error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/orders/:userId
router.get('/:userId', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const sql = getDb();
        const l = Number(limit);
        const o = Number(offset);

        const orders = await sql`
            SELECT id, status, subtotal, delivery, shipping, total, created_at 
            FROM orders WHERE user_id = ${Number(req.params.userId)}
            ORDER BY created_at DESC
            LIMIT ${l} OFFSET ${o}
        `;

        const result = [];
        for (const o of orders) {
            const items = await sql`SELECT id, product_id, product_name, name, unit_price, price, quantity, image_url FROM order_items WHERE order_id = ${o.id}`;
            result.push({
                id: o.id,
                status: o.status,
                subtotal: Number(o.subtotal),
                shipping: Number(o.delivery ?? o.shipping ?? 0),
                total: Number(o.total),
                createdAt: o.created_at,
                items: items.map(i => ({
                    id: Number(i.id),
                    productId: String(i.product_id),
                    name: i.product_name || i.name || '',
                    price: Number(i.unit_price ?? i.price ?? 0),
                    quantity: Number(i.quantity),
                    image: i.image_url ?? '',
                })),
            });
        }
        res.json(result);
    } catch (err) {
        console.error('GET /orders/:userId error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
