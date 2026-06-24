const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { sendVerificationEmail, sendForgotPasswordEmail } = require('../email');
const router = express.Router();

// ── OTP helpers ────────────────────────────────────────────────
function generateOTP() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function createOTP(sql, email, type = 'verify', payload = null) {
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 min
    // Invalidate any existing unused codes for this email+type
    await sql`UPDATE otp_codes SET used = TRUE WHERE email = ${email} AND type = ${type} AND used = FALSE`;
    if (payload) {
        await sql`INSERT INTO otp_codes (email, code, type, expires_at, payload) VALUES (${email}, ${code}, ${type}, ${expiresAt}, ${JSON.stringify(payload)}::jsonb)`;
    } else {
        await sql`INSERT INTO otp_codes (email, code, type, expires_at) VALUES (${email}, ${code}, ${type}, ${expiresAt})`;
    }
    return code;
}

async function verifyOTP(sql, email, code, type = 'verify') {
    const rows = await sql`
        SELECT * FROM otp_codes
        WHERE email = ${email} AND code = ${code} AND type = ${type} AND used = FALSE
        ORDER BY created_at DESC LIMIT 1
    `;
    if (!rows.length) return { valid: false, error: 'Invalid code' };
    if (new Date(rows[0].expires_at) < new Date()) return { valid: false, error: 'Code expired', expired: true };
    await sql`UPDATE otp_codes SET used = TRUE WHERE id = ${rows[0].id}`;
    return { valid: true };
}

function makeToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function mapUser(r) {
    return {
        id: String(r.id),
        full_name: r.full_name,
        email: r.email,
        role: r.role ?? 'customer',
        phone: r.phone ?? null,
        is_active: r.is_active ?? true,
        email_verified: r.email_verified ?? false,
        created_at: r.created_at ?? null,
    };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { fullName, email, password, phone } = req.body;
        if (!fullName || !email || !password)
            return res.status(400).json({ error: 'fullName, email, and password are required' });

        const sql = getDb();
        const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
        if (existing.length) return res.status(409).json({ error: 'An account with this email already exists.' });

        const hash = await bcrypt.hash(password, 10);
        
        // Instead of inserting into users immediately, we store the payload in the otp_codes table
        const payload = { fullName, email, password_hash: hash, phone };

        let otp;
        try {
            otp = await createOTP(sql, email, 'verify', payload);
        } catch (dbErr) {
            require('fs').writeFileSync('backend_error.log', 'DB ERR: ' + dbErr.stack);
            console.error('Database error creating OTP:', dbErr);
            return res.status(500).json({ error: 'Database connection failed. Please try again later.' });
        }

        try {
            await sendVerificationEmail(email, fullName, otp);
        } catch (emailErr) {
            require('fs').writeFileSync('backend_error.log', 'EMAIL ERR: ' + emailErr.stack);
            console.error('Failed to send verification email:', emailErr.message);
            return res.status(500).json({ error: 'Failed to send verification email. Please check your email configuration.' });
        }

        // We do not return the user or token yet because they are not verified.
        res.status(201).json({ message: 'Registration successful. Check your email for a verification code.' });
    } catch (err) {
        console.error('POST /auth/register error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: 'email and otp are required' });
        const sql = getDb();
        
        // Custom verifyOTP logic to get payload
        const rows = await sql`
            SELECT * FROM otp_codes
            WHERE email = ${email} AND code = ${otp} AND type = 'verify' AND used = FALSE
            ORDER BY created_at DESC LIMIT 1
        `;
        if (!rows.length) return res.status(400).json({ error: 'Invalid code', code: 'OTP_INVALID' });
        if (new Date(rows[0].expires_at) < new Date()) {
            return res.status(400).json({ error: 'Code expired', code: 'OTP_EXPIRED' });
        }
        await sql`UPDATE otp_codes SET used = TRUE WHERE id = ${rows[0].id}`;

        let user;
        const existing = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
        if (existing.length) {
            // Already a user, just update email_verified
            await sql`UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE email = ${email}`;
            user = mapUser(existing[0]);
        } else if (rows[0].payload) {
            // New user registration
            const payload = rows[0].payload;
            const insertRows = await sql`
                INSERT INTO users (full_name, email, password_hash, phone, role, is_active, email_verified)
                VALUES (${payload.fullName}, ${payload.email}, ${payload.password_hash}, ${payload.phone ?? null}, 'customer', TRUE, TRUE)
                RETURNING id, full_name, email, role, phone, is_active, email_verified, created_at
            `;
            user = mapUser(insertRows[0]);
        } else {
            return res.status(400).json({ error: 'Invalid registration state' });
        }
        
        res.json({ message: 'Email verified successfully', user, token: makeToken(user) });
    } catch (err) {
        console.error('POST /auth/verify-otp error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'email is required' });
        const sql = getDb();
        
        const userRows = await sql`SELECT full_name, email_verified FROM users WHERE email = ${email} LIMIT 1`;
        let fullName = '';
        let payload = null;

        if (!userRows.length) {
            // Check if there is a pending registration
            const pendingRows = await sql`SELECT payload FROM otp_codes WHERE email = ${email} AND type = 'verify' AND payload IS NOT NULL ORDER BY created_at DESC LIMIT 1`;
            if (!pendingRows.length) return res.status(404).json({ error: 'No account found with this email' });
            fullName = pendingRows[0].payload.fullName;
            payload = pendingRows[0].payload;
        } else {
            if (userRows[0].email_verified) return res.status(400).json({ error: 'Email is already verified' });
            fullName = userRows[0].full_name;
        }

        const otp = await createOTP(sql, email, 'verify', payload);
        await sendVerificationEmail(email, fullName, otp);
        res.json({ message: 'Verification code sent to your email' });
    } catch (err) {
        console.error('POST /auth/resend-verification error:', err);
        res.status(500).json({ error: err.message });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

        const sql = getDb();
        const rows = await sql`
            SELECT id, full_name, email, password_hash, role, phone, is_active, email_verified, created_at
            FROM users WHERE email = ${email} LIMIT 1
        `;
        if (!rows.length) return res.status(401).json({ error: 'Incorrect credentials', message: 'Email not found' });

        const r = rows[0];
        if (!r.is_active) return res.status(403).json({ error: 'Account is deactivated', message: 'Account is deactivated' });
        if (!r.password_hash) return res.status(401).json({ error: 'Incorrect credentials', message: 'Incorrect password' });

        const match = await bcrypt.compare(password, r.password_hash);
        if (!match) return res.status(401).json({ error: 'Incorrect credentials', message: 'Incorrect password' });

        const user = mapUser(r);
        res.json({ user, token: makeToken(user) });
    } catch (err) {
        console.error('POST /auth/login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const rows = await sql`
            SELECT id, full_name, email, role, phone, is_active, email_verified, created_at
            FROM users WHERE id = ${Number(req.user.id)} LIMIT 1
        `;
        if (!rows.length) return res.status(404).json({ error: 'User not found' });
        res.json(mapUser(rows[0]));
    } catch (err) {
        console.error('GET /auth/me error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/auth/me
router.put('/me', authMiddleware, async (req, res) => {
    try {
        const { fullName, phone } = req.body;
        if (!fullName) return res.status(400).json({ error: 'fullName is required' });

        const sql = getDb();
        const rows = await sql`
            UPDATE users SET full_name = ${fullName}, phone = ${phone ?? null}, updated_at = NOW()
            WHERE id = ${Number(req.user.id)}
            RETURNING id, full_name, email, role, phone, is_active, email_verified
        `;
        res.json({ user: mapUser(rows[0]) });
    } catch (err) {
        console.error('PUT /auth/me error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword)
            return res.status(400).json({ error: 'currentPassword and newPassword are required' });

        const sql = getDb();
        const rows = await sql`SELECT password_hash FROM users WHERE id = ${Number(req.user.id)} LIMIT 1`;
        if (!rows.length) return res.status(404).json({ error: 'User not found' });

        const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

        const hash = await bcrypt.hash(newPassword, 10);
        await sql`UPDATE users SET password_hash = ${hash}, updated_at = NOW() WHERE id = ${Number(req.user.id)}`;
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('PUT /auth/change-password error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/forgot-password — step 1: send OTP to email
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'email is required' });

        const sql = getDb();
        const rows = await sql`SELECT id, full_name FROM users WHERE email = ${email} LIMIT 1`;

        // Always 200 to prevent email enumeration
        if (!rows.length) {
            return res.json({ message: 'If an account with that email exists, a reset code has been sent.' });
        }

        const otp = await createOTP(sql, email, 'reset');
        try {
            await sendForgotPasswordEmail(email, rows[0].full_name, otp);
        } catch (emailErr) {
            console.error('Failed to send reset email:', emailErr.message);
            return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
        }

        res.json({ message: 'A 6-digit reset code has been sent to your email.' });
    } catch (err) {
        console.error('POST /auth/forgot-password error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/reset-password — step 2: verify OTP and set new password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword)
            return res.status(400).json({ error: 'email, otp, and newPassword are required' });

        const sql = getDb();
        const result = await verifyOTP(sql, email, otp, 'reset');
        if (!result.valid) {
            return res.status(400).json({ error: result.error, code: result.expired ? 'OTP_EXPIRED' : 'OTP_INVALID' });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await sql`UPDATE users SET password_hash = ${hash}, updated_at = NOW() WHERE email = ${email}`;
        res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (err) {
        console.error('POST /auth/reset-password error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
