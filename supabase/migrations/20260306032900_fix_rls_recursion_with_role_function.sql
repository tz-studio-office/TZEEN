/*
  # Fix RLS recursion on profiles table

  1. Problem
    - "Coaches can view student profiles" policy queries profiles table
      from within profiles RLS policy, causing infinite recursion
    - JWT app_metadata may be stale if role was changed after token was issued

  2. Solution
    - Create a SECURITY DEFINER function to get the current user's role
      directly from profiles, bypassing RLS
    - Replace all recursive profile-based role checks with this function

  3. New Function
    - `public.get_my_role()` returns the role of the authenticated user
    - SECURITY DEFINER bypasses RLS to avoid recursion
    - Used in RLS policies instead of subqueries against profiles

  4. Updated Policies
    - profiles: "Coaches can view student profiles"
    - profiles: "Same org members can view profiles"
    - reading_materials: INSERT, SELECT, UPDATE, DELETE
    - students: SELECT, INSERT, UPDATE, DELETE
    - chat_messages: INSERT, SELECT
    - weekly_reports: INSERT
*/

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE id = auth.uid()),
    COALESCE(
      auth.jwt()->'app_metadata'->>'role',
      'student'
    )
  );
$$;

-- Fix profiles policies
DROP POLICY IF EXISTS "Coaches can view student profiles" ON profiles;

CREATE POLICY "Coaches can view student profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'student'
    AND public.get_my_role() = 'coach'
  );

DROP POLICY IF EXISTS "Same org members can view profiles" ON profiles;

CREATE POLICY "Same org members can view profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id = (
      SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Fix students policies
DROP POLICY IF EXISTS "Coaches can view their students" ON students;

CREATE POLICY "Coaches can view their students"
  ON students
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid()
    OR profile_id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "Admins can view all students" ON students;
-- merged into above

DROP POLICY IF EXISTS "Coaches can insert students" ON students;

CREATE POLICY "Coaches can insert students"
  ON students
  FOR INSERT
  TO authenticated
  WITH CHECK (
    coach_id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "Coaches can update their students" ON students;

CREATE POLICY "Coaches can update their students"
  ON students
  FOR UPDATE
  TO authenticated
  USING (
    coach_id = auth.uid()
    OR public.get_my_role() = 'admin'
  )
  WITH CHECK (
    coach_id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "Coaches can delete their students" ON students;

CREATE POLICY "Coaches can delete their students"
  ON students
  FOR DELETE
  TO authenticated
  USING (
    coach_id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

-- Fix reading_materials policies
DROP POLICY IF EXISTS "Coaches can manage reading materials" ON reading_materials;

CREATE POLICY "Coaches can manage reading materials"
  ON reading_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    coach_id = auth.uid()
  );

DROP POLICY IF EXISTS "Coaches and students can view reading materials" ON reading_materials;

CREATE POLICY "Coaches and students can view reading materials"
  ON reading_materials
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid()
    OR student_id IS NULL
    OR EXISTS (
      SELECT 1 FROM students
      WHERE students.id = reading_materials.student_id
      AND (students.profile_id = auth.uid() OR students.coach_id = auth.uid())
    )
    OR public.get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "Coaches can update reading materials" ON reading_materials;

CREATE POLICY "Coaches can update reading materials"
  ON reading_materials
  FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid() OR public.get_my_role() = 'admin')
  WITH CHECK (coach_id = auth.uid() OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Coaches can delete reading materials" ON reading_materials;

CREATE POLICY "Coaches can delete reading materials"
  ON reading_materials
  FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid() OR public.get_my_role() = 'admin');

-- Fix chat_messages policies
DROP POLICY IF EXISTS "Coaches can send messages to their students" ON chat_messages;

CREATE POLICY "Coaches can send messages to their students"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM students WHERE students.id = chat_messages.student_id AND students.coach_id = auth.uid())
      OR EXISTS (SELECT 1 FROM students WHERE students.id = chat_messages.student_id AND students.profile_id = auth.uid())
      OR public.get_my_role() = 'admin'
    )
  );

DROP POLICY IF EXISTS "Participants can view chat messages" ON chat_messages;

CREATE POLICY "Participants can view chat messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = chat_messages.student_id AND students.coach_id = auth.uid())
    OR EXISTS (SELECT 1 FROM students WHERE students.id = chat_messages.student_id AND students.profile_id = auth.uid())
    OR public.get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "Admins can delete chat messages" ON chat_messages;

CREATE POLICY "Admins can delete chat messages"
  ON chat_messages
  FOR DELETE
  TO authenticated
  USING (public.get_my_role() = 'admin');

-- Fix weekly_reports policies
DROP POLICY IF EXISTS "System can create weekly reports" ON weekly_reports;

CREATE POLICY "System can create weekly reports"
  ON weekly_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM students WHERE students.id = weekly_reports.student_id AND students.coach_id = auth.uid())
    OR public.get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "Students and coaches can view reports" ON weekly_reports;

CREATE POLICY "Students and coaches can view reports"
  ON weekly_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = weekly_reports.student_id AND students.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM students WHERE students.id = weekly_reports.student_id AND students.coach_id = auth.uid())
    OR public.get_my_role() = 'admin'
  );
