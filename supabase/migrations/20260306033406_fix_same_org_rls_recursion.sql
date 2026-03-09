/*
  # Fix remaining RLS recursion on profiles table

  1. Problem
    - "Same org members can view profiles" policy queries profiles from within
      profiles RLS policy, causing infinite recursion

  2. Solution
    - Create a SECURITY DEFINER function to get the current user's organization_id
    - Replace recursive subquery with this function

  3. New Function
    - `public.get_my_org_id()` returns organization_id of authenticated user
*/

CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "Same org members can view profiles" ON profiles;

CREATE POLICY "Same org members can view profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id = public.get_my_org_id()
  );
