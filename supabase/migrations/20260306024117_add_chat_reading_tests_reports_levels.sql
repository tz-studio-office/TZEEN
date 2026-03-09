/*
  # Add new feature tables for TZeen

  1. New Tables
    - `chat_messages` - Coach-student messaging
      - `id` (uuid, primary key)
      - `student_id` (uuid, FK to students)
      - `sender_id` (uuid, FK to profiles)
      - `message` (text)
      - `created_at` (timestamptz)
    - `reading_materials` - Ondoku reading texts
      - `id` (uuid, primary key)
      - `coach_id` (uuid, FK to profiles)
      - `student_id` (uuid, FK to students, nullable for shared)
      - `title` (text)
      - `content` (text)
      - `difficulty` (text)
      - `created_at` (timestamptz)
    - `reading_sessions` - Student reading practice records
      - `id` (uuid, primary key)
      - `student_id` (uuid, FK to students)
      - `material_id` (uuid, FK to reading_materials)
      - `duration_seconds` (int)
      - `score` (numeric, nullable - future AI scoring)
      - `feedback` (text, nullable)
      - `created_at` (timestamptz)
    - `vocab_tests` - Vocabulary test results
      - `id` (uuid, primary key)
      - `student_id` (uuid, FK to students)
      - `total_questions` (int)
      - `correct_answers` (int)
      - `word_range` (text)
      - `created_at` (timestamptz)
    - `grammar_tests` - Grammar test results
      - `id` (uuid, primary key)
      - `student_id` (uuid, FK to students)
      - `total_questions` (int)
      - `correct_answers` (int)
      - `topic` (text)
      - `created_at` (timestamptz)
    - `weekly_reports` - AI-generated weekly reports
      - `id` (uuid, primary key)
      - `student_id` (uuid, FK to students)
      - `week_start` (date)
      - `study_hours` (numeric)
      - `vocab_accuracy` (numeric, nullable)
      - `grammar_accuracy` (numeric, nullable)
      - `reading_score` (numeric, nullable)
      - `streak_days` (int)
      - `summary` (text)
      - `created_at` (timestamptz)
    - `student_levels` - Student progression levels
      - `id` (uuid, primary key)
      - `student_id` (uuid, FK to students, unique)
      - `level` (int, default 1)
      - `xp` (int, default 0)
      - `updated_at` (timestamptz)
    - `daily_missions` - Daily task tracking
      - `id` (uuid, primary key)
      - `student_id` (uuid, FK to students)
      - `date` (date)
      - `mission_type` (text: vocab, reading, grammar, study_time)
      - `target_value` (int)
      - `current_value` (int, default 0)
      - `completed` (boolean, default false)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Policies for coaches to manage their students' data
    - Policies for students to view/create their own data
    - Admin global access via app_metadata role check
*/

-- chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can send messages to their students"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.coach_id = auth.uid())
      OR EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
      OR ((auth.jwt()->'app_metadata'->>'role') = 'admin')
    )
  );

CREATE POLICY "Participants can view chat messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.coach_id = auth.uid())
    OR EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
    OR ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  );

CREATE POLICY "Admins can delete chat messages"
  ON chat_messages FOR DELETE
  TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- reading_materials
CREATE TABLE IF NOT EXISTS reading_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'intermediate',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reading_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage reading materials"
  ON reading_materials FOR INSERT
  TO authenticated
  WITH CHECK (
    coach_id = auth.uid()
    OR ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  );

CREATE POLICY "Coaches can update reading materials"
  ON reading_materials FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid() OR ((auth.jwt()->'app_metadata'->>'role') = 'admin'))
  WITH CHECK (coach_id = auth.uid() OR ((auth.jwt()->'app_metadata'->>'role') = 'admin'));

CREATE POLICY "Coaches and students can view reading materials"
  ON reading_materials FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid()
    OR student_id IS NULL
    OR EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.coach_id = auth.uid())
    OR ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  );

CREATE POLICY "Coaches can delete reading materials"
  ON reading_materials FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid() OR ((auth.jwt()->'app_metadata'->>'role') = 'admin'));

-- reading_sessions
CREATE TABLE IF NOT EXISTS reading_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  material_id uuid REFERENCES reading_materials(id) ON DELETE CASCADE,
  duration_seconds int NOT NULL DEFAULT 0,
  score numeric,
  feedback text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can create reading sessions"
  ON reading_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
  );

CREATE POLICY "Students and coaches can view reading sessions"
  ON reading_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.coach_id = auth.uid())
    OR ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  );

-- vocab_tests
CREATE TABLE IF NOT EXISTS vocab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  total_questions int NOT NULL DEFAULT 0,
  correct_answers int NOT NULL DEFAULT 0,
  word_range text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vocab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can create vocab tests"
  ON vocab_tests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
  );

CREATE POLICY "Students and coaches can view vocab tests"
  ON vocab_tests FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.coach_id = auth.uid())
    OR ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  );

-- grammar_tests
CREATE TABLE IF NOT EXISTS grammar_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  total_questions int NOT NULL DEFAULT 0,
  correct_answers int NOT NULL DEFAULT 0,
  topic text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE grammar_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can create grammar tests"
  ON grammar_tests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
  );

CREATE POLICY "Students and coaches can view grammar tests"
  ON grammar_tests FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.coach_id = auth.uid())
    OR ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  );

-- weekly_reports
CREATE TABLE IF NOT EXISTS weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  study_hours numeric NOT NULL DEFAULT 0,
  vocab_accuracy numeric,
  grammar_accuracy numeric,
  reading_score numeric,
  streak_days int NOT NULL DEFAULT 0,
  summary text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can create weekly reports"
  ON weekly_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.coach_id = auth.uid())
    OR ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  );

CREATE POLICY "Students and coaches can view reports"
  ON weekly_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.coach_id = auth.uid())
    OR ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  );

-- student_levels
CREATE TABLE IF NOT EXISTS student_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE UNIQUE,
  level int NOT NULL DEFAULT 1,
  xp int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE student_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own level"
  ON student_levels FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.coach_id = auth.uid())
    OR ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  );

CREATE POLICY "Students can upsert own level"
  ON student_levels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
  );

CREATE POLICY "Students can update own level"
  ON student_levels FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid()));

-- daily_missions
CREATE TABLE IF NOT EXISTS daily_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  mission_type text NOT NULL DEFAULT 'study_time',
  target_value int NOT NULL DEFAULT 1,
  current_value int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, date, mission_type)
);

ALTER TABLE daily_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own missions"
  ON daily_missions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.coach_id = auth.uid())
    OR ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  );

CREATE POLICY "Students can create own missions"
  ON daily_missions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.coach_id = auth.uid())
    OR ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  );

CREATE POLICY "Students can update own missions"
  ON daily_missions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
    OR ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM students WHERE students.id = student_id AND students.profile_id = auth.uid())
    OR ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  );
