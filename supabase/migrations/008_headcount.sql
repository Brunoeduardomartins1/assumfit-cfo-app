-- Headcount planning tables
CREATE TABLE IF NOT EXISTS departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  budget_monthly numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS headcount_plan (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  role_title varchar(150) NOT NULL,
  planned_start varchar(7) NOT NULL, -- "YYYY-MM"
  actual_start varchar(7),
  monthly_cost numeric NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'planned', -- planned, hired, cancelled
  employee_name varchar(255),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE headcount_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_departments_select" ON departments FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "org_departments_insert" ON departments FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "org_departments_update" ON departments FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "org_departments_delete" ON departments FOR DELETE USING (organization_id = get_user_org_id());

CREATE POLICY "org_headcount_select" ON headcount_plan FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "org_headcount_insert" ON headcount_plan FOR INSERT WITH CHECK (organization_id = get_user_org_id());
CREATE POLICY "org_headcount_update" ON headcount_plan FOR UPDATE USING (organization_id = get_user_org_id());
CREATE POLICY "org_headcount_delete" ON headcount_plan FOR DELETE USING (organization_id = get_user_org_id());
