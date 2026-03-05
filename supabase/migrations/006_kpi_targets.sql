-- KPI Targets table: stores target values for each KPI per month
CREATE TABLE IF NOT EXISTS kpi_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month varchar(7) NOT NULL, -- "YYYY-MM"
  kpi_key varchar(50) NOT NULL, -- "cac", "ltv", "mrr", "churn_rate", "nps"
  target_value numeric NOT NULL,
  actual_value numeric,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, month, kpi_key)
);

-- RLS
ALTER TABLE kpi_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_kpi_targets_select" ON kpi_targets
  FOR SELECT USING (organization_id = get_user_org_id());

CREATE POLICY "org_kpi_targets_insert" ON kpi_targets
  FOR INSERT WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "org_kpi_targets_update" ON kpi_targets
  FOR UPDATE USING (organization_id = get_user_org_id());

CREATE POLICY "org_kpi_targets_delete" ON kpi_targets
  FOR DELETE USING (organization_id = get_user_org_id());

-- Seed default targets for 2026 (all months)
-- These will be populated per-org when user first visits the KPI page
