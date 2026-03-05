-- Suppliers/vendors management
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  cnpj varchar(18),
  category varchar(100),
  contract_value numeric NOT NULL DEFAULT 0,
  payment_frequency varchar(20) DEFAULT 'monthly', -- monthly, quarterly, annual, one-time
  start_date date,
  end_date date,
  renewal_date date,
  status varchar(20) NOT NULL DEFAULT 'active', -- active, inactive, pending
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_suppliers_select" ON suppliers FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "org_suppliers_insert" ON suppliers FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "org_suppliers_update" ON suppliers FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "org_suppliers_delete" ON suppliers FOR DELETE USING (organization_id = get_user_org_id());
