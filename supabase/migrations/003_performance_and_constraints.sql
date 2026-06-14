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

-- Atomic rate limiter RPC (avoids SELECT-then-UPDATE/INSERT race)
CREATE OR REPLACE FUNCTION check_rate_limit(p_ip VARCHAR(45), p_max INT, p_window_seconds INT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
  v_reset_at TIMESTAMPTZ;
BEGIN
  -- Clean expired entries for this IP
  DELETE FROM rate_limits WHERE reset_at <= now() AND ip = p_ip;

  SELECT count, reset_at INTO v_count, v_reset_at
  FROM rate_limits WHERE ip = p_ip FOR UPDATE;

  IF v_count IS NOT NULL THEN
    IF v_count >= p_max THEN
      RETURN jsonb_build_object('allowed', false, 'retry_after', extract(epoch from (v_reset_at - now())));
    END IF;
    UPDATE rate_limits SET count = count + 1, reset_at = v_reset_at WHERE ip = p_ip;
    RETURN jsonb_build_object('allowed', true);
  ELSE
    INSERT INTO rate_limits (ip, count, reset_at)
    VALUES (p_ip, 1, now() + make_interval(secs => p_window_seconds));
    RETURN jsonb_build_object('allowed', true);
  END IF;
END;
$$;
