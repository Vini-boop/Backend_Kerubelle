const express = require('express');
const { getDb } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const router = express.Router();

function mapOrder(order, items) {
    return {
        id: order.id,
        date: new Date(order.date || order.created_at).toISOString(),
        items: items.map(i => ({
            productId: String(i.product_id),
            productName: i.product_name || i.name || '',
            quantity: Number(i.quantity),
            unitPrice: Number(i.unit_price ?? i.price ?? 0),
            costPrice: Number(i.cost_price ?? 0),
            color: i.color ?? '',
            size: i.size ?? 'Medium',
        })),
        subtotal: Number(order.subtotal),
        discount: Number(order.discount ?? 0),
        delivery: Number(order.delivery ?? order.shipping ?? 0),
        total: Number(order.total),
        status: order.status ?? 'Processing',
        paymentStatus: order.payment_status ?? 'Pending',
        paymentMethod: order.payment_method ?? 'M-Pesa',
        transactionCode: order.transaction_code ?? null,
        address: order.address || '',
        customerName: order.customer_name || '',
        customerEmail: order.customer_email || '',
        customerPhone: order.customer_phone ?? null,
        statusHistory: order.status_history ?? [],
    };
}

// GET /api/web-orders
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const sql = getDb();
        const l = Number(limit);
        const o = Number(offset);

        const orders = await sql`
            SELECT id, date, created_at, subtotal, discount, delivery, shipping, total, status, payment_status, payment_method, transaction_code, address, customer_name, customer_email, customer_phone, status_history 
            FROM orders 
            ORDER BY created_at DESC
            LIMIT ${l} OFFSET ${o}
        `;
        const result = [];
        for (const o of orders) {
            const items = await sql`
                SELECT product_id, product_name, name, quantity, unit_price, price, cost_price, color, size 
                FROM order_items WHERE order_id = ${o.id}
            `;
            result.push(mapOrder(o, items));
        }
        res.json(result);
    } catch (err) {
        console.error('GET /web-orders error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/web-orders/:id
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const orders = await sql`
            SELECT id, date, created_at, subtotal, discount, delivery, shipping, total, status, payment_status, payment_method, transaction_code, address, customer_name, customer_email, customer_phone, status_history 
            FROM orders WHERE id = ${req.params.id} LIMIT 1
        `;
        if (!orders.length) return res.status(404).json({ error: 'Order not found' });
        const items = await sql`
            SELECT product_id, product_name, name, quantity, unit_price, price, cost_price, color, size 
            FROM order_items WHERE order_id = ${req.params.id}
        `;
        res.json(mapOrder(orders[0], items));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/web-orders
router.post('/', authMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const { customerName, customerEmail, customerPhone, address, items, subtotal, discount, delivery, total, paymentMethod, discountCode } = req.body;

        const orderId = `ORD-${Date.now()}`;
        const statusHistory = [{ status: 'Processing', date: new Date().toISOString() }];

        await sql`
            INSERT INTO orders (id, customer_name, customer_email, customer_phone, address, subtotal, discount, delivery, total, payment_method, discount_code, status_history)
            VALUES (${orderId}, ${customerName}, ${customerEmail}, ${customerPhone ?? null}, ${address}, ${subtotal}, ${discount ?? 0}, ${delivery ?? 0}, ${total}, ${paymentMethod ?? 'M-Pesa'}, ${discountCode ?? null}, ${JSON.stringify(statusHistory)})
        `;

        for (const item of items) {
            await sql`
                INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, cost_price, color, size)
                VALUES (${orderId}, ${item.productId}, ${item.productName}, ${item.quantity}, ${item.unitPrice}, ${item.costPrice ?? 0}, ${item.color ?? ''}, ${item.size ?? 'Medium'})
            `;
            await sql`UPDATE products SET stock = GREATEST(stock - ${item.quantity}, 0), sales_count = sales_count + ${item.quantity} WHERE id = ${Number(item.productId)}`;
        }

        // Upsert customer record
        await sql`
            INSERT INTO customers (id, name, email, phone, total_orders, total_spent, join_date, last_order)
            VALUES (${`C-${Date.now()}`}, ${customerName}, ${customerEmail}, ${customerPhone ?? ''}, 1, ${total}, NOW(), NOW())
            ON CONFLICT (email) DO UPDATE SET
                total_orders = customers.total_orders + 1,
                total_spent = customers.total_spent + ${total},
                last_order = NOW()
        `;

        const orders = await sql`
            SELECT id, date, created_at, subtotal, discount, delivery, shipping, total, status, payment_status, payment_method, transaction_code, address, customer_name, customer_email, customer_phone, status_history 
            FROM orders WHERE id = ${orderId} LIMIT 1
        `;
        const orderItems = await sql`
            SELECT product_id, product_name, name, quantity, unit_price, price, cost_price, color, size 
            FROM order_items WHERE order_id = ${orderId}
        `;
        res.status(201).json(mapOrder(orders[0], orderItems));
    } catch (err) {
        console.error('POST /web-orders error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/web-orders/:id/status
router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const { status } = req.body;
        const orders = await sql`SELECT status_history FROM orders WHERE id = ${req.params.id} LIMIT 1`;
        if (!orders.length) return res.status(404).json({ error: 'Order not found' });

        const history = [...(orders[0].status_history ?? []), { status, date: new Date().toISOString() }];
        await sql`UPDATE orders SET status = ${status}, status_history = ${JSON.stringify(history)} WHERE id = ${req.params.id}`;
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/web-orders/:id/payment-status
router.put('/:id/payment-status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const { paymentStatus, transactionCode } = req.body;
        await sql`UPDATE orders SET payment_status = ${paymentStatus}, transaction_code = ${transactionCode ?? null} WHERE id = ${req.params.id}`;
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
