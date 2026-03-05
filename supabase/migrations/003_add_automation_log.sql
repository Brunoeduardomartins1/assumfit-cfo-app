-- Automation Run Log — tracks cron/webhook automation executions
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  run_type TEXT NOT NULL CHECK (run_type IN ('daily_digest', 'monthly_close', 'webhook_automation', 'alert_email')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_org
  ON automation_runs(organization_id, run_type, created_at DESC);

ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON automation_runs FOR ALL USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- Track when alerts were emailed
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

-- Organization notification target
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notification_email TEXT;
