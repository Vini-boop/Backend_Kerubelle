const express = require('express');
const { getDb } = require('../db');
const crypto = require('crypto');
const router = express.Router();

function sha256(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

function mapUser(r) {
    return {
        id: Number(r.id),
        googleId: r.google_id ?? null,
        fullName: r.full_name,
        email: r.email,
        profilePicture: r.profile_picture ?? null,
    };
}

// POST /api/users/google — upsert Google OAuth user
router.post('/google', async (req, res) => {
    try {
        const { googleId, fullName, email, profilePicture } = req.body;
        if (!googleId || !email) return res.status(400).json({ error: 'googleId and email are required' });

        const sql = getDb();
        const rows = await sql`
            INSERT INTO users (google_id, full_name, email, profile_picture)
            VALUES (${googleId}, ${fullName}, ${email}, ${profilePicture ?? null})
            ON CONFLICT (google_id) DO UPDATE SET
                full_name       = EXCLUDED.full_name,
                profile_picture = EXCLUDED.profile_picture,
                updated_at      = NOW()
            RETURNING id, google_id, full_name, email, profile_picture
        `;
        if (!rows.length) return res.status(500).json({ error: 'No rows returned' });
        res.json(mapUser(rows[0]));
    } catch (err) {
        console.error('POST /users/google error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/users/register — email/password registration
router.post('/register', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) return res.status(400).json({ error: 'fullName, email, and password are required' });

        const sql = getDb();
        const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
        if (existing.length) return res.status(409).json({ error: 'An account with this email already exists.' });

        const hash = sha256(password);
        const rows = await sql`
            INSERT INTO users (full_name, email, password_hash)
            VALUES (${fullName}, ${email}, ${hash})
            RETURNING id, google_id, full_name, email, profile_picture
        `;
        if (!rows.length) return res.status(500).json({ error: 'No rows returned' });
        res.status(201).json(mapUser(rows[0]));
    } catch (err) {
        console.error('POST /users/register error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/users/login — email/password sign in
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

        const sql = getDb();
        const hash = sha256(password);
        const rows = await sql`
            SELECT id, google_id, full_name, email, profile_picture
            FROM users
            WHERE email = ${email} AND password_hash = ${hash}
            LIMIT 1
        `;
        if (!rows.length) return res.status(401).json({ error: 'Incorrect email or password.' });
        res.json(mapUser(rows[0]));
    } catch (err) {
        console.error('POST /users/login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/users/:id/stats
router.get('/:id/stats', async (req, res) => {
    try {
        const sql = getDb();
        const userId = Number(req.params.id);
        const [orderCount, wishlistCount] = await Promise.all([
            sql`SELECT COUNT(*) as n FROM orders WHERE user_id = ${userId}`,
            sql`SELECT COUNT(*) as n FROM wishlist WHERE user_id = ${userId}`,
        ]);
        res.json({ orders: Number(orderCount[0].n), wishlist: Number(wishlistCount[0].n) });
    } catch (err) {
        console.error('GET /users/:id/stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
