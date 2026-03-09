/*
  # TZeen - English Coaching Management Platform Schema

  1. New Tables
    - `organizations` - SaaS multi-tenant organizations (coaching schools)
      - `id` (uuid, primary key)
      - `name` (text) - organization name
      - `created_at` (timestamptz)
    - `profiles` - User profiles linked to auth.users
      - `id` (uuid, primary key, references auth.users)
      - `organization_id` (uuid, references organizations)
      - `role` (text) - admin, coach, student
      - `full_name` (text)
      - `avatar_url` (text)
      - `created_at` (timestamptz)
    - `students` - Student records managed by coaches
      - `id` (uuid, primary key)
      - `profile_id` (uuid, references profiles)
      - `coach_id` (uuid, references profiles)
      - `organization_id` (uuid, references organizations)
      - `goal` (text)
      - `english_level` (text)
      - `textbook` (text)
      - `start_date` (date)
      - `created_at` (timestamptz)
    - `study_plans` - Study plans created by coaches
      - `id` (uuid, primary key)
      - `student_id` (uuid, references students)
      - `coach_id` (uuid, references profiles)
      - `title` (text)
      - `schedule_type` (text) - daily, weekly, monthly
      - `created_at` (timestamptz)
    - `study_plan_items` - Individual items within a study plan
      - `id` (uuid, primary key)
      - `plan_id` (uuid, references study_plans)
      - `start_time` (time)
      - `end_time` (time)
      - `day_of_week` (int) - 0-6 for weekly plans
      - `activity` (text)
      - `sort_order` (int)
    - `assignments` - Assignments from coach to student
      - `id` (uuid, primary key)
      - `student_id` (uuid, references students)
      - `coach_id` (uuid, references profiles)
      - `title` (text)
      - `textbook` (text)
      - `pages` (text)
      - `due_date` (date)
      - `submission_method` (text)
      - `status` (text) - pending, completed
      - `completed_at` (timestamptz)
      - `created_at` (timestamptz)
    - `study_sessions` - Time tracking for student study
      - `id` (uuid, primary key)
      - `student_id` (uuid, references students)
      - `started_at` (timestamptz)
      - `ended_at` (timestamptz)
      - `duration_minutes` (int)
      - `created_at` (timestamptz)
    - `curriculum_templates` - Reusable curriculum templates
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `coach_id` (uuid, references profiles)
      - `name` (text)
      - `category` (text) - TOEIC, Eiken, university
      - `duration_weeks` (int)
      - `description` (text)
      - `created_at` (timestamptz)
    - `template_items` - Items within a curriculum template
      - `id` (uuid, primary key)
      - `template_id` (uuid, references curriculum_templates)
      - `week_number` (int)
      - `activity` (text)
      - `description` (text)
      - `sort_order` (int)
    - `streaks` - Learning streak records
      - `id` (uuid, primary key)
      - `student_id` (uuid, references students)
      - `current_streak` (int)
      - `longest_streak` (int)
      - `last_activity_date` (date)
      - `updated_at` (timestamptz)
    - `weekly_goals` - Weekly goals set by coaches
      - `id` (uuid, primary key)
      - `student_id` (uuid, references students)
      - `coach_id` (uuid, references profiles)
      - `week_start` (date)
      - `study_hours_target` (numeric)
      - `description` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Policies for authenticated users based on role and ownership
*/

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id),
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'coach', 'student')),
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Students
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES profiles(id),
  organization_id uuid REFERENCES organizations(id),
  goal text DEFAULT '',
  english_level text DEFAULT 'beginner',
  textbook text DEFAULT '',
  start_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Study Plans
CREATE TABLE IF NOT EXISTS study_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES profiles(id),
  title text NOT NULL DEFAULT '',
  schedule_type text NOT NULL DEFAULT 'daily' CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;

-- Study Plan Items
CREATE TABLE IF NOT EXISTS study_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES study_plans(id) ON DELETE CASCADE,
  start_time time,
  end_time time,
  day_of_week int DEFAULT 0,
  activity text NOT NULL DEFAULT '',
  sort_order int DEFAULT 0
);
ALTER TABLE study_plan_items ENABLE ROW LEVEL SECURITY;

-- Assignments
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES profiles(id),
  title text NOT NULL DEFAULT '',
  textbook text DEFAULT '',
  pages text DEFAULT '',
  due_date date,
  submission_method text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Study Sessions
CREATE TABLE IF NOT EXISTS study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_minutes int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

-- Curriculum Templates
CREATE TABLE IF NOT EXISTS curriculum_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  coach_id uuid REFERENCES profiles(id),
  name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '' CHECK (category IN ('TOEIC', 'Eiken', 'university', 'custom')),
  duration_weeks int DEFAULT 12,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE curriculum_templates ENABLE ROW LEVEL SECURITY;

-- Template Items
CREATE TABLE IF NOT EXISTS template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES curriculum_templates(id) ON DELETE CASCADE,
  week_number int NOT NULL DEFAULT 1,
  activity text NOT NULL DEFAULT '',
  description text DEFAULT '',
  sort_order int DEFAULT 0
);
ALTER TABLE template_items ENABLE ROW LEVEL SECURITY;

-- Streaks
CREATE TABLE IF NOT EXISTS streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE UNIQUE,
  current_streak int DEFAULT 0,
  longest_streak int DEFAULT 0,
  last_activity_date date,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

-- Weekly Goals
CREATE TABLE IF NOT EXISTS weekly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES profiles(id),
  week_start date NOT NULL,
  study_hours_target numeric DEFAULT 10,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE weekly_goals ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_organization ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_students_coach ON students(coach_id);
CREATE INDEX IF NOT EXISTS idx_students_organization ON students(organization_id);
CREATE INDEX IF NOT EXISTS idx_students_profile ON students(profile_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_student ON study_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_items_plan ON study_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_assignments_student ON assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_study_sessions_student ON study_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_templates_org ON curriculum_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_template_items_template ON template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_weekly_goals_student ON weekly_goals(student_id);

-- RLS Policies

-- Organizations: members can view their org
CREATE POLICY "Members can view their organization"
  ON organizations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.organization_id = organizations.id AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert organizations"
  ON organizations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.organization_id = organizations.id AND profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.organization_id = organizations.id AND profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Profiles
CREATE POLICY "Users can view profiles in their organization"
  ON profiles FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles AS p WHERE p.id = auth.uid()
    )
    OR id = auth.uid()
  );

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Students
CREATE POLICY "Coaches can view their students"
  ON students FOR SELECT TO authenticated
  USING (
    coach_id = auth.uid()
    OR profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        AND profiles.organization_id = students.organization_id
    )
  );

CREATE POLICY "Coaches can insert students"
  ON students FOR INSERT TO authenticated
  WITH CHECK (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Coaches can update their students"
  ON students FOR UPDATE TO authenticated
  USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        AND profiles.organization_id = students.organization_id
    )
  )
  WITH CHECK (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        AND profiles.organization_id = students.organization_id
    )
  );

CREATE POLICY "Coaches can delete their students"
  ON students FOR DELETE TO authenticated
  USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        AND profiles.organization_id = students.organization_id
    )
  );

-- Study Plans
CREATE POLICY "Users can view relevant study plans"
  ON study_plans FOR SELECT TO authenticated
  USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM students WHERE students.id = study_plans.student_id AND students.profile_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert study plans"
  ON study_plans FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update their study plans"
  ON study_plans FOR UPDATE TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can delete their study plans"
  ON study_plans FOR DELETE TO authenticated
  USING (coach_id = auth.uid());

-- Study Plan Items
CREATE POLICY "Users can view study plan items"
  ON study_plan_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_items.plan_id
        AND (
          study_plans.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM students WHERE students.id = study_plans.student_id AND students.profile_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Coaches can insert study plan items"
  ON study_plan_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_items.plan_id AND study_plans.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can update study plan items"
  ON study_plan_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_items.plan_id AND study_plans.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_items.plan_id AND study_plans.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete study plan items"
  ON study_plan_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_items.plan_id AND study_plans.coach_id = auth.uid()
    )
  );

-- Assignments
CREATE POLICY "Users can view relevant assignments"
  ON assignments FOR SELECT TO authenticated
  USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM students WHERE students.id = assignments.student_id AND students.profile_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert assignments"
  ON assignments FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Users can update relevant assignments"
  ON assignments FOR UPDATE TO authenticated
  USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM students WHERE students.id = assignments.student_id AND students.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM students WHERE students.id = assignments.student_id AND students.profile_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete assignments"
  ON assignments FOR DELETE TO authenticated
  USING (coach_id = auth.uid());

-- Study Sessions
CREATE POLICY "Users can view their study sessions"
  ON study_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students WHERE students.id = study_sessions.student_id
        AND (students.profile_id = auth.uid() OR students.coach_id = auth.uid())
    )
  );

CREATE POLICY "Students can insert study sessions"
  ON study_sessions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students WHERE students.id = study_sessions.student_id AND students.profile_id = auth.uid()
    )
  );

CREATE POLICY "Students can update their study sessions"
  ON study_sessions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students WHERE students.id = study_sessions.student_id AND students.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students WHERE students.id = study_sessions.student_id AND students.profile_id = auth.uid()
    )
  );

-- Curriculum Templates
CREATE POLICY "Users can view templates in their org"
  ON curriculum_templates FOR SELECT TO authenticated
  USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.organization_id = curriculum_templates.organization_id
    )
  );

CREATE POLICY "Coaches can insert templates"
  ON curriculum_templates FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update their templates"
  ON curriculum_templates FOR UPDATE TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can delete their templates"
  ON curriculum_templates FOR DELETE TO authenticated
  USING (coach_id = auth.uid());

-- Template Items
CREATE POLICY "Users can view template items"
  ON template_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM curriculum_templates WHERE curriculum_templates.id = template_items.template_id
        AND (
          curriculum_templates.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
              AND profiles.organization_id = curriculum_templates.organization_id
          )
        )
    )
  );

CREATE POLICY "Coaches can insert template items"
  ON template_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM curriculum_templates WHERE curriculum_templates.id = template_items.template_id
        AND curriculum_templates.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can update template items"
  ON template_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM curriculum_templates WHERE curriculum_templates.id = template_items.template_id
        AND curriculum_templates.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM curriculum_templates WHERE curriculum_templates.id = template_items.template_id
        AND curriculum_templates.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete template items"
  ON template_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM curriculum_templates WHERE curriculum_templates.id = template_items.template_id
        AND curriculum_templates.coach_id = auth.uid()
    )
  );

-- Streaks
CREATE POLICY "Users can view their streaks"
  ON streaks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students WHERE students.id = streaks.student_id
        AND (students.profile_id = auth.uid() OR students.coach_id = auth.uid())
    )
  );

CREATE POLICY "Students can insert their streak"
  ON streaks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students WHERE students.id = streaks.student_id AND students.profile_id = auth.uid()
    )
  );

CREATE POLICY "Students can update their streak"
  ON streaks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students WHERE students.id = streaks.student_id AND students.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students WHERE students.id = streaks.student_id AND students.profile_id = auth.uid()
    )
  );

-- Weekly Goals
CREATE POLICY "Users can view relevant weekly goals"
  ON weekly_goals FOR SELECT TO authenticated
  USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM students WHERE students.id = weekly_goals.student_id AND students.profile_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert weekly goals"
  ON weekly_goals FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update weekly goals"
  ON weekly_goals FOR UPDATE TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can delete weekly goals"
  ON weekly_goals FOR DELETE TO authenticated
  USING (coach_id = auth.uid());

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto profile creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  END IF;
END $$;
