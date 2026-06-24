const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = header.slice(7);
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function adminMiddleware(req, res, next) {
    if (req.user?.role !== 'admin' && req.user?.role !== 'staff') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

module.exports = { authMiddleware, adminMiddleware };
