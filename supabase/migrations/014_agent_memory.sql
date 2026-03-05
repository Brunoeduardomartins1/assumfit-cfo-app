-- Agent memory for learning and context
CREATE TABLE IF NOT EXISTS agent_memory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  memory_type text NOT NULL CHECK (memory_type IN ('decision', 'pattern', 'context', 'learning')),
  key text NOT NULL,
  value jsonb NOT NULL,
  confidence numeric(3,2) DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX idx_agent_memory_org_type ON agent_memory(organization_id, memory_type);
CREATE INDEX idx_agent_memory_org_key ON agent_memory(organization_id, key);

ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_agent_memory_select" ON agent_memory FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "org_agent_memory_insert" ON agent_memory FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "org_agent_memory_update" ON agent_memory FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "org_agent_memory_delete" ON agent_memory FOR DELETE USING (organization_id = get_user_org_id());
