-- ASSUMFIT CFO - Initial Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations (multi-tenant)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (extends Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  full_name TEXT,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chart of Accounts (hierarchical)
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  parent_code TEXT,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense', 'capital', 'financial', 'adjustment')),
  phase TEXT,
  is_summary BOOLEAN DEFAULT FALSE,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

-- Transactions (financial values: estimado/realizado)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  account_code TEXT NOT NULL,
  month DATE NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('estimado', 'realizado')),
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'manual' CHECK (source IN ('import', 'manual', 'open_finance', 'formula')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, account_code, month, entry_type)
);

-- Model Assumptions (Premissas)
CREATE TABLE model_assumptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  scenario_id UUID,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  value NUMERIC(15, 4) NOT NULL,
  unit TEXT DEFAULT 'percent',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, scenario_id, key)
);

-- Scenarios
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_base BOOLEAN DEFAULT FALSE,
  growth_rate NUMERIC(5, 4),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Income Statement (DRE)
CREATE TABLE income_statement (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  scenario_id UUID REFERENCES scenarios(id),
  month DATE NOT NULL,
  line_item TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, scenario_id, month, line_item)
);

-- Sales Projections
CREATE TABLE sales_projections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  product TEXT NOT NULL,
  scenario_id UUID REFERENCES scenarios(id),
  month DATE NOT NULL,
  funnel_stage TEXT NOT NULL,
  value NUMERIC(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, product, scenario_id, month, funnel_stage)
);

-- Bank Accounts (Open Finance)
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('pluggy', 'belvo')),
  provider_account_id TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_type TEXT,
  account_number TEXT,
  balance NUMERIC(15, 2),
  last_sync TIMESTAMPTZ,
  connection_status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classification Rules
CREATE TABLE classification_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  pattern TEXT NOT NULL,
  account_code TEXT NOT NULL,
  confidence NUMERIC(3, 2) DEFAULT 1.0,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget Entries
CREATE TABLE budget_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  account_code TEXT NOT NULL,
  month DATE NOT NULL,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  scenario_id UUID REFERENCES scenarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, account_code, month, scenario_id)
);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  type TEXT NOT NULL,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX idx_transactions_org_month ON transactions(organization_id, month);
CREATE INDEX idx_transactions_account ON transactions(organization_id, account_code);
CREATE INDEX idx_chart_of_accounts_org ON chart_of_accounts(organization_id);
CREATE INDEX idx_chart_of_accounts_parent ON chart_of_accounts(organization_id, parent_code);
CREATE INDEX idx_income_statement_org_month ON income_statement(organization_id, month);
CREATE INDEX idx_sales_projections_product ON sales_projections(organization_id, product);
CREATE INDEX idx_audit_log_org ON audit_log(organization_id, created_at DESC);
CREATE INDEX idx_alerts_org ON alerts(organization_id, is_read, created_at DESC);

-- Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_statement ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: organization-scoped access
CREATE POLICY "org_access" ON organizations FOR ALL USING (
  id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "org_access" ON profiles FOR ALL USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "org_access" ON chart_of_accounts FOR ALL USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "org_access" ON transactions FOR ALL USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "org_access" ON model_assumptions FOR ALL USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "org_access" ON scenarios FOR ALL USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "org_access" ON income_statement FOR ALL USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "org_access" ON sales_projections FOR ALL USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "org_access" ON bank_accounts FOR ALL USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "org_access" ON classification_rules FOR ALL USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "org_access" ON budget_entries FOR ALL USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "org_access" ON alerts FOR ALL USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "org_access" ON audit_log FOR ALL USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- Enable Realtime for collaborative editing
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
