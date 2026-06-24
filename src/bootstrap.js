const { getDb } = require('./db');
const bcrypt = require('bcryptjs');

async function bootstrapDatabase() {
    const sql = getDb();

    // ── Users (shared — mobile + web, all roles) ───────────────
    await sql`
        CREATE TABLE IF NOT EXISTS users (
            id               SERIAL PRIMARY KEY,
            google_id        TEXT UNIQUE,
            full_name        TEXT NOT NULL,
            email            TEXT UNIQUE NOT NULL,
            profile_picture  TEXT,
            password_hash    TEXT,
            phone            TEXT,
            role             TEXT NOT NULL DEFAULT 'customer',
            is_active        BOOLEAN DEFAULT TRUE,
            email_verified   BOOLEAN DEFAULT FALSE,
            created_at       TIMESTAMPTZ DEFAULT NOW(),
            updated_at       TIMESTAMPTZ DEFAULT NOW()
        )
    `;
    // Add new columns to existing users table if upgrading
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;

    // ── Backfill created_at for existing users that have NULL ──
    await sql`
        UPDATE users
        SET created_at = NOW()
        WHERE created_at IS NULL
    `;

    // ── OTP codes (email verification + password reset) ────────
    await sql`
        CREATE TABLE IF NOT EXISTS otp_codes (
            id          SERIAL PRIMARY KEY,
            email       TEXT NOT NULL,
            code        TEXT NOT NULL,
            type        TEXT NOT NULL DEFAULT 'verify',  -- 'verify' | 'reset'
            payload     JSONB,
            expires_at  TIMESTAMPTZ NOT NULL,
            used        BOOLEAN DEFAULT FALSE,
            created_at  TIMESTAMPTZ DEFAULT NOW()
        )
    `;
    await sql`ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS payload JSONB`;
    await sql`CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email, type)`;

    // ── Products (shared — mobile + web) ───────────────────────
    await sql`
        CREATE TABLE IF NOT EXISTS products (
            id              SERIAL PRIMARY KEY,
            name            TEXT NOT NULL,
            description     TEXT DEFAULT '',
            price           NUMERIC(10,2) NOT NULL DEFAULT 0,
            image_url       TEXT DEFAULT '',
            category        TEXT DEFAULT '',
            tag             TEXT,
            rating          NUMERIC(3,1) DEFAULT 4.5,
            reviews         INTEGER DEFAULT 0,
            in_stock        BOOLEAN DEFAULT TRUE,
            type            TEXT DEFAULT 'Tote',
            material        TEXT DEFAULT 'Leather',
            sizes           TEXT[] DEFAULT ARRAY['Small','Medium','Large'],
            colors          TEXT[] DEFAULT ARRAY['Black','Brown'],
            cost_price      NUMERIC(10,2) DEFAULT 0,
            selling_price   NUMERIC(10,2) DEFAULT 0,
            discount_price  NUMERIC(10,2),
            stock           INTEGER DEFAULT 0,
            image           TEXT DEFAULT '',
            images          TEXT[] DEFAULT ARRAY[]::TEXT[],
            featured        BOOLEAN DEFAULT FALSE,
            new_arrival     BOOLEAN DEFAULT FALSE,
            best_seller     BOOLEAN DEFAULT FALSE,
            limited_edition BOOLEAN DEFAULT FALSE,
            sales_count     INTEGER DEFAULT 0,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    `;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Tote'`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS material TEXT DEFAULT 'Leather'`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes TEXT[] DEFAULT ARRAY['Small','Medium','Large']`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS colors TEXT[] DEFAULT ARRAY['Black','Brown']`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) DEFAULT 0`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price NUMERIC(10,2) DEFAULT 0`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_price NUMERIC(10,2)`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT DEFAULT ''`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT ARRAY[]::TEXT[]`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS new_arrival BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS best_seller BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS limited_edition BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0`;

    try {
        await sql`UPDATE products SET selling_price = price WHERE selling_price = 0 AND price > 0`;
        await sql`UPDATE products SET image = image_url WHERE (image = '' OR image IS NULL) AND image_url IS NOT NULL AND image_url != ''`;
        await sql`UPDATE products SET type = category WHERE type = 'Tote' AND category IS NOT NULL AND category != ''`;
    } catch (e) { }

    // ── Cart & Wishlist (mobile) ────────────────────────────────
    await sql`
        CREATE TABLE IF NOT EXISTS cart_items (
            id          SERIAL PRIMARY KEY,
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            quantity    INTEGER NOT NULL DEFAULT 1,
            added_at    TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(user_id, product_id)
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS wishlist (
            id          SERIAL PRIMARY KEY,
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            added_at    TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(user_id, product_id)
        )
    `;

    // ── Orders (shared — mobile uses orders/order_items, web uses same) ──
    await sql`
        CREATE TABLE IF NOT EXISTS orders (
            id              TEXT PRIMARY KEY DEFAULT ('ORD-' || extract(epoch from now())::bigint::text),
            user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
            date            TIMESTAMPTZ DEFAULT NOW(),
            subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
            discount        NUMERIC(10,2) DEFAULT 0,
            delivery        NUMERIC(10,2) DEFAULT 0,
            shipping        NUMERIC(10,2) DEFAULT 0,
            total           NUMERIC(10,2) NOT NULL DEFAULT 0,
            status          TEXT DEFAULT 'Processing',
            payment_status  TEXT DEFAULT 'Pending',
            payment_method  TEXT DEFAULT 'M-Pesa',
            transaction_code TEXT,
            address         TEXT DEFAULT '',
            customer_name   TEXT DEFAULT '',
            customer_email  TEXT DEFAULT '',
            customer_phone  TEXT,
            discount_code   TEXT,
            status_history  JSONB DEFAULT '[]'::JSONB,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW()
        )
    `;
    // Add new columns to existing orders table if upgrading
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT NOW()`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery NUMERIC(10,2) DEFAULT 0`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending'`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'M-Pesa'`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_code TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS address TEXT DEFAULT ''`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT ''`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT DEFAULT ''`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::JSONB`;

    await sql`
        CREATE TABLE IF NOT EXISTS order_items (
            id              SERIAL PRIMARY KEY,
            order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            product_id      TEXT NOT NULL,
            product_name    TEXT NOT NULL DEFAULT '',
            name            TEXT DEFAULT '',
            quantity        INTEGER NOT NULL DEFAULT 1,
            unit_price      NUMERIC(10,2) DEFAULT 0,
            price           NUMERIC(10,2) DEFAULT 0,
            cost_price      NUMERIC(10,2) DEFAULT 0,
            color           TEXT DEFAULT '',
            size            TEXT DEFAULT 'Medium',
            image_url       TEXT
        )
    `;
    await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name TEXT DEFAULT ''`;
    await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0`;
    await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) DEFAULT 0`;
    await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color TEXT DEFAULT ''`;
    await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size TEXT DEFAULT 'Medium'`;

    // ── Payments (shared) ──────────────────────────────────────
    await sql`
        CREATE TABLE IF NOT EXISTS payments (
            id              TEXT PRIMARY KEY,
            order_id        TEXT NOT NULL,
            customer        TEXT NOT NULL,
            method          TEXT NOT NULL DEFAULT 'M-Pesa',
            transaction_code TEXT NOT NULL,
            amount          NUMERIC(10,2) NOT NULL,
            status          TEXT DEFAULT 'Pending',
            date            TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    // ── Expenses (admin) ───────────────────────────────────────
    await sql`
        CREATE TABLE IF NOT EXISTS expenses (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            category        TEXT NOT NULL,
            amount          NUMERIC(10,2) NOT NULL,
            date            TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    // ── Customers (derived view of users — kept for admin stats) ──
    await sql`
        CREATE TABLE IF NOT EXISTS customers (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            email           TEXT UNIQUE NOT NULL,
            phone           TEXT DEFAULT '',
            total_orders    INTEGER DEFAULT 0,
            total_spent     NUMERIC(10,2) DEFAULT 0,
            join_date       TIMESTAMPTZ DEFAULT NOW(),
            last_order      TIMESTAMPTZ
        )
    `;

    // ── Promotions (shared) ────────────────────────────────────
    await sql`
        CREATE TABLE IF NOT EXISTS promotions (
            id              TEXT PRIMARY KEY,
            code            TEXT UNIQUE NOT NULL,
            description     TEXT DEFAULT '',
            discount_percent NUMERIC(5,2) NOT NULL,
            usage_count     INTEGER DEFAULT 0,
            max_usage       INTEGER DEFAULT 100,
            start_date      TIMESTAMPTZ NOT NULL,
            end_date        TIMESTAMPTZ NOT NULL,
            active          BOOLEAN DEFAULT TRUE,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    // ── Migrate data from old web_* tables if they exist ───────
    try {
        // Migrate web_users → users (merge)
        const webUsersExist = await sql`SELECT to_regclass('web_users') as t`;
        if (webUsersExist[0].t) {
            await sql`
                INSERT INTO users (full_name, email, password_hash, phone, role, is_active, email_verified, created_at, updated_at)
                SELECT full_name, email, password_hash, phone, role, is_active, email_verified, created_at, updated_at
                FROM web_users
                ON CONFLICT (email) DO UPDATE SET
                    password_hash  = EXCLUDED.password_hash,
                    role           = EXCLUDED.role,
                    phone          = COALESCE(EXCLUDED.phone, users.phone),
                    is_active      = EXCLUDED.is_active,
                    email_verified = EXCLUDED.email_verified
            `;
            console.log('✅ Migrated web_users → users');
        }
    } catch (e) { /* already migrated or table doesn't exist */ }

    try {
        // Migrate web_orders → orders
        const webOrdersExist = await sql`SELECT to_regclass('web_orders') as t`;
        if (webOrdersExist[0].t) {
            await sql`
                INSERT INTO orders (id, date, subtotal, discount, delivery, total, status, payment_status, payment_method, transaction_code, address, customer_name, customer_email, customer_phone, discount_code, status_history, created_at)
                SELECT id, COALESCE(date, created_at), subtotal, COALESCE(discount,0), COALESCE(delivery,0), total, status, payment_status, payment_method, transaction_code, address, customer_name, customer_email, customer_phone, discount_code, status_history, created_at
                FROM web_orders
                ON CONFLICT (id) DO NOTHING
            `;
            await sql`
                INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, cost_price, color, size)
                SELECT order_id, product_id, product_name, quantity, unit_price, COALESCE(cost_price,0), COALESCE(color,''), COALESCE(size,'Medium')
                FROM web_order_items
                ON CONFLICT DO NOTHING
            `;
            console.log('✅ Migrated web_orders → orders');
        }
    } catch (e) { /* already migrated */ }

    try {
        // Migrate web_payments → payments
        const webPaymentsExist = await sql`SELECT to_regclass('web_payments') as t`;
        if (webPaymentsExist[0].t) {
            await sql`
                INSERT INTO payments (id, order_id, customer, method, transaction_code, amount, status, date)
                SELECT id, order_id, customer, method, transaction_code, amount, status, date
                FROM web_payments
                ON CONFLICT (id) DO NOTHING
            `;
            console.log('✅ Migrated web_payments → payments');
        }
    } catch (e) { }

    try {
        // Migrate web_expenses → expenses
        const webExpensesExist = await sql`SELECT to_regclass('web_expenses') as t`;
        if (webExpensesExist[0].t) {
            await sql`
                INSERT INTO expenses (id, name, category, amount, date)
                SELECT id, name, category, amount, date
                FROM web_expenses
                ON CONFLICT (id) DO NOTHING
            `;
            console.log('✅ Migrated web_expenses → expenses');
        }
    } catch (e) { }

    try {
        // Migrate web_customers → customers
        const webCustomersExist = await sql`SELECT to_regclass('web_customers') as t`;
        if (webCustomersExist[0].t) {
            await sql`
                INSERT INTO customers (id, name, email, phone, total_orders, total_spent, join_date, last_order)
                SELECT id, name, email, phone, total_orders, total_spent, join_date, last_order
                FROM web_customers
                ON CONFLICT (email) DO NOTHING
            `;
            console.log('✅ Migrated web_customers → customers');
        }
    } catch (e) { }

    try {
        // Migrate web_promotions → promotions
        const webPromosExist = await sql`SELECT to_regclass('web_promotions') as t`;
        if (webPromosExist[0].t) {
            await sql`
                INSERT INTO promotions (id, code, description, discount_percent, usage_count, max_usage, start_date, end_date, active, created_at)
                SELECT id, code, description, discount_percent, usage_count, max_usage, start_date, end_date, active, created_at
                FROM web_promotions
                ON CONFLICT (id) DO NOTHING
            `;
            console.log('✅ Migrated web_promotions → promotions');
        }
    } catch (e) { }

    // ── Seed products if empty ─────────────────────────────────
    const count = await sql`SELECT COUNT(*) as n FROM products`;
    if (Number(count[0].n) === 0) {
        await seedProducts(sql);
        console.log('✅ Products seeded');
    }

    // ── Seed admin if none exists ──────────────────────────────
    const adminCheck = await sql`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
    if (adminCheck.length === 0) {
        const hash = await bcrypt.hash('Kerubelle@2026', 10);
        await sql`
            INSERT INTO users (full_name, email, password_hash, role, is_active, email_verified)
            VALUES ('Kerubelle Admin', 'kerubelle@gmail.com', ${hash}, 'admin', TRUE, TRUE)
            ON CONFLICT (email) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                role = 'admin', is_active = TRUE
        `;
        console.log('✅ Admin user ready: kerubelle@gmail.com');
    }

    // ── Seed promotions if empty ───────────────────────────────
    const promoCount = await sql`SELECT COUNT(*) as n FROM promotions`;
    if (Number(promoCount[0].n) === 0) {
        await seedPromotions(sql);
        console.log('✅ Promotions seeded');
    }

    console.log('✅ Database bootstrapped (unified schema)');
}

async function seedProducts(sql) {
    const products = [
        { name: 'Brown Leather Tote', type: 'Tote', material: 'Leather', description: 'Elegant brown leather tote bag perfect for work and shopping.', price: 900, cost_price: 450, selling_price: 900, stock: 25, image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', category: 'Tote', tag: 'Bestseller', rating: 4.5, reviews: 7403, featured: true, best_seller: true, sales_count: 74 },
        { name: 'Blue Crossbody Bag', type: 'Crossbody', material: 'Leather', description: 'Stylish blue crossbody bag with adjustable strap for casual outings.', price: 700, cost_price: 350, selling_price: 700, stock: 18, image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&q=80', image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&q=80', category: 'Crossbody', tag: 'Top Rated', rating: 4.8, reviews: 16586, featured: true, sales_count: 165 },
        { name: 'Classic Red Satchel', type: 'Shoulder', material: 'Leather', description: 'Classic red satchel with structured design for professional settings.', price: 999, cost_price: 500, selling_price: 999, stock: 12, image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80', category: 'Satchel', tag: null, rating: 4.5, reviews: 19551, sales_count: 195 },
        { name: 'Pink Shoulder Bag', type: 'Shoulder', material: 'Faux Leather', description: 'Chic pink shoulder bag for any occasion.', price: 850, cost_price: 400, selling_price: 850, stock: 20, image_url: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&q=80', image: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&q=80', category: 'Shoulder', tag: 'New', rating: 4.7, reviews: 23932, new_arrival: true, sales_count: 239 },
        { name: 'Black Mini Handbag', type: 'Mini', material: 'Leather', description: 'Compact black mini handbag with gold hardware.', price: 650, cost_price: 300, selling_price: 650, stock: 30, image_url: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600&q=80', image: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600&q=80', category: 'Clutch', tag: null, rating: 4.6, reviews: 10795, sales_count: 107 },
        { name: 'Beige Luxury Tote', type: 'Tote', material: 'Luxury', description: 'Premium beige luxury tote with suede interior.', price: 1200, cost_price: 600, selling_price: 1200, discount_price: 1050, stock: 8, image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', category: 'Tote', tag: 'Luxury', rating: 4.9, reviews: 5090, featured: true, limited_edition: true, sales_count: 50 },
        { name: 'Tan Leather Satchel', type: 'Shoulder', material: 'Leather', description: 'Tan leather satchel with multiple compartments.', price: 920, cost_price: 460, selling_price: 920, stock: 15, image_url: 'https://images.unsplash.com/photo-1575032617751-6ddec2089882?w=600&q=80', image: 'https://images.unsplash.com/photo-1575032617751-6ddec2089882?w=600&q=80', category: 'Satchel', tag: null, rating: 4.6, reviews: 12340, sales_count: 123 },
        { name: 'Blush Mini Bag', type: 'Mini', material: 'Faux Leather', description: 'Elegant blush bag with gold chain strap.', price: 780, cost_price: 380, selling_price: 780, stock: 22, image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80', category: 'Clutch', tag: 'New', rating: 4.4, reviews: 8821, new_arrival: true, sales_count: 88 },
        { name: 'Half Moon Bag', type: 'Clutch', material: 'Luxury', description: 'Handbag with two rounded corners.', price: 1500, cost_price: 750, selling_price: 1500, stock: 5, image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80', category: 'Luxury', tag: 'Luxury', rating: 4.9, reviews: 3210, limited_edition: true, sales_count: 32 },
        { name: 'Classic Clutch', type: 'Clutch', material: 'Leather', description: 'Small handbag designed to be handheld.', price: 550, cost_price: 270, selling_price: 550, stock: 35, image_url: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&q=80', image: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&q=80', category: 'Clutch', tag: null, rating: 4.3, reviews: 6540, sales_count: 65 },
        { name: 'Bucket Bag', type: 'Shoulder', material: 'Faux Leather', description: 'Rounded base with drawstring cinched opening.', price: 720, cost_price: 360, selling_price: 720, stock: 28, image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', category: 'Shoulder', tag: null, rating: 4.5, reviews: 9870, sales_count: 98 },
        { name: 'Envelope Clutch', type: 'Clutch', material: 'Fabric', description: 'Slim clutch with a triangle flap closure.', price: 480, cost_price: 240, selling_price: 480, stock: 40, image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', category: 'Clutch', tag: 'New', rating: 4.4, reviews: 4320, new_arrival: true, sales_count: 43 },
    ];
    for (const p of products) {
        await sql`
            INSERT INTO products (name, description, price, image_url, category, tag, rating, reviews, in_stock, type, material, cost_price, selling_price, discount_price, stock, image, featured, new_arrival, best_seller, limited_edition, sales_count)
            VALUES (${p.name}, ${p.description}, ${p.price}, ${p.image_url}, ${p.category}, ${p.tag ?? null}, ${p.rating}, ${p.reviews}, ${p.stock > 0}, ${p.type}, ${p.material}, ${p.cost_price}, ${p.selling_price}, ${p.discount_price ?? null}, ${p.stock}, ${p.image}, ${p.featured ?? false}, ${p.new_arrival ?? false}, ${p.best_seller ?? false}, ${p.limited_edition ?? false}, ${p.sales_count})
        `;
    }
}

async function seedPromotions(sql) {
    const promos = [
        { id: 'PROMO-1', code: 'WELCOME10', description: '10% off your first order', discount_percent: 10, max_usage: 500, start_date: '2024-01-01', end_date: '2026-12-31', active: true },
        { id: 'PROMO-2', code: 'LUXURY20', description: '20% off luxury items', discount_percent: 20, max_usage: 100, start_date: '2024-01-01', end_date: '2026-12-31', active: true },
        { id: 'PROMO-3', code: 'SAVE15', description: '15% off orders over KES 1000', discount_percent: 15, max_usage: 200, start_date: '2024-01-01', end_date: '2026-06-30', active: false },
    ];
    for (const p of promos) {
        await sql`
            INSERT INTO promotions (id, code, description, discount_percent, max_usage, start_date, end_date, active)
            VALUES (${p.id}, ${p.code}, ${p.description}, ${p.discount_percent}, ${p.max_usage}, ${p.start_date}, ${p.end_date}, ${p.active})
            ON CONFLICT (id) DO NOTHING
        `;
    }
}

module.exports = { bootstrapDatabase };
