/*
  # Add materials, OCR pipeline metadata, assignment test rules, and attempt tracking

  This migration adds the data model needed for:
  - R2-backed textbook/material uploads
  - OCR extraction and coach verification
  - assignment-level passing score and range rules
  - student-created custom vocabulary tests
  - per-attempt scoring and answer history
*/

-- Materials master
CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  material_type text NOT NULL DEFAULT 'vocabulary_book' CHECK (material_type IN ('vocabulary_book', 'grammar_book', 'reading', 'other')),
  publisher text,
  description text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.material_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  r2_key text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('jpeg', 'jpg', 'png', 'heic', 'pdf', 'webp')),
  page_number integer,
  upload_status text NOT NULL DEFAULT 'uploaded' CHECK (upload_status IN ('uploaded', 'processing', 'processed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.material_files ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ocr_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_file_id uuid NOT NULL REFERENCES public.material_files(id) ON DELETE CASCADE,
  engine text NOT NULL DEFAULT 'pending',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'processed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.ocr_runs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.vocabulary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  source_file_id uuid REFERENCES public.material_files(id) ON DELETE SET NULL,
  entry_no integer NOT NULL,
  english text NOT NULL,
  japanese text NOT NULL,
  part_of_speech text,
  page_number integer,
  raw_ocr_text text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, entry_no)
);
ALTER TABLE public.vocabulary_entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.grammar_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  source_file_id uuid REFERENCES public.material_files(id) ON DELETE SET NULL,
  entry_no integer,
  title text NOT NULL,
  explanation text,
  example_sentence text,
  japanese_explanation text,
  page_number integer,
  raw_ocr_text text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.grammar_entries ENABLE ROW LEVEL SECURITY;

-- Extend assignments to support material-linked tests
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS assignment_type text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS range_start integer,
  ADD COLUMN IF NOT EXISTS range_end integer,
  ADD COLUMN IF NOT EXISTS required_score integer,
  ADD COLUMN IF NOT EXISTS notes text;

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.assignments'::regclass
    AND conname LIKE '%status%check%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.assignments DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_status_check
  CHECK (status IN ('pending', 'completed', 'assigned', 'in_progress', 'cleared', 'expired'));

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.assignments'::regclass
    AND conname LIKE '%assignment_type%check%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.assignments DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_assignment_type_check
  CHECK (assignment_type IN ('vocabulary_test', 'grammar_test', 'reading', 'custom'));

CREATE TABLE IF NOT EXISTS public.assignment_test_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE REFERENCES public.assignments(id) ON DELETE CASCADE,
  test_direction text NOT NULL CHECK (test_direction IN ('ja_to_en', 'en_to_ja')),
  question_count integer NOT NULL CHECK (question_count IN (5,10,15,20,25,30,35,40,45,50)),
  shuffle_questions boolean NOT NULL DEFAULT true,
  passing_score integer NOT NULL,
  max_attempts integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assignment_test_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.student_custom_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  test_type text NOT NULL CHECK (test_type IN ('vocabulary', 'grammar')),
  title text NOT NULL,
  range_start integer,
  range_end integer,
  direction text NOT NULL CHECK (direction IN ('ja_to_en', 'en_to_ja')),
  question_count integer NOT NULL CHECK (question_count IN (5,10,15,20,25,30,35,40,45,50)),
  shuffle_questions boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.student_custom_tests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE,
  custom_test_id uuid REFERENCES public.student_custom_tests(id) ON DELETE CASCADE,
  attempt_type text NOT NULL CHECK (attempt_type IN ('assignment', 'custom')),
  score integer NOT NULL,
  total_questions integer NOT NULL,
  correct_answers integer NOT NULL,
  started_at timestamptz,
  completed_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer,
  passed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (assignment_id IS NOT NULL AND custom_test_id IS NULL AND attempt_type = 'assignment')
    OR
    (assignment_id IS NULL AND custom_test_id IS NOT NULL AND attempt_type = 'custom')
  )
);
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.test_attempt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('vocabulary', 'grammar')),
  vocabulary_entry_id uuid REFERENCES public.vocabulary_entries(id) ON DELETE SET NULL,
  grammar_entry_id uuid REFERENCES public.grammar_entries(id) ON DELETE SET NULL,
  prompt_text text NOT NULL,
  correct_answer text NOT NULL,
  user_answer text,
  is_correct boolean NOT NULL DEFAULT false,
  question_order integer NOT NULL
);
ALTER TABLE public.test_attempt_answers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.assignment_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE REFERENCES public.assignments(id) ON DELETE CASCADE,
  latest_attempt_id uuid REFERENCES public.test_attempts(id) ON DELETE SET NULL,
  attempts_count integer NOT NULL DEFAULT 0,
  best_score integer,
  passed boolean NOT NULL DEFAULT false,
  passed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assignment_progress ENABLE ROW LEVEL SECURITY;

-- timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_materials_updated_at ON public.materials;
CREATE TRIGGER trg_materials_updated_at
BEFORE UPDATE ON public.materials
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_vocab_entries_updated_at ON public.vocabulary_entries;
CREATE TRIGGER trg_vocab_entries_updated_at
BEFORE UPDATE ON public.vocabulary_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_grammar_entries_updated_at ON public.grammar_entries;
CREATE TRIGGER trg_grammar_entries_updated_at
BEFORE UPDATE ON public.grammar_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- progress rollup
CREATE OR REPLACE FUNCTION public.refresh_assignment_progress(target_assignment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  latest_id uuid;
  best_val integer;
  attempts_val integer;
  passed_val boolean;
  passed_ts timestamptz;
BEGIN
  SELECT id, score, completed_at
  INTO latest_id, best_val, passed_ts
  FROM public.test_attempts
  WHERE assignment_id = target_assignment_id
  ORDER BY completed_at DESC, created_at DESC
  LIMIT 1;

  SELECT COUNT(*), MAX(score), COALESCE(bool_or(passed), false), MIN(completed_at) FILTER (WHERE passed)
  INTO attempts_val, best_val, passed_val, passed_ts
  FROM public.test_attempts
  WHERE assignment_id = target_assignment_id;

  INSERT INTO public.assignment_progress (assignment_id, latest_attempt_id, attempts_count, best_score, passed, passed_at, updated_at)
  VALUES (target_assignment_id, latest_id, COALESCE(attempts_val, 0), best_val, COALESCE(passed_val, false), passed_ts, now())
  ON CONFLICT (assignment_id)
  DO UPDATE SET
    latest_attempt_id = EXCLUDED.latest_attempt_id,
    attempts_count = EXCLUDED.attempts_count,
    best_score = EXCLUDED.best_score,
    passed = EXCLUDED.passed,
    passed_at = EXCLUDED.passed_at,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_test_attempt_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignment_id IS NOT NULL THEN
    PERFORM public.refresh_assignment_progress(NEW.assignment_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_test_attempt_progress ON public.test_attempts;
CREATE TRIGGER trg_test_attempt_progress
AFTER INSERT OR UPDATE ON public.test_attempts
FOR EACH ROW EXECUTE FUNCTION public.handle_test_attempt_progress();

-- indexes
CREATE INDEX IF NOT EXISTS idx_materials_org ON public.materials(organization_id);
CREATE INDEX IF NOT EXISTS idx_materials_created_by ON public.materials(created_by);
CREATE INDEX IF NOT EXISTS idx_material_files_material ON public.material_files(material_id);
CREATE INDEX IF NOT EXISTS idx_material_files_status ON public.material_files(upload_status);
CREATE INDEX IF NOT EXISTS idx_ocr_runs_file ON public.ocr_runs(material_file_id);
CREATE INDEX IF NOT EXISTS idx_vocab_entries_material_entry ON public.vocabulary_entries(material_id, entry_no);
CREATE INDEX IF NOT EXISTS idx_grammar_entries_material ON public.grammar_entries(material_id);
CREATE INDEX IF NOT EXISTS idx_assignments_material ON public.assignments(material_id);
CREATE INDEX IF NOT EXISTS idx_assignments_type ON public.assignments(assignment_type);
CREATE INDEX IF NOT EXISTS idx_student_custom_tests_student ON public.student_custom_tests(student_id);
CREATE INDEX IF NOT EXISTS idx_student_custom_tests_material ON public.student_custom_tests(material_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_student ON public.test_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_assignment ON public.test_attempts(assignment_id);
CREATE INDEX IF NOT EXISTS idx_test_attempt_answers_attempt ON public.test_attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_assignment_progress_assignment ON public.assignment_progress(assignment_id);

-- RLS policies
CREATE POLICY "Coaches and admins can manage materials"
  ON public.materials
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid() OR public.get_my_role() = 'admin'
  )
  WITH CHECK (
    created_by = auth.uid() OR public.get_my_role() = 'admin'
  );

CREATE POLICY "Students can view org materials"
  ON public.materials
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.profile_id = auth.uid()
        AND s.organization_id = materials.organization_id
    )
    OR created_by = auth.uid()
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "Coaches admins and assigned students can view material files"
  ON public.material_files
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.materials m
      WHERE m.id = material_files.material_id
        AND (
          m.created_by = auth.uid()
          OR public.get_my_role() = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.profile_id = auth.uid()
              AND s.organization_id = m.organization_id
          )
        )
    )
  );

CREATE POLICY "Coaches and admins can manage material files"
  ON public.material_files
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = material_files.material_id
        AND (m.created_by = auth.uid() OR public.get_my_role() = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = material_files.material_id
        AND (m.created_by = auth.uid() OR public.get_my_role() = 'admin')
    )
  );

CREATE POLICY "Coaches and admins can manage ocr runs"
  ON public.ocr_runs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.material_files mf
      JOIN public.materials m ON m.id = mf.material_id
      WHERE mf.id = ocr_runs.material_file_id
        AND (m.created_by = auth.uid() OR public.get_my_role() = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.material_files mf
      JOIN public.materials m ON m.id = mf.material_id
      WHERE mf.id = ocr_runs.material_file_id
        AND (m.created_by = auth.uid() OR public.get_my_role() = 'admin')
    )
  );

CREATE POLICY "Students can view ocr runs for their org materials"
  ON public.ocr_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.material_files mf
      JOIN public.materials m ON m.id = mf.material_id
      JOIN public.students s ON s.organization_id = m.organization_id
      WHERE mf.id = ocr_runs.material_file_id
        AND s.profile_id = auth.uid()
    )
  );

CREATE POLICY "Coaches and admins can manage vocab entries"
  ON public.vocabulary_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = vocabulary_entries.material_id
        AND (m.created_by = auth.uid() OR public.get_my_role() = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = vocabulary_entries.material_id
        AND (m.created_by = auth.uid() OR public.get_my_role() = 'admin')
    )
  );

CREATE POLICY "Students can view vocab entries for their org"
  ON public.vocabulary_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.materials m
      JOIN public.students s ON s.organization_id = m.organization_id
      WHERE m.id = vocabulary_entries.material_id
        AND s.profile_id = auth.uid()
    )
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "Coaches and admins can manage grammar entries"
  ON public.grammar_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = grammar_entries.material_id
        AND (m.created_by = auth.uid() OR public.get_my_role() = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = grammar_entries.material_id
        AND (m.created_by = auth.uid() OR public.get_my_role() = 'admin')
    )
  );

CREATE POLICY "Students can view grammar entries for their org"
  ON public.grammar_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.materials m
      JOIN public.students s ON s.organization_id = m.organization_id
      WHERE m.id = grammar_entries.material_id
        AND s.profile_id = auth.uid()
    )
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "Coaches and admins can manage assignment test rules"
  ON public.assignment_test_rules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_test_rules.assignment_id
        AND (a.coach_id = auth.uid() OR public.get_my_role() = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_test_rules.assignment_id
        AND (a.coach_id = auth.uid() OR public.get_my_role() = 'admin')
    )
  );

CREATE POLICY "Students can view assignment test rules"
  ON public.assignment_test_rules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.students s ON s.id = a.student_id
      WHERE a.id = assignment_test_rules.assignment_id
        AND s.profile_id = auth.uid()
    )
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "Students can manage their custom tests"
  ON public.student_custom_tests
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_custom_tests.student_id
        AND s.profile_id = auth.uid()
    )
    OR public.get_my_role() = 'admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_custom_tests.student_id
        AND s.profile_id = auth.uid()
    )
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "Coaches can view their students custom tests"
  ON public.student_custom_tests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_custom_tests.student_id
        AND s.coach_id = auth.uid()
    )
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "Students can manage their attempts"
  ON public.test_attempts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = test_attempts.student_id
        AND s.profile_id = auth.uid()
    )
    OR public.get_my_role() = 'admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = test_attempts.student_id
        AND s.profile_id = auth.uid()
    )
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "Coaches can view their students attempts"
  ON public.test_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = test_attempts.student_id
        AND s.coach_id = auth.uid()
    )
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "Students and coaches can view answer history"
  ON public.test_attempt_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.test_attempts ta
      JOIN public.students s ON s.id = ta.student_id
      WHERE ta.id = test_attempt_answers.attempt_id
        AND (s.profile_id = auth.uid() OR s.coach_id = auth.uid() OR public.get_my_role() = 'admin')
    )
  );

CREATE POLICY "Students can insert their answer history"
  ON public.test_attempt_answers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.test_attempts ta
      JOIN public.students s ON s.id = ta.student_id
      WHERE ta.id = test_attempt_answers.attempt_id
        AND (s.profile_id = auth.uid() OR public.get_my_role() = 'admin')
    )
  );

CREATE POLICY "Students and coaches can view assignment progress"
  ON public.assignment_progress
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.students s ON s.id = a.student_id
      WHERE a.id = assignment_progress.assignment_id
        AND (s.profile_id = auth.uid() OR s.coach_id = auth.uid() OR public.get_my_role() = 'admin')
    )
  );
