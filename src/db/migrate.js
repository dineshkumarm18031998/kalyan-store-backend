const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🚀 Running migrations...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_name VARCHAR(255),
        phone VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        logo_url TEXT,
        currency VARCHAR(10) DEFAULT 'INR',
        language VARCHAR(10) DEFAULT 'ta',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(255),
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'owner',
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        address TEXT,
        is_vip BOOLEAN DEFAULT FALSE,
        notes TEXT,
        total_orders INTEGER DEFAULT 0,
        total_revenue NUMERIC(12,2) DEFAULT 0,
        total_pending NUMERIC(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        name_ta VARCHAR(255),
        category VARCHAR(100),
        image_url TEXT,
        emoji VARCHAR(10) DEFAULT '📦',
        total_qty INTEGER NOT NULL DEFAULT 0,
        rate_per_day NUMERIC(10,2) NOT NULL DEFAULT 0,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        customer_id INTEGER REFERENCES customers(id),
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20),
        event_type VARCHAR(100),
        event_address TEXT,
        from_date DATE NOT NULL,
        to_date DATE,
        return_date DATE,
        status VARCHAR(30) DEFAULT 'active',
        is_vip BOOLEAN DEFAULT FALSE,
        subtotal NUMERIC(12,2) DEFAULT 0,
        vip_discount NUMERIC(12,2) DEFAULT 0,
        custom_discount NUMERIC(12,2) DEFAULT 0,
        damage_charges NUMERIC(12,2) DEFAULT 0,
        total_amount NUMERIC(12,2) DEFAULT 0,
        paid_amount NUMERIC(12,2) DEFAULT 0,
        balance_amount NUMERIC(12,2) DEFAULT 0,
        is_paid BOOLEAN DEFAULT FALSE,
        notes TEXT,
        whatsapp_sent BOOLEAN DEFAULT FALSE,
        reminder_sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        product_name VARCHAR(255) NOT NULL,
        product_emoji VARCHAR(10) DEFAULT '📦',
        quantity INTEGER NOT NULL DEFAULT 1,
        returned_qty INTEGER DEFAULT 0,
        rate_per_day NUMERIC(10,2) NOT NULL,
        days INTEGER DEFAULT 1,
        subtotal NUMERIC(12,2) DEFAULT 0,
        is_returned BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS damage_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        quantity INTEGER DEFAULT 1,
        cost_each NUMERIC(10,2) NOT NULL,
        total_cost NUMERIC(12,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        type VARCHAR(50),
        message TEXT,
        scheduled_at TIMESTAMP,
        sent_at TIMESTAMP,
        is_sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_from_date ON orders(from_date);
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
      CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
    `);
    console.log('✅ Migrations completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
