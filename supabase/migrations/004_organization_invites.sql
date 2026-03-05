-- =============================================================================
-- 004: Organization Invites
-- Allows org owners/admins to invite new members by email
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_email TEXT NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  invite_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (invite_status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Indexes
CREATE INDEX idx_invites_token ON organization_invites (invite_token) WHERE invite_status = 'pending';
CREATE INDEX idx_invites_email ON organization_invites (invited_email) WHERE invite_status = 'pending';
CREATE INDEX idx_invites_org ON organization_invites (organization_id);

-- RLS
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- Members of the org can read invites
CREATE POLICY "org_members_read_invites" ON organization_invites
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Owner/admin can insert invites
CREATE POLICY "org_admin_insert_invites" ON organization_invites
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Owner/admin can update invites (revoke, accept)
CREATE POLICY "org_admin_update_invites" ON organization_invites
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Owner/admin can delete invites
CREATE POLICY "org_admin_delete_invites" ON organization_invites
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
