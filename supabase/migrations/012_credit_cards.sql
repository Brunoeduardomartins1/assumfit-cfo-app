-- Add credit card fields to bank_accounts
ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS credit_limit numeric,
  ADD COLUMN IF NOT EXISTS available_limit numeric,
  ADD COLUMN IF NOT EXISTS due_date integer,       -- day of month (1-31)
  ADD COLUMN IF NOT EXISTS closing_date integer;    -- day of month (1-31)
