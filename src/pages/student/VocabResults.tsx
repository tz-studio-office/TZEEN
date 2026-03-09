import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Material, Student, TestAttempt, VocabularyEntry } from '../../types';

type AttemptAnswer = {
  id: string;
  attempt_id: string;
  vocabulary_entry_id: string | null;
  prompt?: string | null;
  correct_answer?: string | null;
  selected_answer?: string | null;
  is_correct: boolean;
  response_ms?: number | null;
  created_at?: string | null;
};

type MaterialSummary = Material & { attemptCount: number; correctRate: number; latestAttemptAt: string | null };

function getAttemptScorePercent(attempt: TestAttempt) {
  if (typeof attempt.score_percent === 'number') return Number(attempt.score_percent);
  if (typeof attempt.score === 'number') return Number(attempt.score);
  return 0;
}

function getAttemptCorrectCount(attempt: TestAttempt) {
  if (typeof attempt.correct_count === 'number') return attempt.correct_count;
  if (typeof attempt.correct_answers === 'number') return attempt.correct_answers;
  return 0;
}

function getAttemptTotalQuestions(attempt: TestAttempt) {
  if (typeof attempt.total_questions === 'number') return attempt.total_questions;
  if (typeof attempt.attempts === 'number') return attempt.attempts;
  return 0;
}

function getAttemptPassed(attempt: TestAttempt) {
  if (typeof attempt.passed === 'boolean') return attempt.passed;
  return getAttemptScorePercent(attempt) >= 80;
}

function getAttemptFinishedAt(attempt: TestAttempt) {
  return attempt.completed_at || attempt.created_at;
}

export default function StudentVocabResultsPage() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [answersByAttempt, setAnswersByAttempt] = useState<Record<string, AttemptAnswer[]>>({});
  const [entriesById, setEntriesById] = useState<Record<string, VocabularyEntry>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) void load();
  }, [user]);

  async function load() {
    setLoading(true);
    setError('');
    const { data: studentData } = await supabase.from('students').select('*').eq('profile_id', user!.id).maybeSingle();
    if (!studentData) {
      setLoading(false);
      return;
    }
    setStudent(studentData as Student);

    const attemptsRes = await supabase.from('test_attempts').select('*').eq('student_id', studentData.id).order('completed_at', { ascending: false });
    if (attemptsRes.error) setError(attemptsRes.error.message);
    const attemptRows = (attemptsRes.data || []) as TestAttempt[];
    setAttempts(attemptRows);

    const attemptIds = attemptRows.map((a) => a.id);
    const answersRes = attemptIds.length
      ? await supabase.from('test_attempt_answers').select('*').in('attempt_id', attemptIds).order('created_at')
      : { data: [], error: null } as any;
    if (answersRes.error) setError((prev) => prev || answersRes.error.message);
    const answerRows = (answersRes.data || []) as AttemptAnswer[];

    const entryIds = Array.from(new Set(answerRows.map((r) => r.vocabulary_entry_id).filter(Boolean))) as string[];
    const entriesRes = entryIds.length ? await supabase.from('vocabulary_entries').select('*').in('id', entryIds) : { data: [], error: null } as any;
    const entryRows = (entriesRes.data || []) as VocabularyEntry[];
    const entryMap = Object.fromEntries(entryRows.map((e) => [e.id, e]));
    setEntriesById(entryMap);

    const materialIdsFromAttempts = attemptRows.map((a) => a.material_id).filter(Boolean) as string[];
    const materialIdsFromEntries = entryRows.map((e) => e.material_id);
    const materialIds = Array.from(new Set([...materialIdsFromAttempts, ...materialIdsFromEntries]));
    const materialsRes = materialIds.length ? await supabase.from('materials').select('*').in('id', materialIds).order('title') : { data: [], error: null } as any;
    const materialRows = (materialsRes.data || []) as Material[];

    const answersGrouped: Record<string, AttemptAnswer[]> = {};
    answerRows.forEach((row) => {
      answersGrouped[row.attempt_id] ??= [];
      answersGrouped[row.attempt_id].push(row);
    });
    setAnswersByAttempt(answersGrouped);

    const materialSummaries: MaterialSummary[] = materialRows.map((material) => {
      const materialAttemptIds = Array.from(new Set(attemptRows.filter((a) => a.material_id === material.id).map((a) => a.id)));
      const materialAnswerRows = answerRows.filter((row) => row.vocabulary_entry_id && entryMap[row.vocabulary_entry_id]?.material_id === material.id);
      const correctRate = materialAnswerRows.length ? materialAnswerRows.filter((row) => row.is_correct).length / materialAnswerRows.length : 0;
      const latestAttemptAt = attemptRows.find((attempt) => attempt.material_id === material.id)?.completed_at || attemptRows.find((attempt) => attempt.material_id === material.id)?.created_at || null;
      return { ...material, attemptCount: materialAttemptIds.length, correctRate, latestAttemptAt };
    });

    setMaterials(materialSummaries);
    setSelectedMaterialId((prev) => prev || materialSummaries[0]?.id || '');
    setLoading(false);
  }

  const filteredAttempts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attempts.filter((attempt) => {
      const rows = answersByAttempt[attempt.id] || [];
      const belongs = attempt.material_id === selectedMaterialId || rows.some((row) => row.vocabulary_entry_id && entriesById[row.vocabulary_entry_id]?.material_id === selectedMaterialId);
      if (!belongs) return false;
      if (!q) return true;
      return rows.some((row) => [row.prompt || '', row.correct_answer || '', row.selected_answer || ''].join(' ').toLowerCase().includes(q));
    });
  }, [attempts, answersByAttempt, entriesById, selectedMaterialId, search]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!student) return <div className="theme-surface rounded-[28px] border theme-border p-8">生徒プロフィールがまだ紐づいていません。</div>;

  return (
    <div className="space-y-8">
      <div className="theme-surface rounded-[2rem] border theme-border px-8 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link to="/vocab-test" className="inline-flex items-center gap-2 text-sm font-semibold theme-muted hover:theme-text"><ArrowLeft className="h-4 w-4" /> Vocab Test に戻る</Link>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-caps theme-muted">Student</p>
            <h1 className="mt-2 font-display text-5xl font-black tracking-[-0.06em] theme-text">Vocab Results</h1>
            <p className="mt-3 text-sm theme-muted">教材ごとに受験履歴と間違えた問題を確認できます。</p>
          </div>
        </div>
      </div>

      {error && <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <div className="theme-surface rounded-[28px] border theme-border p-4 space-y-3">
          {materials.length === 0 ? <div className="rounded-[20px] bg-black/5 px-4 py-6 text-sm theme-muted">履歴のある教材がありません。</div> : materials.map((material) => (
            <button key={material.id} type="button" onClick={() => setSelectedMaterialId(material.id)} className={`w-full rounded-[20px] border px-4 py-4 text-left ${selectedMaterialId === material.id ? 'bg-black text-white border-black' : 'theme-panel theme-border'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{material.title}</p>
                  <p className={`mt-1 text-xs ${selectedMaterialId === material.id ? 'text-white/70' : 'theme-muted'}`}>{material.attemptCount}回受験 / 正答率 {Math.round(material.correctRate * 100)}%</p>
                </div>
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="theme-surface rounded-[24px] border theme-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 theme-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="問題や回答を検索..." className="w-full rounded-[18px] border theme-border bg-transparent py-3 pl-11 pr-4 outline-none" />
            </div>
          </div>

          {filteredAttempts.length === 0 ? <div className="theme-surface rounded-[28px] border theme-border p-8 text-sm theme-muted">この教材の受験履歴はまだありません。</div> : filteredAttempts.map((attempt) => {
            const rows = (answersByAttempt[attempt.id] || []).filter((row) => row.vocabulary_entry_id && entriesById[row.vocabulary_entry_id]?.material_id === selectedMaterialId);
            const wrongRows = rows.filter((row) => !row.is_correct);
            return (
              <div key={attempt.id} className="theme-surface rounded-[28px] border theme-border p-6 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Attempt</p>
                    <h2 className="mt-2 text-2xl font-display font-black tracking-[-0.04em] theme-text">{getAttemptScorePercent(attempt)}% / {getAttemptCorrectCount(attempt)}問正解</h2>
                    <p className="mt-2 text-sm theme-muted">{new Date(getAttemptFinishedAt(attempt)).toLocaleString()}</p>
                  </div>
                  <div className={`rounded-full px-4 py-2 text-sm font-semibold ${getAttemptPassed(attempt) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{getAttemptPassed(attempt) ? 'Pass' : 'Retry'}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[18px] border theme-border px-4 py-3"><p className="text-xs theme-muted">総問題数</p><p className="mt-1 text-lg font-semibold theme-text">{getAttemptTotalQuestions(attempt)}</p></div>
                  <div className="rounded-[18px] border theme-border px-4 py-3"><p className="text-xs theme-muted">不正解数</p><p className="mt-1 text-lg font-semibold theme-text">{wrongRows.length}</p></div>
                  <div className="rounded-[18px] border theme-border px-4 py-3"><p className="text-xs theme-muted">終了時刻</p><p className="mt-1 text-lg font-semibold theme-text">{new Date(getAttemptFinishedAt(attempt)).toLocaleTimeString()}</p></div>
                </div>
                <div>
                  <p className="text-sm font-semibold theme-text">間違えた問題</p>
                  <div className="mt-3 space-y-3">
                    {wrongRows.length === 0 ? <div className="rounded-[18px] bg-emerald-50 px-4 py-4 text-sm text-emerald-700">この回は全問正解でした。</div> : wrongRows.map((row) => {
                      const entry = row.vocabulary_entry_id ? entriesById[row.vocabulary_entry_id] : null;
                      return (
                        <div key={row.id} className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-4">
                          <p className="text-xs text-red-600">No.{entry?.entry_no ?? '—'} / 回答時間 {row.response_ms != null ? `${(row.response_ms / 1000).toFixed(2)}秒` : '—'}</p>
                          <p className="mt-2 text-base font-semibold text-red-900">{row.prompt}</p>
                          <p className="mt-2 text-sm text-red-800">あなたの回答: <span className="font-semibold">{row.selected_answer || '未回答'}</span></p>
                          <p className="mt-1 text-sm text-red-800">正解: <span className="font-semibold">{row.correct_answer}</span></p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
