-- Fix: profiles RLS policy had infinite recursion
-- Old policy: organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
-- This queries profiles to evaluate profiles policy = infinite recursion
--
-- New policy: user can read/update their own profile row directly

DROP POLICY IF EXISTS "org_access" ON profiles;

-- Users can read their own profile
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Users in the same org can see each other's profiles (for members list)
-- Use a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$;

CREATE POLICY "org_members_read" ON profiles
  FOR SELECT USING (organization_id = get_user_org_id());
