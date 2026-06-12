-- Migration initiale : port du schema MySQL vers PostgreSQL
-- Converti depuis public/data/schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. conversation_stats
CREATE TABLE IF NOT EXISTS conversation_stats (
  id SERIAL PRIMARY KEY,
  session_key VARCHAR(64) NOT NULL,
  mode CHAR(1) NOT NULL DEFAULT 'A',
  messages_count INTEGER NOT NULL DEFAULT 0,
  stage VARCHAR(50) NOT NULL DEFAULT 'accueil',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT idx_session_unique UNIQUE (session_key)
);

CREATE INDEX IF NOT EXISTS idx_cs_mode ON conversation_stats (mode);
CREATE INDEX IF NOT EXISTS idx_cs_stage ON conversation_stats (stage);
CREATE INDEX IF NOT EXISTS idx_cs_created ON conversation_stats (created_at);

-- 2. page_views
CREATE TABLE IF NOT EXISTS page_views (
  id SERIAL PRIMARY KEY,
  session_key VARCHAR(64) NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  page_url VARCHAR(255) NOT NULL DEFAULT '/',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pv_session ON page_views (session_key);
CREATE INDEX IF NOT EXISTS idx_pv_created ON page_views (created_at);
CREATE INDEX IF NOT EXISTS idx_pv_admin ON page_views (is_admin);

-- 3. rate_limits
CREATE TABLE IF NOT EXISTS rate_limits (
  ip VARCHAR(45) PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rl_reset ON rate_limits (reset_at);

-- 4. services
CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255) NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  original_price NUMERIC(10,2),
  icon VARCHAR(32) NOT NULL DEFAULT '🔮',
  image_url TEXT NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#8b5cf6',
  description TEXT NOT NULL,
  benefits TEXT NOT NULL,
  duration VARCHAR(50) NOT NULL DEFAULT '',
  format VARCHAR(100) NOT NULL DEFAULT '',
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_slug ON services (slug);
CREATE INDEX IF NOT EXISTS idx_services_visible ON services (visible);

-- 5. service_products (junction table)
CREATE TABLE IF NOT EXISTS service_products (
  service_id VARCHAR(64) NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (service_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_sp_product ON service_products (product_id);

-- 6. products
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'DT',
  image_url TEXT NOT NULL,
  benefits TEXT NOT NULL,
  taille VARCHAR(100) NOT NULL DEFAULT '',
  accent_color VARCHAR(7) NOT NULL DEFAULT '#7c3aed',
  product_type VARCHAR(50) NOT NULL DEFAULT '',
  welcome_sequence JSONB NOT NULL DEFAULT '[]',
  stock INTEGER NOT NULL DEFAULT 10,
  hook TEXT NOT NULL,
  hook_transition TEXT NOT NULL,
  upsell_price NUMERIC(10,2),
  price_original NUMERIC(10,2),
  faq JSONB NOT NULL DEFAULT '[]',
  reviews JSONB NOT NULL DEFAULT '[]',
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products (slug);
CREATE INDEX IF NOT EXISTS idx_products_type ON products (product_type);
CREATE INDEX IF NOT EXISTS idx_products_visible ON products (visible);

-- 7. orders
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(32) PRIMARY KEY,
  nom VARCHAR(255) NOT NULL DEFAULT '',
  telephone VARCHAR(50) NOT NULL DEFAULT '',
  telephone2 VARCHAR(50) NOT NULL DEFAULT '',
  gouvernorat VARCHAR(100) NOT NULL DEFAULT '',
  adresse TEXT NOT NULL,
  produit TEXT NOT NULL,
  prix_produit NUMERIC(10,2) NOT NULL DEFAULT 0,
  frais_livraison NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_commande NUMERIC(10,2) NOT NULL DEFAULT 0,
  nombre_articles INTEGER NOT NULL DEFAULT 0,
  format_personnalise VARCHAR(100) NOT NULL DEFAULT '',
  date_naissance VARCHAR(20) NOT NULL DEFAULT '',
  signe_astrologique VARCHAR(100) NOT NULL DEFAULT '',
  chemin_vie VARCHAR(50) NOT NULL DEFAULT '',
  nombre_ame VARCHAR(50) NOT NULL DEFAULT '',
  nombre_personnalite VARCHAR(50) NOT NULL DEFAULT '',
  composition_personnalisee TEXT NOT NULL,
  brief_fabrication TEXT NOT NULL,
  notes TEXT NOT NULL,
  tracking_number VARCHAR(255) NOT NULL DEFAULT '',
  statut VARCHAR(50) NOT NULL DEFAULT 'attente de confirm tel',
  statut_avant_corbeille VARCHAR(50),
  trashed_at TIMESTAMPTZ,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_statut ON orders (statut);
CREATE INDEX IF NOT EXISTS idx_orders_telephone ON orders (telephone);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders (date);
CREATE INDEX IF NOT EXISTS idx_orders_statut_date ON orders (statut, date);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_stats_updated_at
  BEFORE UPDATE ON conversation_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
