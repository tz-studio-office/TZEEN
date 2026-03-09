/*
  # Fix coach RLS policies to work without fresh JWT

  1. Problem
    - Coach's JWT token may not contain updated app_metadata.role
    - RLS policies checking auth.jwt()->'app_metadata'->>'role' fail
    - This prevents coaches from seeing student profiles and inserting reading materials

  2. Changes
    - Drop and recreate "Coaches can view student profiles" policy
    - New policy checks BOTH JWT claim AND profiles table for role
    - Also fix reading_materials INSERT policy with same fallback

  3. Security
    - Still restricted to authenticated users
    - Coaches can only see student profiles (not other coaches/admins)
    - Reading materials INSERT still requires coach_id = auth.uid()
*/

DROP POLICY IF EXISTS "Coaches can view student profiles" ON profiles;

CREATE POLICY "Coaches can view student profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'student'
    AND (
      (auth.jwt()->'app_metadata'->>'role') = 'coach'
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'coach'
      )
    )
  );

DROP POLICY IF EXISTS "Coaches can manage reading materials" ON reading_materials;

CREATE POLICY "Coaches can manage reading materials"
  ON reading_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    coach_id = auth.uid()
    AND (
      (auth.jwt()->'app_metadata'->>'role') IN ('coach', 'admin')
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role IN ('coach', 'admin')
      )
    )
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
      AND students.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM students
      WHERE students.id = reading_materials.student_id
      AND students.coach_id = auth.uid()
    )
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Coaches can update reading materials" ON reading_materials;

CREATE POLICY "Coaches can update reading materials"
  ON reading_materials
  FOR UPDATE
  TO authenticated
  USING (
    coach_id = auth.uid()
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    coach_id = auth.uid()
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Coaches can delete reading materials" ON reading_materials;

CREATE POLICY "Coaches can delete reading materials"
  ON reading_materials
  FOR DELETE
  TO authenticated
  USING (
    coach_id = auth.uid()
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Coaches can view their students" ON students;

CREATE POLICY "Coaches can view their students"
  ON students
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid()
    OR profile_id = auth.uid()
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Coaches can insert students" ON students;

CREATE POLICY "Coaches can insert students"
  ON students
  FOR INSERT
  TO authenticated
  WITH CHECK (
    coach_id = auth.uid()
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Coaches can update their students" ON students;

CREATE POLICY "Coaches can update their students"
  ON students
  FOR UPDATE
  TO authenticated
  USING (
    coach_id = auth.uid()
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    coach_id = auth.uid()
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Coaches can delete their students" ON students;

CREATE POLICY "Coaches can delete their students"
  ON students
  FOR DELETE
  TO authenticated
  USING (
    coach_id = auth.uid()
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
