-- Store runtime/admin configuration in Supabase instead of local files.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE IF NOT EXISTS app_config (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  system_prompt TEXT NOT NULL DEFAULT '',
  catalog_item_template TEXT NOT NULL DEFAULT '{n}. {name} [RENDER_PRODUCT:{id}] : {benefits} Composition : {composition}{taille} Taille : {taille}.{/taille} Prix : {price} {currency}.',
  welcome_message TEXT NOT NULL DEFAULT '',
  facebook_pixel_ids JSONB NOT NULL DEFAULT '[]',
  google_analytics_ids JSONB NOT NULL DEFAULT '[]',
  statuses JSONB NOT NULL DEFAULT '[]',
  gemini_api_keys JSONB NOT NULL DEFAULT '[]',
  gemini_models JSONB NOT NULL DEFAULT '["gemini-2.5-flash"]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_config_singleton CHECK (id = true)
);

DROP TRIGGER IF EXISTS update_app_config_updated_at ON app_config;
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS composition TEXT NOT NULL DEFAULT '';
