-- Notas Fiscais (invoices) table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type varchar(10) NOT NULL, -- 'emitida' or 'recebida'
  number varchar(50) NOT NULL,
  series varchar(10),
  issuer_name varchar(255),
  issuer_cnpj varchar(18),
  recipient_name varchar(255),
  recipient_cnpj varchar(18),
  issue_date date NOT NULL,
  total_value numeric NOT NULL,
  tax_value numeric DEFAULT 0,
  description text,
  xml_data text, -- raw XML content
  reconciled boolean DEFAULT false,
  transaction_id uuid REFERENCES transactions(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_invoices_select" ON invoices FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "org_invoices_insert" ON invoices FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "org_invoices_update" ON invoices FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "org_invoices_delete" ON invoices FOR DELETE USING (organization_id = get_user_org_id());
