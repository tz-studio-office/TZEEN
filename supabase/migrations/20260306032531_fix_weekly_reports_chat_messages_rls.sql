/*
  # Fix weekly reports and chat messages RLS to use profiles fallback

  1. Problem
    - weekly_reports INSERT and chat_messages policies rely on stale JWT for admin check
  2. Changes
    - Add profiles fallback for admin check in these policies
*/

DROP POLICY IF EXISTS "System can create weekly reports" ON weekly_reports;

CREATE POLICY "System can create weekly reports"
  ON weekly_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = weekly_reports.student_id
      AND students.coach_id = auth.uid()
    )
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Coaches can send messages to their students" ON chat_messages;

CREATE POLICY "Coaches can send messages to their students"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM students
        WHERE students.id = chat_messages.student_id
        AND students.coach_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM students
        WHERE students.id = chat_messages.student_id
        AND students.profile_id = auth.uid()
      )
      OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Participants can view chat messages" ON chat_messages;

CREATE POLICY "Participants can view chat messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = chat_messages.student_id
      AND students.coach_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM students
      WHERE students.id = chat_messages.student_id
      AND students.profile_id = auth.uid()
    )
    OR (auth.jwt()->'app_metadata'->>'role') = 'admin'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
