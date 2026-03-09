import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Search, X } from 'lucide-react';
import Modal from '../../components/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { GrammarEntry, Material, Student, VocabPracticeLog, VocabularyEntry } from '../../types';

type TabKey = 'vocabulary' | 'grammar';
type PlayStage = 'setup' | 'playing' | 'finished';

type PracticeStats = Record<string, { attempts: number; ok: number; ng: number; okRate: number }>;

export default function StudentMaterialDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [vocabEntries, setVocabEntries] = useState<VocabularyEntry[]>([]);
  const [grammarEntries, setGrammarEntries] = useState<GrammarEntry[]>([]);
  const [practiceLogs, setPracticeLogs] = useState<VocabPracticeLog[]>([]);
  const [practiceStats, setPracticeStats] = useState<PracticeStats>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('vocabulary');
  const [search, setSearch] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);
  const [excludeMastered, setExcludeMastered] = useState(true);
  const [playRangeStart, setPlayRangeStart] = useState('1');
  const [playRangeEnd, setPlayRangeEnd] = useState('9999');
  const [playStage, setPlayStage] = useState<PlayStage>('setup');
  const [playQueue, setPlayQueue] = useState<VocabularyEntry[]>([]);
  const [playIndex, setPlayIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [currentShownAt, setCurrentShownAt] = useState<number | null>(null);
  const [savingPlayResult, setSavingPlayResult] = useState(false);
  const [playError, setPlayError] = useState('');
  const [playSummary, setPlaySummary] = useState({ ok: 0, ng: 0 });

  useEffect(() => {
    if (id) void load();
  }, [id, user?.id]);

  useEffect(() => {
    if (!vocabEntries.length) return;
    const numbers = vocabEntries.map((entry) => entry.entry_no).filter((value): value is number => typeof value === 'number');
    if (!numbers.length) return;
    setPlayRangeStart(String(Math.min(...numbers)));
    setPlayRangeEnd(String(Math.max(...numbers)));
  }, [vocabEntries]);

  useEffect(() => {
    if (!playOpen || playStage !== 'playing') return;
    setShowMeaning(false);
    setCurrentShownAt(Date.now());
    const timer = window.setTimeout(() => setShowMeaning(true), 2000);
    return () => window.clearTimeout(timer);
  }, [playOpen, playStage, playIndex]);

  async function load() {
    if (!id) return;
    setLoading(true);

    const studentPromise = user
      ? supabase.from('students').select('*').eq('profile_id', user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any);

    const [studentRes, materialRes, vocabRes, grammarRes] = await Promise.all([
      studentPromise,
      supabase.from('materials').select('*').eq('id', id).single(),
      supabase.from('vocabulary_entries').select('*').eq('material_id', id).order('entry_no'),
      supabase.from('grammar_entries').select('*').eq('material_id', id).order('entry_no'),
    ]);

    const nextStudent = (studentRes.data as Student | null) || null;
    setStudent(nextStudent);
    setMaterial((materialRes.data as Material) || null);
    const nextVocab = (vocabRes.data as VocabularyEntry[]) || [];
    setVocabEntries(nextVocab);
    setGrammarEntries((grammarRes.data as GrammarEntry[]) || []);

    if (nextStudent && id) {
      const logsRes = await supabase
        .from('vocab_practice_logs')
        .select('*')
        .eq('student_id', nextStudent.id)
        .eq('material_id', id)
        .order('created_at', { ascending: false });

      const nextLogs = (logsRes.data as VocabPracticeLog[]) || [];
      setPracticeLogs(nextLogs);
      setPracticeStats(buildPracticeStats(nextLogs));
    } else {
      setPracticeLogs([]);
      setPracticeStats({});
    }

    setLoading(false);
  }

  function buildPracticeStats(logs: VocabPracticeLog[]): PracticeStats {
    const next: PracticeStats = {};
    logs.forEach((log) => {
      next[log.vocabulary_entry_id] ??= { attempts: 0, ok: 0, ng: 0, okRate: 0 };
      next[log.vocabulary_entry_id].attempts += 1;
      if (log.result === 'ok') next[log.vocabulary_entry_id].ok += 1;
      else next[log.vocabulary_entry_id].ng += 1;
    });
    Object.values(next).forEach((row) => {
      row.okRate = row.attempts ? row.ok / row.attempts : 0;
    });
    return next;
  }

  const vocabFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vocabEntries.filter((entry) => {
      if (verifiedOnly && !entry.is_verified) return false;
      if (!q) return true;
      return [String(entry.entry_no || ''), entry.english || '', entry.japanese || '', entry.example_sentence || '', entry.part_of_speech || '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [vocabEntries, search, verifiedOnly]);

  const grammarFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return grammarEntries.filter((entry) => {
      if (verifiedOnly && !entry.is_verified) return false;
      if (!q) return true;
      return [String(entry.entry_no || ''), entry.title || '', entry.explanation || '', entry.example_sentence || '', entry.japanese_explanation || '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [grammarEntries, search, verifiedOnly]);

  const currentPlayEntry = playQueue[playIndex] || null;
  const playableEntries = useMemo(() => {
    const parsedStart = Number(playRangeStart || 1);
    const parsedEnd = Number(playRangeEnd || playRangeStart || 1);
    const rangeStart = Number.isFinite(parsedStart) ? parsedStart : 1;
    const rangeEnd = Number.isFinite(parsedEnd) ? Math.max(parsedEnd, rangeStart) : rangeStart;
    const source = vocabEntries.filter((entry) => {
      if (verifiedOnly && !entry.is_verified) return false;
      const number = entry.entry_no || 0;
      return number >= rangeStart && number <= rangeEnd;
    });
    if (!excludeMastered) return source;
    return source.filter((entry) => {
      const stats = practiceStats[entry.id];
      return !(stats && stats.attempts > 0 && stats.okRate >= 0.8);
    });
  }, [vocabEntries, practiceStats, excludeMastered, verifiedOnly, playRangeStart, playRangeEnd]);

  async function startPlay() {
    setPlayError('');
    if (!playableEntries.length) {
      setPlayError('再生できる単語がありません。検索条件または除外条件を見直してください。');
      return;
    }
    const queue = [...playableEntries].sort((a, b) => (a.entry_no || 0) - (b.entry_no || 0));
    setPlayQueue(queue);
    setPlayIndex(0);
    setPlaySummary({ ok: 0, ng: 0 });
    setPlayStage('playing');
  }

  function closePlay() {
    setPlayOpen(false);
    setPlayStage('setup');
    setPlayQueue([]);
    setPlayIndex(0);
    setShowMeaning(false);
    setPlayError('');
    setSavingPlayResult(false);
  }

  async function recordPlayResult(result: 'ok' | 'ng') {
    if (!student || !material || !currentPlayEntry || savingPlayResult) return;
    setSavingPlayResult(true);
    const responseMs = currentShownAt ? Math.max(Date.now() - currentShownAt, 0) : null;

    const { data, error } = await supabase
      .from('vocab_practice_logs')
      .insert({
        student_id: student.id,
        material_id: material.id,
        vocabulary_entry_id: currentPlayEntry.id,
        result,
        response_ms: responseMs,
      })
      .select('*')
      .single();

    if (error) {
      setPlayError('学習ログの保存に失敗しました。`vocab_practice_logs` テーブルを作成してください。');
      setSavingPlayResult(false);
      return;
    }

    const created = data as VocabPracticeLog;
    const nextLogs = [created, ...practiceLogs];
    setPracticeLogs(nextLogs);
    setPracticeStats(buildPracticeStats(nextLogs));
    setPlaySummary((prev) => ({ ...prev, [result]: prev[result] + 1 }));

    if (playIndex + 1 >= playQueue.length) {
      setPlayStage('finished');
      setSavingPlayResult(false);
      return;
    }

    setPlayIndex((prev) => prev + 1);
    setSavingPlayResult(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!material) {
    return <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">教材が見つかりません。</div>;
  }

  return (
    <div className="space-y-8">
      <div className="theme-surface rounded-[2rem] border theme-border px-8 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link to="/student-materials" className="inline-flex items-center gap-2 text-sm font-semibold theme-muted hover:theme-text"><ArrowLeft className="h-4 w-4" /> Materials に戻る</Link>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-caps theme-muted">Material detail</p>
            <h1 className="mt-2 font-display text-5xl font-black tracking-[-0.06em] theme-text">{material.title}</h1>
            <p className="mt-3 text-sm theme-muted">教材ごとの単語と文法を確認できます。</p>
          </div>
          <button type="button" onClick={() => setPlayOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-soft">
            <Play className="h-4 w-4" /> 暗記プレイ
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="theme-surface rounded-[28px] border theme-border p-5"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">Vocabulary</p><p className="mt-3 font-display text-4xl font-black tracking-[-0.05em] theme-text">{vocabEntries.length}</p></div>
        <div className="theme-surface rounded-[28px] border theme-border p-5"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">Grammar</p><p className="mt-3 font-display text-4xl font-black tracking-[-0.05em] theme-text">{grammarEntries.length}</p></div>
        <div className="theme-surface rounded-[28px] border theme-border p-5"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">Verified vocab</p><p className="mt-3 font-display text-4xl font-black tracking-[-0.05em] theme-text">{vocabEntries.filter((v) => v.is_verified).length}</p></div>
        <div className="theme-surface rounded-[28px] border theme-border p-5"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">Practice attempts</p><p className="mt-3 font-display text-4xl font-black tracking-[-0.05em] theme-text">{practiceLogs.length}</p></div>
        <div className="theme-surface rounded-[28px] border theme-border p-5"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">Mastered</p><p className="mt-3 font-display text-4xl font-black tracking-[-0.05em] theme-text">{Object.values(practiceStats).filter((row) => row.attempts > 0 && row.okRate >= 0.8).length}</p></div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab('vocabulary')} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === 'vocabulary' ? 'bg-black text-white' : 'border theme-border theme-text'}`}>Vocabulary</button>
        <button type="button" onClick={() => setTab('grammar')} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === 'grammar' ? 'bg-black text-white' : 'border theme-border theme-text'}`}>Grammar</button>
      </div>

      <div className="theme-surface rounded-[2rem] border theme-border p-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 theme-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === 'vocabulary' ? '単語を検索...' : '文法を検索...'} className="w-full rounded-[1.2rem] border theme-border bg-transparent py-3 pl-11 pr-4 outline-none" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm theme-muted"><input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} /> verified のみ表示</label>
      </div>

      {tab === 'vocabulary' ? (
        <div className="theme-surface rounded-[2rem] border theme-border p-4 space-y-3">
          {vocabFiltered.length === 0 ? <div className="rounded-[1.5rem] bg-black/5 px-5 py-8 text-sm theme-muted">表示できる単語がありません。</div> : vocabFiltered.map((entry) => {
            const stats = practiceStats[entry.id] || { attempts: 0, ok: 0, ng: 0, okRate: 0 };
            return (
              <div key={entry.id} className="rounded-[1.5rem] border theme-border p-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-[90px_1fr_1fr_160px_100px]">
                  <div className="rounded-[16px] border theme-border px-3 py-2 text-sm theme-text">{entry.entry_no}</div>
                  <div className="rounded-[16px] border theme-border px-3 py-2 text-sm theme-text">{entry.english}</div>
                  <div className="rounded-[16px] border theme-border px-3 py-2 text-sm theme-text">{entry.japanese}</div>
                  <div className="rounded-[16px] border theme-border px-3 py-2 text-sm theme-text">{entry.part_of_speech || '—'}</div>
                  <div className="rounded-[16px] border theme-border px-3 py-2 text-xs theme-muted">{entry.is_verified ? 'verified' : 'draft'}</div>
                </div>
                <div className="rounded-[16px] border theme-border px-3 py-3 text-sm theme-text min-h-16">{entry.example_sentence || '例文なし'}</div>
                <div className="flex flex-wrap gap-2 text-xs theme-muted">
                  <span className="rounded-full border theme-border px-3 py-1">学習回数 {stats.attempts}</span>
                  <span className="rounded-full border theme-border px-3 py-1">OK {stats.ok}</span>
                  <span className="rounded-full border theme-border px-3 py-1">NG {stats.ng}</span>
                  <span className="rounded-full border theme-border px-3 py-1">OK率 {Math.round(stats.okRate * 100)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="theme-surface rounded-[2rem] border theme-border p-4 space-y-3">
          {grammarFiltered.length === 0 ? <div className="rounded-[1.5rem] bg-black/5 px-5 py-8 text-sm theme-muted">表示できる文法がありません。</div> : grammarFiltered.map((entry) => (
            <div key={entry.id} className="rounded-[1.5rem] border theme-border p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-[90px_1fr_120px]">
                <div className="rounded-[16px] border theme-border px-3 py-2 text-sm theme-text">{entry.entry_no || '—'}</div>
                <div className="rounded-[16px] border theme-border px-3 py-2 text-sm theme-text">{entry.title}</div>
                <div className="rounded-[16px] border theme-border px-3 py-2 text-xs theme-muted">{entry.is_verified ? 'verified' : 'draft'}</div>
              </div>
              <div className="rounded-[16px] border theme-border px-3 py-3 text-sm theme-text whitespace-pre-wrap">{entry.explanation || '説明なし'}</div>
              <div className="rounded-[16px] border theme-border px-3 py-3 text-sm theme-text whitespace-pre-wrap">{entry.example_sentence || '例文なし'}</div>
              <div className="rounded-[16px] border theme-border px-3 py-3 text-sm theme-text whitespace-pre-wrap">{entry.japanese_explanation || '日本語説明なし'}</div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={playOpen}
        onClose={closePlay}
        panelClassName="relative z-[1001] theme-surface w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2rem] border theme-border p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-caps theme-muted">Memory player</p>
            <h2 className="mt-2 text-3xl font-display font-black tracking-[-0.05em] theme-text">{material.title} プレイ</h2>
            <p className="mt-2 text-sm theme-muted">英単語を2秒表示し、その後に日本訳を表示します。OK/NG の結果は学習ログとして保存されます。</p>
          </div>
          <button type="button" onClick={closePlay} className="rounded-full border theme-border p-2 theme-text"><X className="h-5 w-5" /></button>
        </div>

        {playStage === 'setup' && (
          <div className="mt-6 space-y-5">
            <label className="inline-flex items-center gap-2 text-sm theme-muted">
              <input type="checkbox" checked={excludeMastered} onChange={(e) => setExcludeMastered(e.target.checked)} />
              OK率 80% 以上の単語を再生対象から除外
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium theme-text">
                <span>再生開始番号</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={playRangeStart}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setPlayRangeStart(e.target.value.replace(/[^0-9]/g, '') || '1')}
                  className="theme-input w-full rounded-[18px] border theme-border px-4 py-3"
                />
              </label>
              <label className="space-y-2 text-sm font-medium theme-text">
                <span>再生終了番号</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={playRangeEnd}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setPlayRangeEnd(e.target.value.replace(/[^0-9]/g, '') || playRangeStart || '1')}
                  className="theme-input w-full rounded-[18px] border theme-border px-4 py-3"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border theme-border p-4"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">再生候補</p><p className="mt-3 text-3xl font-display font-black theme-text">{playableEntries.length}</p></div>
              <div className="rounded-[1.5rem] border theme-border p-4"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">総単語数</p><p className="mt-3 text-3xl font-display font-black theme-text">{vocabEntries.length}</p></div>
              <div className="rounded-[1.5rem] border theme-border p-4"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">学習ログ</p><p className="mt-3 text-3xl font-display font-black theme-text">{practiceLogs.length}</p></div>
            </div>
            {playError && <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{playError}</div>}
            <div className="flex justify-end">
              <button type="button" onClick={startPlay} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-soft"><Play className="h-4 w-4" /> プレイ開始</button>
            </div>
          </div>
        )}

        {playStage === 'playing' && currentPlayEntry && (
          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm theme-muted">
              <span>{playIndex + 1} / {playQueue.length}</span>
              <span>OK {playSummary.ok} · NG {playSummary.ng}</span>
            </div>
            <div className="rounded-[1.75rem] border theme-border px-6 py-12 text-center">
              <p className="text-xs font-semibold uppercase tracking-caps theme-muted">English</p>
              <p className="mt-5 text-5xl font-display font-black tracking-[-0.06em] theme-text">{currentPlayEntry.english}</p>
            </div>
            <div className="rounded-[1.75rem] border theme-border px-6 py-10 text-center min-h-[200px] flex flex-col justify-center">
              <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Japanese</p>
              {showMeaning ? (
                <>
                  <p className="mt-5 text-3xl font-semibold theme-text">{currentPlayEntry.japanese}</p>
                  <p className="mt-3 text-sm theme-muted">2秒以内に分かったら OK、分からなければ NG を選んでください。</p>
                </>
              ) : (
                <p className="mt-5 text-lg theme-muted">2秒後に日本訳を表示します...</p>
              )}
            </div>
            {showMeaning && (
              <div className="flex justify-center gap-3">
                <button type="button" disabled={savingPlayResult} onClick={() => void recordPlayResult('ng')} className="rounded-full border border-red-200 px-6 py-3 text-sm font-semibold text-red-700 disabled:opacity-60">NG</button>
                <button type="button" disabled={savingPlayResult} onClick={() => void recordPlayResult('ok')} className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">OK</button>
              </div>
            )}
            {playError && <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{playError}</div>}
          </div>
        )}

        {playStage === 'finished' && (
          <div className="mt-6 space-y-5">
            <div className="rounded-[1.75rem] border theme-border px-6 py-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Session finished</p>
              <p className="mt-4 text-4xl font-display font-black tracking-[-0.05em] theme-text">プレイ完了</p>
              <p className="mt-3 text-sm theme-muted">OK {playSummary.ok} · NG {playSummary.ng}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setPlayStage('setup')} className="rounded-full border theme-border px-5 py-3 text-sm font-semibold theme-text">条件を変えて再生</button>
              <button type="button" onClick={closePlay} className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">閉じる</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
