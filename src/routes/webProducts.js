/**
 * Web products route — rich schema, same `products` table as mobile.
 * Admin CRUD here is reflected immediately in the mobile app.
 */
const express = require('express');
const { getDb } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const NodeCache = require('node-cache');

const router = express.Router();
const webProductCache = new NodeCache({ stdTTL: 60 });

const WEB_COLUMNS = 'id, name, type, category, material, sizes, colors, cost_price, selling_price, price, discount_price, stock, image_url, image, images, description, featured, new_arrival, best_seller, limited_edition, sales_count, reviews, created_at';

// ── Map a DB row to the web app shape ─────────────────────────
function mapWeb(r) {
    return {
        id: String(r.id),
        name: r.name,
        type: r.type ?? r.category ?? 'Tote',
        material: r.material ?? 'Leather',
        sizes: r.sizes ?? ['Small', 'Medium', 'Large'],
        colors: r.colors ?? ['Black', 'Brown'],
        costPrice: Number(r.cost_price ?? 0),
        sellingPrice: Number(r.selling_price ?? r.price ?? 0),
        discountPrice: r.discount_price ? Number(r.discount_price) : undefined,
        stock: Number(r.stock ?? 0),
        image: r.image_url ?? r.image ?? '',
        images: r.images ?? [],
        description: r.description ?? '',
        featured: r.featured ?? false,
        newArrival: r.new_arrival ?? false,
        bestSeller: r.best_seller ?? false,
        limitedEdition: r.limited_edition ?? false,
        salesCount: Number(r.sales_count ?? r.reviews ?? 0),
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
}

// GET /api/web-products
router.get('/', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const cacheKey = `web_products_${limit}_${offset}`;
        const cached = webProductCache.get(cacheKey);
        if (cached) return res.json(cached);

        const sql = getDb();
        const l = Number(limit);
        const o = Number(offset);

        const rows = await sql`
            SELECT id, name, type, category, material, sizes, colors, cost_price, selling_price, price, discount_price, stock, image_url, image, images, description, featured, new_arrival, best_seller, limited_edition, sales_count, reviews, created_at
            FROM products 
            ORDER BY created_at DESC
            LIMIT ${l} OFFSET ${o}
        `;
        
        const mapped = rows.map(mapWeb);
        webProductCache.set(cacheKey, mapped);
        res.json(mapped);
    } catch (err) {
        console.error('GET /web-products error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Stats endpoints — must come before /:id
router.get('/stats/best-sellers', async (req, res) => {
    try {
        const cached = webProductCache.get('stats_best_sellers');
        if (cached) return res.json(cached);

        const sql = getDb();
        const rows = await sql`
            SELECT id, name, type, category, material, sizes, colors, cost_price, selling_price, price, discount_price, stock, image_url, image, images, description, featured, new_arrival, best_seller, limited_edition, sales_count, reviews, created_at
            FROM products ORDER BY COALESCE(sales_count, reviews, 0) DESC LIMIT 8
        `;
        const mapped = rows.map(mapWeb);
        webProductCache.set('stats_best_sellers', mapped);
        res.json(mapped);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/new-arrivals', async (req, res) => {
    try {
        const cached = webProductCache.get('stats_new_arrivals');
        if (cached) return res.json(cached);

        const sql = getDb();
        const rows = await sql`
            SELECT id, name, type, category, material, sizes, colors, cost_price, selling_price, price, discount_price, stock, image_url, image, images, description, featured, new_arrival, best_seller, limited_edition, sales_count, reviews, created_at
            FROM products WHERE new_arrival = TRUE ORDER BY created_at DESC LIMIT 8
        `;
        const mapped = rows.map(mapWeb);
        webProductCache.set('stats_new_arrivals', mapped);
        res.json(mapped);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/featured', async (req, res) => {
    try {
        const cached = webProductCache.get('stats_featured');
        if (cached) return res.json(cached);

        const sql = getDb();
        const rows = await sql`
            SELECT id, name, type, category, material, sizes, colors, cost_price, selling_price, price, discount_price, stock, image_url, image, images, description, featured, new_arrival, best_seller, limited_edition, sales_count, reviews, created_at
            FROM products WHERE featured = TRUE ORDER BY created_at DESC
        `;
        const mapped = rows.map(mapWeb);
        webProductCache.set('stats_featured', mapped);
        res.json(mapped);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/limited-edition', async (req, res) => {
    try {
        const cached = webProductCache.get('stats_limited_edition');
        if (cached) return res.json(cached);

        const sql = getDb();
        const rows = await sql`
            SELECT id, name, type, category, material, sizes, colors, cost_price, selling_price, price, discount_price, stock, image_url, image, images, description, featured, new_arrival, best_seller, limited_edition, sales_count, reviews, created_at
            FROM products WHERE limited_edition = TRUE ORDER BY created_at DESC
        `;
        const mapped = rows.map(mapWeb);
        webProductCache.set('stats_limited_edition', mapped);
        res.json(mapped);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/low-stock', async (req, res) => {
    try {
        const cached = webProductCache.get('stats_low_stock');
        if (cached) return res.json(cached);

        const sql = getDb();
        const rows = await sql`
            SELECT id, name, type, category, material, sizes, colors, cost_price, selling_price, price, discount_price, stock, image_url, image, images, description, featured, new_arrival, best_seller, limited_edition, sales_count, reviews, created_at
            FROM products WHERE COALESCE(stock, 0) <= 5 ORDER BY stock ASC
        `;
        const mapped = rows.map(mapWeb);
        webProductCache.set('stats_low_stock', mapped);
        res.json(mapped);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/web-products/:id
router.get('/:id', async (req, res) => {
    try {
        const cacheKey = `web_product_${req.params.id}`;
        const cached = webProductCache.get(cacheKey);
        if (cached) return res.json(cached);

        const sql = getDb();
        const rows = await sql`
            SELECT id, name, type, category, material, sizes, colors, cost_price, selling_price, price, discount_price, stock, image_url, image, images, description, featured, new_arrival, best_seller, limited_edition, sales_count, reviews, created_at
            FROM products WHERE id = ${Number(req.params.id)} LIMIT 1
        `;
        if (!rows.length) return res.status(404).json({ error: 'Product not found' });
        
        const mapped = mapWeb(rows[0]);
        webProductCache.set(cacheKey, mapped);
        res.json(mapped);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/web-products — admin creates product, shows in both apps
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const p = req.body;
        const rows = await sql`
            INSERT INTO products (
                name, description, price, image_url,
                category, tag, rating, reviews, in_stock,
                type, material, sizes, colors,
                cost_price, selling_price, discount_price,
                stock, image, images,
                featured, new_arrival, best_seller, limited_edition, sales_count
            ) VALUES (
                ${p.name},
                ${p.description ?? ''},
                ${p.sellingPrice ?? p.price ?? 0},
                ${p.image ?? ''},
                ${p.type ?? p.category ?? 'Tote'},
                ${p.tag ?? null},
                ${p.rating ?? 4.5},
                ${p.reviews ?? 0},
                ${(p.stock ?? 0) > 0},
                ${p.type ?? p.category ?? 'Tote'},
                ${p.material ?? 'Leather'},
                ${p.sizes ?? ['Small', 'Medium', 'Large']},
                ${p.colors ?? ['Black', 'Brown']},
                ${p.costPrice ?? 0},
                ${p.sellingPrice ?? p.price ?? 0},
                ${p.discountPrice ?? null},
                ${p.stock ?? 0},
                ${p.image ?? ''},
                ${p.images ?? []},
                ${p.featured ?? false},
                ${p.newArrival ?? false},
                ${p.bestSeller ?? false},
                ${p.limitedEdition ?? false},
                ${p.salesCount ?? 0}
            )
            RETURNING *
        `;
        webProductCache.flushAll(); // Invalidate cache on creation
        res.status(201).json(mapWeb(rows[0]));
    } catch (err) {
        console.error('POST /web-products error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/web-products/:id — admin updates, reflects in both apps
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        const p = req.body;
        const rows = await sql`
            UPDATE products SET
                name            = COALESCE(${p.name ?? null}, name),
                description     = COALESCE(${p.description ?? null}, description),
                price           = COALESCE(${p.sellingPrice ?? p.price ?? null}, price),
                image_url       = COALESCE(${p.image ?? null}, image_url),
                category        = COALESCE(${p.type ?? p.category ?? null}, category),
                tag             = COALESCE(${p.tag ?? null}, tag),
                rating          = COALESCE(${p.rating ?? null}, rating),
                in_stock        = COALESCE(${p.stock != null ? p.stock > 0 : null}, in_stock),
                type            = COALESCE(${p.type ?? null}, type),
                material        = COALESCE(${p.material ?? null}, material),
                sizes           = COALESCE(${p.sizes ?? null}, sizes),
                colors          = COALESCE(${p.colors ?? null}, colors),
                cost_price      = COALESCE(${p.costPrice ?? null}, cost_price),
                selling_price   = COALESCE(${p.sellingPrice ?? null}, selling_price),
                discount_price  = ${p.discountPrice ?? null},
                stock           = COALESCE(${p.stock ?? null}, stock),
                image           = COALESCE(${p.image ?? null}, image),
                images          = COALESCE(${p.images ?? null}, images),
                featured        = COALESCE(${p.featured ?? null}, featured),
                new_arrival     = COALESCE(${p.newArrival ?? null}, new_arrival),
                best_seller     = COALESCE(${p.bestSeller ?? null}, best_seller),
                limited_edition = COALESCE(${p.limitedEdition ?? null}, limited_edition)
            WHERE id = ${Number(req.params.id)}
            RETURNING *
        `;
        if (!rows.length) return res.status(404).json({ error: 'Product not found' });
        
        webProductCache.flushAll(); // Invalidate cache on update
        res.json(mapWeb(rows[0]));
    } catch (err) {
        console.error('PUT /web-products/:id error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/web-products/:id
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const sql = getDb();
        await sql`DELETE FROM products WHERE id = ${Number(req.params.id)}`;
        webProductCache.flushAll(); // Invalidate cache on deletion
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
