-- EcomDash V2 - Advanced Features Migration
-- Run with: node server/db/migrate-advanced.js

-- Metas y Objetivos
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_revenue NUMERIC(15,2) NOT NULL,
  target_orders INTEGER,
  target_new_customers INTEGER,
  target_margin_percentage NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_period ON goals(period_start, period_end);

-- Costos Fijos (Break-Even)
CREATE TABLE IF NOT EXISTS fixed_costs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
  category VARCHAR(100) CHECK (category IN ('rent', 'salaries', 'utilities', 'software', 'marketing', 'other')),
  is_active BOOLEAN DEFAULT TRUE,
  start_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixed_costs_active ON fixed_costs(is_active);

-- Integraciones con plataformas
CREATE TABLE IF NOT EXISTS integrations (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('tiendanube', 'shopify', 'mercadolibre')),
  is_active BOOLEAN DEFAULT FALSE,
  credentials JSONB,
  last_sync TIMESTAMPTZ,
  sync_status VARCHAR(50) DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error', 'success')),
  sync_error TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform)
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  integration_id INTEGER REFERENCES integrations(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) CHECK (sync_type IN ('products', 'orders', 'stock', 'full')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'success', 'error')),
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_integration ON sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON sync_logs(created_at DESC);

-- Movimientos bancarios (Conciliación)
CREATE TABLE IF NOT EXISTS bank_movements (
  id SERIAL PRIMARY KEY,
  transaction_date DATE NOT NULL,
  description TEXT,
  amount NUMERIC(15,2) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')),
  reference VARCHAR(255),
  matched_sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  is_matched BOOLEAN DEFAULT FALSE,
  is_ignored BOOLEAN DEFAULT FALSE,
  notes TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_movements_date ON bank_movements(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_movements_matched ON bank_movements(is_matched);
CREATE INDEX IF NOT EXISTS idx_bank_movements_type ON bank_movements(type);

-- Insert default integrations rows (disconnected)
INSERT INTO integrations (platform, is_active, config)
VALUES
  ('tiendanube', FALSE, '{"sync_products": true, "sync_orders": true, "sync_stock": true, "auto_sync": false}'),
  ('shopify', FALSE, '{"sync_products": true, "sync_orders": true, "sync_stock": true, "auto_sync": false}'),
  ('mercadolibre', FALSE, '{"sync_products": true, "sync_orders": true, "sync_stock": true, "auto_sync": false}')
ON CONFLICT (platform) DO NOTHING;
