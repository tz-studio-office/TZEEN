import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../../components/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, CheckCircle2, ChevronRight, RotateCcw, Sparkles, Target, Trophy, XCircle, BarChart3, ListChecks } from 'lucide-react';
import type { Assignment, AssignmentProgress, AssignmentTestRule, Material, Student, TestAttempt, VocabularyEntry } from '../../types';

type Direction = 'ja_to_en' | 'en_to_ja';

type AssignmentRow = Assignment & {
  materials?: Pick<Material, 'id' | 'title'> | null;
  assignment_test_rules?: AssignmentTestRule | null;
  assignment_progress?: AssignmentProgress | null;
};

type Question = {
  id: string;
  prompt: string;
  answer: string;
  entry: VocabularyEntry;
  choices: string[];
};

type ResultRow = {
  question: Question;
  userAnswer: string;
  isCorrect: boolean;
  responseMs: number | null;
};

const QUESTION_COUNTS = [5, 10, 15, 20, 25, 30] as const;

function shuffleArray<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function uniqStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildChoices(entry: VocabularyEntry, allEntries: VocabularyEntry[], direction: Direction) {
  const correct = direction === 'en_to_ja' ? entry.japanese : entry.english;
  const pool = shuffleArray(
    uniqStrings(
      allEntries
        .filter((item) => item.id !== entry.id)
        .map((item) => (direction === 'en_to_ja' ? item.japanese : item.english))
    )
  )
    .filter((value) => value !== correct)
    .slice(0, 3);
  return shuffleArray(uniqStrings([correct, ...pool]));
}

export default function VocabTestPage() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderLoading, setBuilderLoading] = useState(false);
  const [mode, setMode] = useState<'builder' | 'assignment' | 'quiz' | 'result'>('builder');
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentRow | null>(null);
  const [activeCustomTestId, setActiveCustomTestId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [responseTimes, setResponseTimes] = useState<Record<string, number | null>>({});
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [questionShownAt, setQuestionShownAt] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<TestAttempt | null>(null);
  const [error, setError] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [builder, setBuilder] = useState({
    materialId: '',
    rangeStart: 1,
    rangeEnd: 50,
    direction: 'en_to_ja' as Direction,
    questionCount: 10 as 5 | 10 | 15 | 20 | 25 | 30,
  });
  const [rangeStartInput, setRangeStartInput] = useState('1');
  const [rangeEndInput, setRangeEndInput] = useState('50');

  useEffect(() => {
    if (user) void loadData();
  }, [user]);

  useEffect(() => {
    if (mode === 'quiz' && questions[currentIndex]) {
      setQuestionShownAt(Date.now());
      setSelectedChoice(null);
      setRevealed(false);
    }
  }, [mode, currentIndex, questions]);

  async function loadData() {
    setLoading(true);
    setError('');

    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('profile_id', user!.id)
      .maybeSingle();

    if (!studentData) {
      setStudent(null);
      setLoading(false);
      return;
    }

    setStudent(studentData);

    const [{ data: vocabMaterialRows }, { data: assignmentData }, attemptRes] = await Promise.all([
      supabase.from('vocabulary_entries').select('material_id, id'),
      supabase
        .from('assignments')
        .select('*, materials(id, title), assignment_test_rules(*), assignment_progress(*)')
        .eq('student_id', studentData.id)
        .eq('assignment_type', 'vocabulary_test')
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('test_attempts').select('*').eq('student_id', studentData.id).order('completed_at', { ascending: false }).limit(8),
    ]);

    const vocabMaterialIds = Array.from(new Set((vocabMaterialRows || []).map((row: any) => row.material_id).filter(Boolean)));
    let materialRows: Material[] = [];

    if (vocabMaterialIds.length) {
      let materialsQuery = supabase.from('materials').select('*').in('id', vocabMaterialIds).order('title');
      if (studentData.organization_id) materialsQuery = materialsQuery.eq('organization_id', studentData.organization_id);
      let { data: scopedMaterials, error: scopedError } = await materialsQuery;
      if ((scopedError || !scopedMaterials?.length) && studentData.organization_id) {
        const fallback = await supabase.from('materials').select('*').in('id', vocabMaterialIds).order('title');
        scopedMaterials = fallback.data || [];
      }
      materialRows = (scopedMaterials || []) as Material[];
    }

    setMaterials(materialRows);
    setAssignments((assignmentData || []) as unknown as AssignmentRow[]);
    setAttempts((attemptRes.data || []) as TestAttempt[]);
    const nextMaterialId = materialRows.find((material) => material.id === builder.materialId)?.id || materialRows[0]?.id || '';
    setBuilder((prev) => ({ ...prev, materialId: nextMaterialId }));
    setLoading(false);
  }


  const currentQuestion = questions[currentIndex];
  const progressPct = questions.length ? ((currentIndex + (revealed ? 1 : 0)) / questions.length) * 100 : 0;
  const selectedMaterial = useMemo(() => materials.find((m) => m.id === builder.materialId) || null, [materials, builder.materialId]);

  useEffect(() => {
    if (!selectedMaterial) return;
    void (async () => {
      const { data } = await supabase.from('vocabulary_entries').select('entry_no').eq('material_id', selectedMaterial.id).order('entry_no');
      const numbers = (data || []).map((row: any) => row.entry_no).filter((value: any) => typeof value === 'number');
      if (!numbers.length) return;
      const min = Math.min(...numbers);
      const max = Math.max(...numbers);
      setBuilder((prev) => ({ ...prev, rangeStart: min, rangeEnd: max }));
      setRangeStartInput(String(min));
      setRangeEndInput(String(max));
    })();
  }, [selectedMaterial?.id]);

  function normalizeBuilderRange() {
    const parsedStart = Number(rangeStartInput || '1');
    const parsedEnd = Number(rangeEndInput || rangeStartInput || '1');
    const nextStart = Number.isFinite(parsedStart) && parsedStart > 0 ? parsedStart : 1;
    const nextEnd = Number.isFinite(parsedEnd) && parsedEnd >= nextStart ? parsedEnd : nextStart;
    setBuilder((prev) => ({ ...prev, rangeStart: nextStart, rangeEnd: nextEnd }));
    setRangeStartInput(String(nextStart));
    setRangeEndInput(String(nextEnd));
    return { nextStart, nextEnd };
  }

  function getAttemptScorePercent(attempt: TestAttempt | null) {
    if (!attempt) return 0;
    if (typeof attempt.score_percent === 'number') return Number(attempt.score_percent);
    if (typeof attempt.score === 'number') return Number(attempt.score);
    return 0;
  }

  function getAttemptCorrectCount(attempt: TestAttempt | null) {
    if (!attempt) return 0;
    if (typeof attempt.correct_count === 'number') return attempt.correct_count;
    if (typeof attempt.correct_answers === 'number') return attempt.correct_answers;
    return 0;
  }

  function getAttemptTotalQuestions(attempt: TestAttempt | null) {
    if (!attempt) return questions.length;
    if (typeof attempt.total_questions === 'number') return attempt.total_questions;
    if (typeof attempt.attempts === 'number') return attempt.attempts;
    return questions.length;
  }

  function getAttemptPassed(attempt: TestAttempt | null) {
    if (!attempt) return false;
    if (typeof attempt.passed === 'boolean') return attempt.passed;
    return getAttemptScorePercent(attempt) >= (selectedAssignment?.assignment_test_rules?.passing_score ?? 80);
  }

  async function buildCustomTest() {
    if (!student || !builder.materialId) {
      setError('教材を選択してください。');
      return;
    }
    setBuilderLoading(true);
    setError('');
    const { nextStart, nextEnd } = normalizeBuilderRange();

    const { data: vocabEntries } = await supabase
      .from('vocabulary_entries')
      .select('*')
      .eq('material_id', builder.materialId)
.gte('entry_no', nextStart)
      .lte('entry_no', nextEnd)
      .order('entry_no');

    const entries = (vocabEntries || []) as VocabularyEntry[];
    if (!entries.length) {
      setError('この範囲に使える単語データがありません。先に抽出・確認をしてください。');
      setBuilderLoading(false);
      return;
    }

    const chosen = shuffleArray(entries).slice(0, Math.min(builder.questionCount, entries.length));
    const builtQuestions = chosen.map((entry) => ({
      id: entry.id,
      prompt: builder.direction === 'en_to_ja' ? entry.english : entry.japanese,
      answer: builder.direction === 'en_to_ja' ? entry.japanese : entry.english,
      entry,
      choices: buildChoices(entry, entries, builder.direction),
    }));

    setActiveCustomTestId(null);
    setSelectedAssignment(null);
    setQuestions(builtQuestions);
    setAnswers({});
    setResponseTimes({});
    setResultRows([]);
    setCurrentIndex(0);
    setStartedAt(Date.now());
    setMode('quiz');
    setBuilderLoading(false);
  }

  async function startAssignmentQuiz(assignment: AssignmentRow) {
    const rule = assignment.assignment_test_rules;
    if (!assignment.material_id || !rule) {
      setError('この課題はまだテスト条件が設定されていません。');
      return;
    }
    setBuilderLoading(true);
    setError('');
    const { nextStart, nextEnd } = normalizeBuilderRange();

    const { data: vocabEntries } = await supabase
      .from('vocabulary_entries')
      .select('*')
      .eq('material_id', assignment.material_id)
      .gte('entry_no', assignment.range_start || 1)
      .lte('entry_no', assignment.range_end || 99999)
      .order('entry_no');

    const entries = (vocabEntries || []) as VocabularyEntry[];
    if (!entries.length) {
      setError('この課題に対応する単語データがありません。');
      setBuilderLoading(false);
      return;
    }

    const chosen = (rule.shuffle_questions ? shuffleArray(entries) : [...entries]).slice(0, Math.min(rule.question_count, entries.length));
    const builtQuestions = chosen.map((entry) => ({
      id: entry.id,
      prompt: rule.test_direction === 'en_to_ja' ? entry.english : entry.japanese,
      answer: rule.test_direction === 'en_to_ja' ? entry.japanese : entry.english,
      entry,
      choices: buildChoices(entry, entries, rule.test_direction),
    }));

    setSelectedAssignment(assignment);
    setActiveCustomTestId(null);
    setQuestions(builtQuestions);
    setAnswers({});
    setResponseTimes({});
    setResultRows([]);
    setCurrentIndex(0);
    setStartedAt(Date.now());
    setMode('quiz');
    setBuilderLoading(false);
  }

  function chooseAnswer(value: string) {
    if (!currentQuestion || revealed) return;
    const elapsed = questionShownAt ? Math.max(Date.now() - questionShownAt, 0) : null;
    setSelectedChoice(value);
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    setResponseTimes((prev) => ({ ...prev, [currentQuestion.id]: elapsed }));
    setRevealed(true);
  }

  function nextAfterReveal() {
    if (!currentQuestion) return;
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }
    void finishAttempt({ ...answers, [currentQuestion.id]: selectedChoice || '' }, { ...responseTimes, [currentQuestion.id]: responseTimes[currentQuestion.id] ?? null });
  }

  async function insertAttemptWithFallback(payload: Record<string, unknown>) {
    let res = await supabase.from('test_attempts').insert(payload).select('*').single();
    if (!res.error) return res;
    if (/assignment_id|custom_test_id/.test(res.error.message)) {
      const reduced = { ...payload };
      delete (reduced as any).assignment_id;
      delete (reduced as any).custom_test_id;
      res = await supabase.from('test_attempts').insert(reduced).select('*').single();
      if (!res.error) return res;
    }
    return res;
  }

  async function insertAnswersWithFallback(payload: Record<string, unknown>[]) {
    let res = await supabase.from('test_attempt_answers').insert(payload);
    if (!res.error) return res;
    if (/response_ms/.test(res.error.message)) {
      const reduced = payload.map(({ response_ms, ...rest }) => rest);
      res = await supabase.from('test_attempt_answers').insert(reduced as any);
    }
    return res;
  }

  async function finishAttempt(finalAnswers: Record<string, string>, finalResponseTimes: Record<string, number | null>) {
    if (!student) return;

    const rows: ResultRow[] = questions.map((question) => {
      const userAnswer = finalAnswers[question.id] || '';
      const isCorrect = userAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase();
      return { question, userAnswer, isCorrect, responseMs: finalResponseTimes[question.id] ?? null };
    });

    const correctAnswers = rows.filter((row) => row.isCorrect).length;
    const score = Math.round((correctAnswers / Math.max(questions.length, 1)) * 100);
    const durationSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : null;
    const passMark = selectedAssignment?.assignment_test_rules?.passing_score ?? 80;
    const passed = score >= passMark;

    const payload = {
      student_id: student.id,
      material_id: selectedAssignment?.material_id || builder.materialId || selectedMaterial?.id || null,
      assignment_id: selectedAssignment?.id || null,
      custom_test_id: activeCustomTestId,
      score: score,
      attempts: questions.length,
      total_questions: questions.length,
      correct_count: correctAnswers,
      score_percent: score,
      completed_at: new Date().toISOString(),
      status: 'completed',
    };

    const { data: attempt, error: attemptError } = await insertAttemptWithFallback(payload);
    if (attemptError) {
      setError(attemptError.message);
      return;
    }

    const answersPayload = rows.map((row) => ({
      attempt_id: (attempt as TestAttempt).id,
      vocabulary_entry_id: row.question.entry.id,
      prompt: row.question.prompt,
      correct_answer: row.question.answer,
      selected_answer: row.userAnswer,
      is_correct: row.isCorrect,
      response_ms: row.responseMs,
    }));

    const answersInsert = await insertAnswersWithFallback(answersPayload);
    if (answersInsert.error) {
      setError(answersInsert.error.message);
    }

    setResultRows(rows);
    setLastResult(attempt as TestAttempt);
    setShowResultModal(true);
    setMode('result');
    await loadData();
  }

  function resetBuilder() {
    setMode('builder');
    setQuestions([]);
    setAnswers({});
    setResponseTimes({});
    setResultRows([]);
    setCurrentIndex(0);
    setSelectedAssignment(null);
    setActiveCustomTestId(null);
    setLastResult(null);
    setStartedAt(null);
    setSelectedChoice(null);
    setRevealed(false);
    setError('');
    setShowResultModal(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!student) {
    return <div className="theme-surface rounded-[28px] border theme-border p-8">生徒プロフィールがまだ紐づいていません。</div>;
  }

  if (mode === 'quiz' && currentQuestion) {
    const selectedIsCorrect = selectedChoice ? selectedChoice.trim().toLowerCase() === currentQuestion.answer.trim().toLowerCase() : false;
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="theme-surface rounded-[30px] border theme-border p-6 md:p-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Vocabulary test</p>
              <h1 className="font-display text-3xl font-black tracking-[-0.04em] theme-text">
                {selectedAssignment ? selectedAssignment.title : `${selectedMaterial?.title || 'Custom'} builder`}
              </h1>
            </div>
            <div className="rounded-full border theme-border px-4 py-2 text-sm font-semibold theme-text">{currentIndex + 1} / {questions.length}</div>
          </div>
          <div className="h-2 rounded-full bg-black/5 overflow-hidden">
            <div className="h-full rounded-full bg-theme-accent transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="theme-surface rounded-[30px] border theme-border p-6 md:p-8 space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Prompt</p>
              <div className="mt-4 rounded-[26px] bg-black/5 px-6 py-8">
                <p className="text-4xl md:text-5xl font-display font-black tracking-[-0.04em] theme-text break-words">{currentQuestion.prompt}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Choices</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {currentQuestion.choices.map((choice) => {
                  const isCorrectChoice = choice === currentQuestion.answer;
                  const isSelected = selectedChoice === choice;
                  let className = 'theme-panel border theme-border';
                  if (revealed) {
                    if (isCorrectChoice) className = 'border-emerald-400 bg-emerald-50 text-emerald-800';
                    else if (isSelected) className = 'border-red-400 bg-red-50 text-red-800';
                  }
                  return (
                    <button
                      key={choice}
                      type="button"
                      disabled={revealed}
                      onClick={() => chooseAnswer(choice)}
                      className={`${className} rounded-[22px] px-5 py-4 text-left text-base font-semibold transition ${revealed ? '' : 'hover:-translate-y-0.5 hover:shadow-soft'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span>{choice}</span>
                        {revealed && isCorrectChoice && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                        {revealed && isSelected && !isCorrectChoice && <XCircle className="h-5 w-5 text-red-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            {revealed && (
              <div className={`rounded-[22px] px-5 py-4 ${selectedIsCorrect ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                <div className="flex items-center gap-3 font-semibold">
                  {selectedIsCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                  {selectedIsCorrect ? '正解です。' : `不正解です。正解は「${currentQuestion.answer}」です。`}
                </div>
                <button type="button" onClick={nextAfterReveal} className="mt-4 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
                  {currentIndex + 1 < questions.length ? '次へ' : 'テスト終了'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="theme-surface rounded-[28px] border theme-border p-5">
              <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Word info</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3"><dt className="theme-muted">No.</dt><dd className="font-semibold theme-text">{currentQuestion.entry.entry_no}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="theme-muted">Part of speech</dt><dd className="font-semibold theme-text">{currentQuestion.entry.part_of_speech || '—'}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="theme-muted">Page</dt><dd className="font-semibold theme-text">{currentQuestion.entry.page_number || '—'}</dd></div>
              </dl>
            </div>
            <div className="theme-surface rounded-[28px] border theme-border p-5">
              <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Navigation</p>
              <div className="mt-4 grid gap-3">
                <button type="button" onClick={resetBuilder} className="theme-panel rounded-[20px] border theme-border px-4 py-3 text-left font-semibold">終了して戻る</button>
                <Link to="/vocab-results" className="theme-panel rounded-[20px] border theme-border px-4 py-3 font-semibold">結果一覧を見る</Link>
                <Link to="/vocab-analytics" className="theme-panel rounded-[20px] border theme-border px-4 py-3 font-semibold">分析を見る</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'result' && lastResult) {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="theme-surface rounded-[32px] border theme-border p-8 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-black text-white">
            <Trophy className="h-9 w-9" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Attempt saved</p>
          <h1 className="mt-3 font-display text-5xl font-black tracking-[-0.05em] theme-text">{getAttemptScorePercent(lastResult)}%</h1>
          <p className="mt-3 text-base theme-muted">{getAttemptCorrectCount(lastResult)} / {getAttemptTotalQuestions(lastResult)} correct</p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border theme-border px-4 py-2 text-sm font-semibold theme-text">
            <CheckCircle2 className="h-4 w-4" />
            {getAttemptPassed(lastResult) ? 'クリアしました' : '再挑戦できます'}
          </div>
        </div>

        <div className="theme-surface rounded-[28px] border theme-border p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Review</p>
              <h2 className="text-2xl font-display font-black tracking-[-0.04em] theme-text">解答結果</h2>
            </div>
            <div className="flex gap-2">
              <Link to="/vocab-results" className="theme-panel rounded-full border theme-border px-4 py-2 text-sm font-semibold">結果一覧</Link>
              <Link to="/vocab-analytics" className="theme-panel rounded-full border theme-border px-4 py-2 text-sm font-semibold">分析</Link>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {resultRows.map((row, idx) => (
              <div key={row.question.id} className={`rounded-[20px] border p-4 ${row.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-caps text-sand-500">Q{idx + 1} / No.{row.question.entry.entry_no}</p>
                    <p className="mt-2 text-lg font-semibold theme-text">{row.question.prompt}</p>
                    <p className="mt-2 text-sm theme-text">あなたの回答: <span className="font-semibold">{row.userAnswer}</span></p>
                    {!row.isCorrect && <p className="mt-1 text-sm text-red-700">正解: <span className="font-semibold">{row.question.answer}</span></p>}
                    {row.responseMs != null && <p className="mt-1 text-xs theme-muted">回答時間: {(row.responseMs / 1000).toFixed(2)}秒</p>}
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${row.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {row.isCorrect ? '○ 正解' : '✕ 不正解'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button type="button" onClick={resetBuilder} className="theme-panel rounded-[26px] border theme-border px-5 py-5 font-semibold">別のテストを作成</button>
          <button type="button" onClick={() => selectedAssignment ? startAssignmentQuiz(selectedAssignment) : buildCustomTest()} className="rounded-[26px] bg-black px-5 py-5 font-semibold text-white">もう一度挑戦する</button>
        </div>
        <Modal isOpen={showResultModal} onClose={() => setShowResultModal(false)} title="テスト結果">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border theme-border px-4 py-4"><p className="text-xs theme-muted">正答率</p><p className="mt-1 text-2xl font-black theme-text">{getAttemptScorePercent(lastResult)}%</p></div>
              <div className="rounded-2xl border theme-border px-4 py-4"><p className="text-xs theme-muted">正解数</p><p className="mt-1 text-2xl font-black theme-text">{getAttemptCorrectCount(lastResult)}</p></div>
              <div className="rounded-2xl border theme-border px-4 py-4"><p className="text-xs theme-muted">問題数</p><p className="mt-1 text-2xl font-black theme-text">{getAttemptTotalQuestions(lastResult)}</p></div>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button type="button" onClick={() => setShowResultModal(false)} className="theme-panel rounded-full border theme-border px-4 py-2 text-sm font-semibold">閉じる</button>
              <Link to="/vocab-results" className="theme-panel rounded-full border theme-border px-4 py-2 text-sm font-semibold">結果一覧を見る</Link>
              <Link to="/vocab-analytics" className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">分析を見る</Link>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Vocabulary</p>
          <h1 className="font-display text-4xl font-black tracking-[-0.05em] theme-text">Custom builder + assigned tests</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/vocab-results" className="theme-panel rounded-full border theme-border px-4 py-2 text-sm font-semibold inline-flex items-center gap-2"><ListChecks className="h-4 w-4" />結果一覧</Link>
          <Link to="/vocab-analytics" className="theme-panel rounded-full border theme-border px-4 py-2 text-sm font-semibold inline-flex items-center gap-2"><BarChart3 className="h-4 w-4" />分析</Link>
        </div>
      </div>

      {error && <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="theme-surface rounded-[30px] border theme-border p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white"><Sparkles className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Self study</p>
              <h2 className="text-2xl font-display font-black tracking-[-0.04em] theme-text">Build your own vocab test</h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium theme-text">
              <span>教材名</span>
              <select value={builder.materialId} onChange={(e) => setBuilder((prev) => ({ ...prev, materialId: e.target.value }))} className="theme-input w-full rounded-[18px] border theme-border px-4 py-3">
                <option value="">教材を選択</option>
                {materials.map((material) => <option key={material.id} value={material.id}>{material.title}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium theme-text">
              <span>方向</span>
              <select value={builder.direction} onChange={(e) => setBuilder((prev) => ({ ...prev, direction: e.target.value as Direction }))} className="theme-input w-full rounded-[18px] border theme-border px-4 py-3">
                <option value="en_to_ja">英 → 日</option>
                <option value="ja_to_en">日 → 英</option>
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium theme-text">
              <span>範囲開始</span>
              <input type="text" inputMode="numeric" value={rangeStartInput} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setRangeStartInput(e.target.value.replace(/[^0-9]/g, '') || '')} onBlur={() => { normalizeBuilderRange(); }} className="theme-input w-full rounded-[18px] border theme-border px-4 py-3" />
            </label>
            <label className="space-y-2 text-sm font-medium theme-text">
              <span>範囲終了</span>
              <input type="text" inputMode="numeric" value={rangeEndInput} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setRangeEndInput(e.target.value.replace(/[^0-9]/g, '') || '')} onBlur={() => { normalizeBuilderRange(); }} className="theme-input w-full rounded-[18px] border theme-border px-4 py-3" />
            </label>
            <label className="space-y-2 text-sm font-medium theme-text md:col-span-2">
              <span>問題数</span>
              <select value={builder.questionCount} onChange={(e) => setBuilder((prev) => ({ ...prev, questionCount: Number(e.target.value) as typeof prev.questionCount }))} className="theme-input w-full rounded-[18px] border theme-border px-4 py-3">
                {QUESTION_COUNTS.map((count) => <option key={count} value={count}>{count}問</option>)}
              </select>
            </label>
          </div>

          <button type="button" onClick={() => void buildCustomTest()} disabled={builderLoading} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 font-semibold text-white disabled:opacity-50">
            <BookOpen className="h-4 w-4" />
            {builderLoading ? '準備中...' : 'この条件でテスト開始'}
          </button>
        </section>

        <section className="space-y-4">
          <div className="theme-surface rounded-[30px] border theme-border p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-caps theme-muted">From coach</p>
                <h2 className="text-2xl font-display font-black tracking-[-0.04em] theme-text">Assigned vocab tasks</h2>
              </div>
              <div className="rounded-full border theme-border px-3 py-1 text-xs font-semibold theme-text">{assignments.length}</div>
            </div>
            <div className="mt-5 space-y-3">
              {assignments.length === 0 ? (
                <div className="rounded-[22px] bg-black/5 px-4 py-5 text-sm theme-muted">単語テスト課題はまだありません。</div>
              ) : assignments.map((assignment) => {
                const progress = assignment.assignment_progress;
                const rule = assignment.assignment_test_rules;
                return (
                  <button key={assignment.id} type="button" onClick={() => void startAssignmentQuiz(assignment)} className="theme-panel w-full rounded-[24px] border theme-border px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold theme-text">{assignment.title}</p>
                        <p className="mt-1 text-xs theme-muted">{assignment.materials?.title || '教材未設定'} / {assignment.range_start || 1} - {assignment.range_end || 'end'}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 theme-muted" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-black/5 px-3 py-1 font-semibold theme-text">必要点 {rule?.passing_score ?? assignment.required_score ?? 80}</span>
                      <span className="rounded-full bg-black/5 px-3 py-1 font-semibold theme-text">挑戦 {progress?.attempts_count ?? 0}回</span>
                      <span className="rounded-full bg-black/5 px-3 py-1 font-semibold theme-text">最高 {progress?.best_score ?? 0}点</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="theme-surface rounded-[30px] border theme-border p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white"><Target className="h-4 w-4" /></div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Recent attempts</p>
                <h2 className="text-2xl font-display font-black tracking-[-0.04em] theme-text">Latest scores</h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {attempts.length === 0 ? (
                <div className="rounded-[22px] bg-black/5 px-4 py-5 text-sm theme-muted">まだ受験履歴がありません。</div>
              ) : attempts.map((attempt) => (
                <div key={attempt.id} className="theme-panel rounded-[22px] border theme-border px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold theme-text">{attempt.score}点 / {attempt.correct_answers}問正解</p>
                      <p className="mt-1 text-xs theme-muted">{attempt.attempt_type === 'assignment' ? '課題テスト' : '自主テスト'}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${attempt.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {getAttemptPassed(attempt) ? 'Pass' : 'Retry'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
