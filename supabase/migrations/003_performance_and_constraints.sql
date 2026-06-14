-- Add missing indexes, foreign keys, and constraints for performance and data integrity.

-- Index for filtered order listing (non-trashed, sorted by date)
CREATE INDEX IF NOT EXISTS idx_orders_trashed_date ON orders (trashed_at, date DESC);

-- Composite index for order dedup query (telephone + date)
CREATE INDEX IF NOT EXISTS idx_orders_phone_date ON orders (telephone, date DESC);

-- Enforce at DB level that a product slug is unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug_unique ON products (slug);

-- Constrain page_url to arbitrary length (was VARCHAR(255) which truncates long URLs)
ALTER TABLE page_views ALTER COLUMN page_url TYPE TEXT;

-- Add missing foreign key: service_products.product_id -> products.id
ALTER TABLE service_products
  DROP CONSTRAINT IF EXISTS service_products_product_id_fkey,
  ADD CONSTRAINT service_products_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Add NOT NULL defaults for fragile columns
ALTER TABLE orders ALTER COLUMN produit SET DEFAULT '';
ALTER TABLE orders ALTER COLUMN adresse SET DEFAULT '';

-- Remove duplicate function definition from 002_app_config.sql (keep existing)
-- (no-op: CREATE OR REPLACE already makes it safe, but this documents the intent)
