-- Migration 002: Add pluggy_item_id to bank_accounts
-- Run this AFTER 001_initial_schema.sql in your Supabase SQL Editor

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS pluggy_item_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_pluggy_item
  ON bank_accounts(organization_id, pluggy_item_id)
  WHERE pluggy_item_id IS NOT NULL;

-- Fix classification_rules source constraint to include 'auto_learn'
ALTER TABLE classification_rules DROP CONSTRAINT IF EXISTS classification_rules_source_check;
ALTER TABLE classification_rules ADD CONSTRAINT classification_rules_source_check
  CHECK (source IN ('manual', 'ai', 'auto_learn'));
