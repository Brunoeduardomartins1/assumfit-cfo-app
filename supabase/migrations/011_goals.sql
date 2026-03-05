-- Goals / Metas tracking
CREATE TABLE IF NOT EXISTS goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month varchar(7) NOT NULL, -- "YYYY-MM"
  metric_key varchar(50) NOT NULL, -- "receita", "ebitda", "burn_rate", "mrr", "cac", etc.
  metric_label varchar(100) NOT NULL,
  target_value numeric NOT NULL,
  actual_value numeric,
  category varchar(50) DEFAULT 'financial', -- financial, growth, operational
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, month, metric_key)
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_goals_select" ON goals FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "org_goals_insert" ON goals FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "org_goals_update" ON goals FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "org_goals_delete" ON goals FOR DELETE USING (organization_id = get_user_org_id());
