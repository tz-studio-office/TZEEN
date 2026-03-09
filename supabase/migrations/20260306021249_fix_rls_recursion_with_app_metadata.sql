/*
  # Fix RLS Recursion on profiles table

  1. Problem
    - SELECT policies on `profiles` reference `profiles` itself in sub-queries
    - This causes RLS recursion and blocks reads for admin users

  2. Solution
    - Store `role` in `auth.users.raw_app_meta_data` so it can be read via `auth.jwt()`
    - Create a trigger to sync `profiles.role` changes to `auth.users.raw_app_meta_data`
    - Replace recursive RLS policies with `auth.jwt()` based checks

  3. Changes
    - New function: `sync_role_to_app_metadata()` - keeps app_metadata.role in sync
    - New trigger: `on_profile_role_change` on profiles table
    - Updated function: `handle_new_user()` - also sets app_metadata.role on signup
    - Replaced policies: profiles SELECT and UPDATE policies for admin
    - Replaced policies: all admin global access policies on other tables

  4. Security
    - `auth.jwt()->'app_metadata'->>'role'` cannot be modified by the user
    - Role is synced server-side via trigger only
*/

-- 1. Create function to sync role to auth.users app_metadata
CREATE OR REPLACE FUNCTION sync_role_to_app_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- 2. Create trigger on profiles for role changes
DROP TRIGGER IF EXISTS on_profile_role_change ON profiles;
CREATE TRIGGER on_profile_role_change
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_role_to_app_metadata();

-- 3. Update handle_new_user to also set app_metadata role
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
  user_name text;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.profiles (id, role, full_name)
  VALUES (NEW.id, user_role, user_name);

  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', user_role)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- 4. Sync existing profiles to app_metadata
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, role FROM public.profiles
  LOOP
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', r.role)
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- 5. Drop old recursive policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their org" ON profiles;

-- 6. Create new non-recursive policies on profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

CREATE POLICY "Same org members can view profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id = (
      SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- 7. Drop old recursive admin policies on other tables
DROP POLICY IF EXISTS "Admins can view all students" ON students;
DROP POLICY IF EXISTS "Admins can view all assignments" ON assignments;
DROP POLICY IF EXISTS "Admins can view all study plans" ON study_plans;
DROP POLICY IF EXISTS "Admins can view all study plan items" ON study_plan_items;
DROP POLICY IF EXISTS "Admins can view all study sessions" ON study_sessions;
DROP POLICY IF EXISTS "Admins can view all templates" ON curriculum_templates;
DROP POLICY IF EXISTS "Admins can view all template items" ON template_items;
DROP POLICY IF EXISTS "Admins can view all streaks" ON streaks;
DROP POLICY IF EXISTS "Admins can view all weekly goals" ON weekly_goals;
DROP POLICY IF EXISTS "Admins can view all organizations" ON organizations;

-- 8. Create new non-recursive admin policies on other tables
CREATE POLICY "Admins can view all students"
  ON students FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Admins can view all assignments"
  ON assignments FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Admins can view all study plans"
  ON study_plans FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Admins can view all study plan items"
  ON study_plan_items FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Admins can view all study sessions"
  ON study_sessions FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Admins can view all templates"
  ON curriculum_templates FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Admins can view all template items"
  ON template_items FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Admins can view all streaks"
  ON streaks FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Admins can view all weekly goals"
  ON weekly_goals FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Admins can view all organizations"
  ON organizations FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');
