-- Contracts and recurring revenue management
CREATE TABLE IF NOT EXISTS clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  email varchar(255),
  cnpj varchar(18),
  segment varchar(100),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_name varchar(100) NOT NULL,
  mrr numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  end_date date,
  renewal_date date,
  status varchar(20) NOT NULL DEFAULT 'active', -- active, churned, paused, pending
  churn_risk varchar(10) DEFAULT 'low', -- low, medium, high
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_clients_select" ON clients FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "org_clients_insert" ON clients FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "org_clients_update" ON clients FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "org_clients_delete" ON clients FOR DELETE USING (organization_id = get_user_org_id());

CREATE POLICY "org_contracts_select" ON contracts FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "org_contracts_insert" ON contracts FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "org_contracts_update" ON contracts FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "org_contracts_delete" ON contracts FOR DELETE USING (organization_id = get_user_org_id());
