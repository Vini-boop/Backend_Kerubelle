/**
 * Unified products route — serves BOTH mobile and web apps.
 * Mobile: GET /api/products  (simple fields)
 * Web:    GET /api/web-products  (rich fields, same table)
 *
 * All products live in the single `products` table.
 */
const express = require('express');
const { getDb } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const NodeCache = require('node-cache');

const router = express.Router();
const productCache = new NodeCache({ stdTTL: 60 });

const MOBILE_COLUMNS = 'id, name, description, price, selling_price, discount_price, image_url, image, category, type, tag, rating, reviews, in_stock, stock, new_arrival, featured, best_seller, limited_edition';

// ── Map a DB row to the mobile app shape ──────────────────────
function mapMobile(r) {
    return {
        id: String(r.id),
        name: r.name,
        description: r.description ?? '',
        price: Number(r.selling_price ?? r.price ?? 0),
        discountPrice: r.discount_price ? Number(r.discount_price) : null,
        image: r.image_url ?? r.image ?? '',
        category: r.category ?? r.type ?? '',
        tag: r.tag ?? null,
        rating: Number(r.rating ?? 4.5),
        reviews: Number(r.reviews ?? 0),
        inStock: r.in_stock ?? (Number(r.stock ?? 1) > 0),
        newArrival: r.new_arrival ?? false,
        featured: r.featured ?? false,
        bestSeller: r.best_seller ?? false,
        limitedEdition: r.limited_edition ?? false,
    };
}

// GET /api/products
router.get('/', async (req, res) => {
    try {
        const { category, search, limit = 50, offset = 0 } = req.query;
        
        // Cache key based on query params
        const cacheKey = `products_${category || 'all'}_${search || 'none'}_${limit}_${offset}`;
        const cached = productCache.get(cacheKey);
        if (cached) return res.json(cached);

        const sql = getDb();
        const l = Number(limit);
        const o = Number(offset);

        let rows;
        if (search) {
            rows = await sql`
                SELECT id, name, description, price, selling_price, discount_price, image_url, image, category, type, tag, rating, reviews, in_stock, stock, new_arrival, featured, best_seller, limited_edition
                FROM products
                WHERE (in_stock = TRUE OR stock > 0)
                  AND (name ILIKE ${'%' + search + '%'} OR description ILIKE ${'%' + search + '%'})
                ORDER BY COALESCE(rating, 4.5) DESC
                LIMIT ${l} OFFSET ${o}
            `;
        } else if (category && category !== 'All') {
            rows = await sql`
                SELECT id, name, description, price, selling_price, discount_price, image_url, image, category, type, tag, rating, reviews, in_stock, stock, new_arrival, featured, best_seller, limited_edition
                FROM products
                WHERE (in_stock = TRUE OR stock > 0)
                  AND (category ILIKE ${category} OR type ILIKE ${category} OR tag ILIKE ${category})
                ORDER BY id
                LIMIT ${l} OFFSET ${o}
            `;
        } else {
            rows = await sql`
                SELECT id, name, description, price, selling_price, discount_price, image_url, image, category, type, tag, rating, reviews, in_stock, stock, new_arrival, featured, best_seller, limited_edition
                FROM products 
                WHERE (in_stock = TRUE OR stock > 0) 
                ORDER BY id
                LIMIT ${l} OFFSET ${o}
            `;
        }
        
        const mapped = rows.map(mapMobile);
        productCache.set(cacheKey, mapped);
        res.json(mapped);
    } catch (err) {
        console.error('GET /products error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
    try {
        const cacheKey = `product_${req.params.id}`;
        const cached = productCache.get(cacheKey);
        if (cached) return res.json(cached);

        const sql = getDb();
        const rows = await sql`
            SELECT id, name, description, price, selling_price, discount_price, image_url, image, category, type, tag, rating, reviews, in_stock, stock, new_arrival, featured, best_seller, limited_edition
            FROM products WHERE id = ${Number(req.params.id)} LIMIT 1
        `;
        if (!rows.length) return res.status(404).json({ error: 'Product not found' });
        
        const mapped = mapMobile(rows[0]);
        productCache.set(cacheKey, mapped);
        res.json(mapped);
    } catch (err) {
        console.error('GET /products/:id error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
