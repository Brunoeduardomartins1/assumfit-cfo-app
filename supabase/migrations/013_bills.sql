-- Bills (contas a pagar e receber)
CREATE TABLE IF NOT EXISTS bills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('payable', 'receivable')),
  description text NOT NULL,
  amount numeric(15,2) NOT NULL,
  due_date date NOT NULL,
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  category text,
  supplier_id uuid REFERENCES suppliers(id),
  bank_transaction_id uuid REFERENCES transactions(id),
  recurrence text CHECK (recurrence IN ('once', 'monthly', 'quarterly', 'yearly')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_bills_select" ON bills FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "org_bills_insert" ON bills FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "org_bills_update" ON bills FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "org_bills_delete" ON bills FOR DELETE USING (organization_id = get_user_org_id());
