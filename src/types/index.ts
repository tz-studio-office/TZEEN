export type UserRole = 'admin' | 'coach' | 'student';

export interface Profile {
  id: string;
  organization_id: string | null;
  role: UserRole;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Student {
  id: string;
  profile_id: string | null;
  coach_id: string;
  organization_id: string | null;
  goal: string;
  english_level: string;
  textbook: string;
  start_date: string;
  created_at: string;
  profiles?: Profile;
}

export interface StudyPlan {
  id: string;
  student_id: string;
  coach_id: string;
  title: string;
  schedule_type: 'daily' | 'weekly' | 'monthly';
  created_at: string;
  study_plan_items?: StudyPlanItem[];
}

export interface StudyPlanItem {
  id: string;
  plan_id: string;
  start_time: string | null;
  end_time: string | null;
  day_of_week: number;
  activity: string;
  sort_order: number;
}

export interface Assignment {
  id: string;
  student_id: string;
  coach_id: string;
  title: string;
  textbook: string;
  pages: string;
  due_date: string | null;
  submission_method: string;
  status: 'pending' | 'completed' | 'assigned' | 'in_progress' | 'cleared' | 'expired';
  completed_at: string | null;
  created_at: string;
  assignment_type?: 'vocabulary_test' | 'grammar_test' | 'reading' | 'custom';
  material_id?: string | null;
  range_start?: number | null;
  range_end?: number | null;
  required_score?: number | null;
  notes?: string | null;
}

export interface StudySession {
  id: string;
  student_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  created_at: string;
}

export interface CurriculumTemplate {
  id: string;
  organization_id: string | null;
  coach_id: string;
  name: string;
  category: 'TOEIC' | 'Eiken' | 'university' | 'custom';
  duration_weeks: number;
  description: string;
  created_at: string;
  template_items?: TemplateItem[];
}

export interface TemplateItem {
  id: string;
  template_id: string;
  week_number: number;
  activity: string;
  description: string;
  sort_order: number;
}

export interface Streak {
  id: string;
  student_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  updated_at: string;
}

export interface WeeklyGoal {
  id: string;
  student_id: string;
  coach_id: string;
  week_start: string;
  study_hours_target: number;
  description: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  student_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender?: Profile;
}

export interface ReadingMaterial {
  id: string;
  coach_id: string | null;
  student_id: string | null;
  title: string;
  content: string;
  difficulty: string;
  created_at: string;
}

export interface ReadingSession {
  id: string;
  student_id: string;
  material_id: string;
  duration_seconds: number;
  score: number | null;
  feedback: string | null;
  created_at: string;
  reading_materials?: ReadingMaterial;
}

export interface VocabTest {
  id: string;
  student_id: string;
  total_questions: number;
  correct_answers: number;
  word_range: string;
  created_at: string;
}

export interface GrammarTest {
  id: string;
  student_id: string;
  total_questions: number;
  correct_answers: number;
  topic: string;
  created_at: string;
}

export interface WeeklyReport {
  id: string;
  student_id: string;
  week_start: string;
  study_hours: number;
  vocab_accuracy: number | null;
  grammar_accuracy: number | null;
  reading_score: number | null;
  streak_days: number;
  summary: string;
  created_at: string;
}

export interface StudentLevel {
  id: string;
  student_id: string;
  level: number;
  xp: number;
  updated_at: string;
}

export interface DailyMission {
  id: string;
  student_id: string;
  date: string;
  mission_type: 'vocab' | 'reading' | 'grammar' | 'study_time';
  target_value: number;
  current_value: number;
  completed: boolean;
  created_at: string;
}


export interface Material {
  id: string;
  organization_id: string | null;
  title: string;
  material_type: 'vocabulary_book' | 'grammar_book' | 'reading' | 'other';
  publisher: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialFile {
  id: string;
  material_id: string;
  r2_key: string;
  file_url: string;
  file_name: string;
  file_type: 'jpeg' | 'jpg' | 'png' | 'heic' | 'pdf' | 'webp';
  page_number: number | null;
  upload_status: 'uploaded' | 'processing' | 'processed' | 'failed';
  created_at: string;
}

export interface VocabularyEntry {
  id: string;
  material_id: string;
  source_file_id: string | null;
  entry_no: number;
  english: string;
  japanese: string;
  example_sentence: string | null;
  part_of_speech: string | null;
  page_number: number | null;
  raw_ocr_text: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface GrammarEntry {
  id: string;
  material_id: string;
  source_file_id: string | null;
  entry_no: number | null;
  title: string;
  explanation: string | null;
  example_sentence: string | null;
  japanese_explanation: string | null;
  page_number: number | null;
  raw_ocr_text: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssignmentTestRule {
  id: string;
  assignment_id: string;
  test_direction: 'ja_to_en' | 'en_to_ja';
  question_count: 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50;
  shuffle_questions: boolean;
  passing_score: number;
  max_attempts: number | null;
  created_at: string;
}

export interface StudentCustomTest {
  id: string;
  student_id: string;
  material_id: string;
  test_type: 'vocabulary' | 'grammar';
  title: string;
  range_start: number | null;
  range_end: number | null;
  direction: 'ja_to_en' | 'en_to_ja';
  question_count: 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50;
  shuffle_questions: boolean;
  created_at: string;
}

export interface TestAttempt {
  id: string;
  student_id: string;
  test_id?: string | null;
  material_id?: string | null;
  assignment_id?: string | null;
  custom_test_id?: string | null;
  attempt_type?: 'assignment' | 'custom' | string | null;
  score?: number | null;
  attempts?: number | null;
  total_questions?: number | null;
  correct_answers?: number | null;
  correct_count?: number | null;
  score_percent?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  duration_seconds?: number | null;
  passed?: boolean | null;
  status?: string | null;
  created_at: string;
}

export interface AssignmentProgress {
  id: string;
  assignment_id: string;
  latest_attempt_id: string | null;
  attempts_count: number;
  best_score: number | null;
  passed: boolean;
  passed_at: string | null;
  updated_at: string;
}


export interface VocabPracticeLog {
  id: string;
  student_id: string;
  material_id: string;
  vocabulary_entry_id: string;
  result: 'ok' | 'ng';
  response_ms: number | null;
  created_at: string;
}
