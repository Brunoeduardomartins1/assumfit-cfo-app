-- Generated reports storage
CREATE TABLE IF NOT EXISTS reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'board_report', -- board_report, monthly_close, custom
  title text NOT NULL,
  period varchar(7) NOT NULL, -- "YYYY-MM"
  content_html text,
  content_markdown text,
  narrative text,
  kpi_snapshot jsonb,
  generated_by text DEFAULT 'agent', -- agent, manual
  sent_at timestamptz,
  sent_to text[], -- email addresses
  created_at timestamptz DEFAULT now()
);

-- Agent action log for decision tracking
CREATE TABLE IF NOT EXISTS agent_actions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  trigger_type text NOT NULL, -- webhook, cron, manual, reaction
  trigger_id text,
  reasoning text,
  context jsonb,
  result jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'executed', 'rejected', 'failed')),
  automated boolean DEFAULT false,
  requires_approval boolean DEFAULT false,
  approved_by uuid REFERENCES profiles(id),
  executed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Autonomy settings per org
CREATE TABLE IF NOT EXISTS autonomy_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  auto_classify boolean DEFAULT true,
  auto_update_dre boolean DEFAULT true,
  auto_bill_reconcile boolean DEFAULT true,
  runway_alert_months numeric DEFAULT 3,
  variance_alert_percent numeric DEFAULT 20,
  single_transaction_limit numeric DEFAULT 50000,
  notify_email boolean DEFAULT true,
  notify_whatsapp boolean DEFAULT false,
  whatsapp_number text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_reports_all" ON reports FOR ALL USING (organization_id = get_user_org_id());
CREATE POLICY "org_agent_actions_all" ON agent_actions FOR ALL USING (organization_id = get_user_org_id());
CREATE POLICY "org_autonomy_all" ON autonomy_settings FOR ALL USING (organization_id = get_user_org_id());
