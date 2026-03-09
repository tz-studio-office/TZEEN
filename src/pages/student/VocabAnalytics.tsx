import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Material, Student, VocabularyEntry } from '../../types';

type AttemptAnswer = {
  id: string;
  attempt_id: string;
  vocabulary_entry_id: string | null;
  is_correct: boolean;
  response_ms?: number | null;
};

type Row = {
  entryId: string;
  materialId: string;
  materialTitle: string;
  entryNo: number;
  english: string;
  japanese: string;
  attempts: number;
  ok: number;
  ng: number;
  accuracy: number;
  avgResponseMs: number | null;
  recentMs: number | null;
};

type SortKey = 'ng_desc' | 'ng_asc' | 'accuracy_asc' | 'accuracy_desc' | 'response_slow' | 'response_fast' | 'entry_no';

export default function StudentVocabAnalyticsPage() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialId, setMaterialId] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('ng_desc');
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

    const attemptsRes = await supabase.from('test_attempts').select('id, completed_at, created_at, status').eq('student_id', studentData.id);
    const validAttemptIds = new Set(((attemptsRes.data || []) as any[]).filter((row) => row.status !== 'abandoned').map((row) => row.id));
    const answersRes = validAttemptIds.size ? await supabase.from('test_attempt_answers').select('*').in('attempt_id', Array.from(validAttemptIds)).order('created_at', { ascending: true }) : { data: [], error: null } as any;
    if (answersRes.error) setError(answersRes.error.message);
    const dedupedMap = new Map<string, AttemptAnswer>();
    ((answersRes.data || []) as AttemptAnswer[]).forEach((row) => {
      if (!row.vocabulary_entry_id) return;
      const key = `${row.attempt_id}::${row.vocabulary_entry_id}`;
      dedupedMap.set(key, row);
    });
    const answerRows = Array.from(dedupedMap.values());

    const entryIds = Array.from(new Set(answerRows.map((row) => row.vocabulary_entry_id).filter(Boolean))) as string[];
    const entriesRes = entryIds.length ? await supabase.from('vocabulary_entries').select('*').in('id', entryIds).order('entry_no') : { data: [], error: null } as any;
    const entryRows = (entriesRes.data || []) as VocabularyEntry[];
    const materialIds = Array.from(new Set(entryRows.map((entry) => entry.material_id)));
    const materialsRes = materialIds.length ? await supabase.from('materials').select('*').in('id', materialIds).order('title') : { data: [], error: null } as any;
    const materialRows = (materialsRes.data || []) as Material[];
    setMaterials(materialRows);

    const materialMap = Object.fromEntries(materialRows.map((material) => [material.id, material]));
    const grouped: Record<string, AttemptAnswer[]> = {};
    answerRows.forEach((row) => {
      if (!row.vocabulary_entry_id) return;
      grouped[row.vocabulary_entry_id] ??= [];
      grouped[row.vocabulary_entry_id].push(row);
    });

    const nextRows: Row[] = entryRows.map((entry) => {
      const stats = grouped[entry.id] || [];
      const attempts = stats.length;
      const ok = stats.filter((row) => row.is_correct).length;
      const ng = attempts - ok;
      const accuracy = attempts ? ok / attempts : 0;
      const withMs = stats.filter((row) => typeof row.response_ms === 'number' && row.response_ms !== null);
      const avgResponseMs = withMs.length ? withMs.reduce((sum, row) => sum + (row.response_ms || 0), 0) / withMs.length : null;
      const latestWithMs = withMs.length ? withMs[withMs.length - 1] : null;
      const recentMs = latestWithMs?.response_ms ?? null;
      return {
        entryId: entry.id,
        materialId: entry.material_id,
        materialTitle: materialMap[entry.material_id]?.title || 'Unknown',
        entryNo: entry.entry_no,
        english: entry.english,
        japanese: entry.japanese,
        attempts,
        ok,
        ng,
        accuracy,
        avgResponseMs,
        recentMs,
      };
    });

    setRows(nextRows);
    setLoading(false);
  }

  const filteredRows = useMemo(() => {
    let current = materialId === 'all' ? rows : rows.filter((row) => row.materialId === materialId);
    current = [...current].sort((a, b) => {
      switch (sortKey) {
        case 'ng_asc': return a.ng - b.ng;
        case 'accuracy_asc': return a.accuracy - b.accuracy;
        case 'accuracy_desc': return b.accuracy - a.accuracy;
        case 'response_slow': return (b.avgResponseMs || 0) - (a.avgResponseMs || 0);
        case 'response_fast': return (a.avgResponseMs || 0) - (b.avgResponseMs || 0);
        case 'entry_no': return a.entryNo - b.entryNo;
        case 'ng_desc':
        default: return b.ng - a.ng;
      }
    });
    return current;
  }, [rows, materialId, sortKey]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!student) return <div className="theme-surface rounded-[28px] border theme-border p-8">生徒プロフィールがまだ紐づいていません。</div>;

  return (
    <div className="space-y-8">
      <div className="theme-surface rounded-[2rem] border theme-border px-8 py-8">
        <Link to="/vocab-test" className="inline-flex items-center gap-2 text-sm font-semibold theme-muted hover:theme-text"><ArrowLeft className="h-4 w-4" /> Vocab Test に戻る</Link>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-caps theme-muted">Student</p>
        <h1 className="mt-2 font-display text-5xl font-black tracking-[-0.06em] theme-text">Vocab Analytics</h1>
        <p className="mt-3 text-sm theme-muted">単語ごとの正答数、誤答数、回答速度を確認できます。</p>
      </div>
      {error && <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="theme-surface rounded-[28px] border theme-border p-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium theme-text">
          <span>教材</span>
          <div className="relative">
            <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="theme-input w-full rounded-[18px] border theme-border px-4 py-3 appearance-none">
              <option value="all">すべての教材</option>
              {materials.map((material) => <option key={material.id} value={material.id}>{material.title}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 theme-muted" />
          </div>
        </label>
        <label className="space-y-2 text-sm font-medium theme-text">
          <span>並び替え</span>
          <div className="relative">
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="theme-input w-full rounded-[18px] border theme-border px-4 py-3 appearance-none">
              <option value="ng_desc">間違えた数が多い順</option>
              <option value="ng_asc">間違えた数が少ない順</option>
              <option value="accuracy_asc">正答率が低い順</option>
              <option value="accuracy_desc">正答率が高い順</option>
              <option value="response_slow">回答が遅い順</option>
              <option value="response_fast">回答が速い順</option>
              <option value="entry_no">単語番号順</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 theme-muted" />
          </div>
        </label>
      </div>

      <div className="theme-surface rounded-[28px] border theme-border p-4 space-y-3">
        {filteredRows.length === 0 ? <div className="rounded-[20px] bg-black/5 px-4 py-6 text-sm theme-muted">分析できるデータがまだありません。</div> : filteredRows.map((row) => (
          <div key={row.entryId} className="rounded-[20px] border theme-border p-4 grid gap-3 md:grid-cols-[100px_1fr_1fr_130px_130px_140px_140px] items-center">
            <div className="text-sm font-semibold theme-text">{row.entryNo}</div>
            <div>
              <p className="text-sm font-semibold theme-text">{row.english}</p>
              <p className="text-xs theme-muted">{row.materialTitle}</p>
            </div>
            <div className="text-sm theme-text">{row.japanese}</div>
            <div className="text-sm theme-text">{row.attempts}回</div>
            <div className="text-sm theme-text">OK {row.ok} / NG {row.ng}</div>
            <div className="text-sm theme-text">正答率 {Math.round(row.accuracy * 100)}%</div>
            <div className="text-sm theme-text">
              <div className={`font-medium ${row.avgResponseMs !== null && row.avgResponseMs > 2000 ? 'text-amber-600' : 'text-emerald-600'}`}>平均 {row.avgResponseMs !== null ? `${(row.avgResponseMs / 1000).toFixed(2)}秒` : '—'}</div>
              <div className={`mt-1 ${row.recentMs !== null && row.recentMs > 2000 ? 'text-amber-600' : 'text-emerald-600'}`}>最近 {row.recentMs !== null ? `${(row.recentMs / 1000).toFixed(2)}秒` : '—'}</div>
              {row.avgResponseMs !== null && row.avgResponseMs > 2000 ? <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">注意</div> : <div className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">OK</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
