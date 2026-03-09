import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Loader2, Plus, RefreshCw, Save, Trash2, Wand2, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { GrammarEntry, Material, MaterialFile, VocabularyEntry } from '../../types';
import Modal from '../../components/Modal';

type MaterialFileExt = MaterialFile & { ocr_runs?: Array<{ id: string; status: string; error_message: string | null; created_at: string; completed_at: string | null }> };
type TabKey = 'pages' | 'vocabulary' | 'grammar' | 'review';
type PageFilterKey = 'all' | 'ready' | 'processed' | 'failed' | 'unsupported' | 'selected';
const OCR_SUPPORTED = new Set(['jpeg', 'jpg', 'png', 'webp', 'gif']);
const POS_OPTIONS = ['', 'noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'];

type VocabDraft = VocabularyEntry & { example_sentence?: string | null };

function canRunOCR(file: MaterialFile) { return OCR_SUPPORTED.has(file.file_type); }
function statusLabel(status?: string) {
  switch (status) {
    case 'processing': return 'OCR processing';
    case 'processed': return 'OCR complete';
    case 'ocr_empty': return 'OCR empty';
    case 'ocr_failed':
    case 'failed': return 'OCR failed';
    default: return 'Uploaded';
  }
}
function ensureVocabDraft(row: VocabularyEntry): VocabDraft {
  return { ...row, example_sentence: (row as any).example_sentence ?? '' };
}

export default function MaterialDetail() {
  const { id } = useParams();
  const { session } = useAuth();
  const [material, setMaterial] = useState<Material | null>(null);
  const [files, setFiles] = useState<MaterialFileExt[]>([]);
  const [vocabEntries, setVocabEntries] = useState<VocabularyEntry[]>([]);
  const [grammarEntries, setGrammarEntries] = useState<GrammarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabKey>('pages');
  const [showAppendModal, setShowAppendModal] = useState(false);
  const [appendFiles, setAppendFiles] = useState<File[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [vocabDrafts, setVocabDrafts] = useState<Record<string, VocabDraft>>({});
  const [grammarDrafts, setGrammarDrafts] = useState<Record<string, GrammarEntry>>({});
  const [selectedVocabIds, setSelectedVocabIds] = useState<string[]>([]);
  const [bulkPartOfSpeech, setBulkPartOfSpeech] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [pageFilter, setPageFilter] = useState<PageFilterKey>('all');
  const [bulkOcrProgress, setBulkOcrProgress] = useState<{ total: number; done: number; success: number; failed: number; currentFile: string | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (id) void load(); }, [id]);

  async function load() {
    if (!id) return;
    setLoading(true); setError('');
    const [materialRes, vocabRes, grammarRes, fileRes] = await Promise.all([
      supabase.from('materials').select('*').eq('id', id).single(),
      supabase.from('vocabulary_entries').select('*').eq('material_id', id).order('entry_no', { ascending: true }),
      supabase.from('grammar_entries').select('*').eq('material_id', id).order('entry_no', { ascending: true }),
      supabase.from('material_files').select('*, ocr_runs(*)').eq('material_id', id).order('page_number', { ascending: true }),
    ]);

    if (materialRes.error) { setError(materialRes.error.message); setLoading(false); return; }
    setMaterial(materialRes.data);
    setFiles((((fileRes.data as any) || []) as MaterialFileExt[]).map((row) => ({ ...row, ocr_runs: Array.isArray((row as any).ocr_runs) ? (row as any).ocr_runs : [] })));
    const vocab = (vocabRes.data as VocabularyEntry[]) || [];
    const grammar = (grammarRes.data as GrammarEntry[]) || [];
    setVocabEntries(vocab);
    setGrammarEntries(grammar);
    setVocabDrafts(Object.fromEntries(vocab.map((row) => [row.id, ensureVocabDraft(row)])));
    setGrammarDrafts(Object.fromEntries(grammar.map((row) => [row.id, row])));
    setSelectedVocabIds([]);
    setSelectedFileIds([]);
    if (vocabRes.error) setError(vocabRes.error.message);
    if (grammarRes.error) setError(grammarRes.error.message);
    if (fileRes.error) setError(fileRes.error.message);
    setLoading(false);
  }

  async function uploadSingleFile(file: File, pageNumber: number) {
    if (!session?.access_token || !id) throw new Error('Session expired. Please sign in again.');
    const body = new FormData();
    body.append('file', file);
    body.append('materialId', id);
    body.append('pageNumber', String(pageNumber));
    const response = await fetch('/api/upload-material', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || 'R2 upload failed.');
    return {
      material_id: id,
      r2_key: payload?.key || `materials/${id}/${file.name}`,
      file_url: payload?.url as string,
      file_name: file.name,
      file_type: file.name.split('.').pop()?.toLowerCase() || 'jpg',
      page_number: pageNumber,
      upload_status: 'uploaded' as const,
    };
  }

  async function appendPages(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !appendFiles.length) return;
    setSaving(true); setError('');
    try {
      const rows: any[] = [];
      const startPage = (files[files.length - 1]?.page_number || files.length || 0) + 1;
      for (const [idx, file] of appendFiles.entries()) rows.push(await uploadSingleFile(file, startPage + idx));
      const { error: insertErr } = await supabase.from('material_files').insert(rows);
      if (insertErr) throw insertErr;
      setShowAppendModal(false); setAppendFiles([]); await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ファイルアップロードに失敗しました。');
    } finally { setSaving(false); }
  }

  async function deleteFile(file: MaterialFile) {
    if (!window.confirm(`${file.file_name} を削除しますか？`)) return;
    try {
      const res = await fetch('/api/delete-material-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: file.id, r2Key: file.r2_key }) });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'ファイル削除に失敗しました。');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'ファイル削除に失敗しました。'); }
  }

  async function runOCR(file: MaterialFile) {
    if (!canRunOCR(file)) { setError(`${file.file_name} は OCR 非対応です。HEIC / HEIF は JPG か PNG に変換してください。`); return; }
    setRunningId(file.id); setError('');
    try {
      const res = await fetch('/api/process-material-ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ material_file_id: file.id }) });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'OCRの実行に失敗しました。');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'OCRの実行に失敗しました。'); }
    finally { setRunningId(null); }
  }

  function setSelectedFilesAll() {
    setSelectedFileIds(files.filter((file) => canRunOCR(file)).map((file) => file.id));
  }

  function setSelectedVisibleFiles(visible: MaterialFile[]) {
    setSelectedFileIds((prev) => Array.from(new Set([...prev, ...visible.filter((file) => canRunOCR(file)).map((file) => file.id)])));
  }

  function clearSelectedFiles() {
    setSelectedFileIds([]);
  }

  function toggleSelectedFile(fileId: string, checked: boolean) {
    setSelectedFileIds((prev) => checked ? Array.from(new Set([...prev, fileId])) : prev.filter((id) => id !== fileId));
  }

  async function runBatchOCR(targets: MaterialFile[]) {
    if (!targets.length) {
      setError('OCR対象の未処理ページがありません。');
      return;
    }

    setBulkRunning(true);
    setError('');
    setBulkOcrProgress({ total: targets.length, done: 0, success: 0, failed: 0, currentFile: null });

    const failedMessages: string[] = [];
    let success = 0;
    let failed = 0;

    try {
      for (const [index, file] of targets.entries()) {
        setBulkOcrProgress({ total: targets.length, done: index, success, failed, currentFile: file.file_name });
        try {
          const res = await fetch('/api/process-material-ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ material_file_id: file.id }) });
          const payload = await res.json().catch(() => null);
          if (!res.ok) throw new Error(payload?.error || `OCR failed on ${file.file_name}`);
          success += 1;
        } catch (e) {
          failed += 1;
          failedMessages.push(`${file.file_name}: ${e instanceof Error ? e.message : 'OCR failed'}`);
        } finally {
          setBulkOcrProgress({ total: targets.length, done: index + 1, success, failed, currentFile: file.file_name });
        }
      }

      await load();
      if (failedMessages.length) {
        setError(`一括OCR完了。成功 ${success} 件 / 失敗 ${failed} 件\n${failedMessages.slice(0, 5).join('\n')}`);
      }
    } finally {
      setBulkRunning(false);
      setBulkOcrProgress((prev) => prev ? { ...prev, currentFile: null } : null);
    }
  }

  async function runBulkOCR() {
    const targets = files.filter((f) => canRunOCR(f) && f.upload_status !== 'processed');
    await runBatchOCR(targets);
  }

  async function runSelectedOCR() {
    const targets = files.filter((f) => selectedFileIds.includes(f.id) && canRunOCR(f) && f.upload_status !== 'processed');
    if (!selectedFileIds.length) {
      setError('OCR対象ページを選択してください。');
      return;
    }
    await runBatchOCR(targets);
  }

  async function persistVocabRow(entryId: string, row: VocabDraft) {
    let payload: Record<string, unknown> = {
      entry_no: row.entry_no,
      english: row.english,
      japanese: row.japanese,
      example_sentence: row.example_sentence || '',
      part_of_speech: row.part_of_speech,
      is_verified: row.is_verified,
      updated_at: new Date().toISOString(),
    };
    let { error } = await supabase.from('vocabulary_entries').update(payload).eq('id', entryId);
    if (error && error.message.toLowerCase().includes('example_sentence')) {
      delete payload.example_sentence;
      ({ error } = await supabase.from('vocabulary_entries').update(payload).eq('id', entryId));
    }
    return error;
  }

  async function saveVocabEntry(entryId: string) {
    const row = vocabDrafts[entryId];
    const error = await persistVocabRow(entryId, row);
    if (error) { setError(error.message); return; }
    await load();
  }

  async function bulkSaveVocab() {
    const targetIds = selectedVocabIds.length ? selectedVocabIds : vocabEntries.map((entry) => entry.id);
    if (!targetIds.length) return;
    setSaving(true); setError('');
    try {
      for (const entryId of targetIds) {
        const row = vocabDrafts[entryId];
        const error = await persistVocabRow(entryId, row);
        if (error) throw error;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '一括保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  function setSelectedAll() { setSelectedVocabIds(vocabEntries.map((entry) => entry.id)); }
  function clearSelectedAll() { setSelectedVocabIds([]); }
  function toggleSelected(entryId: string, checked: boolean) {
    setSelectedVocabIds((prev) => checked ? Array.from(new Set([...prev, entryId])) : prev.filter((id) => id !== entryId));
  }
  function applyVerifiedToSelected(checked: boolean) {
    const targetIds = selectedVocabIds.length ? selectedVocabIds : vocabEntries.map((entry) => entry.id);
    setVocabDrafts((prev) => {
      const next = { ...prev };
      targetIds.forEach((id) => { next[id] = { ...next[id], is_verified: checked }; });
      return next;
    });
  }
  function applyPartOfSpeechToSelected() {
    const targetIds = selectedVocabIds.length ? selectedVocabIds : vocabEntries.map((entry) => entry.id);
    setVocabDrafts((prev) => {
      const next = { ...prev };
      targetIds.forEach((id) => { next[id] = { ...next[id], part_of_speech: bulkPartOfSpeech || null }; });
      return next;
    });
  }


  async function deleteVocabEntries(mode: 'selected' | 'all') {
    const targetIds = mode === 'selected' ? selectedVocabIds : vocabEntries.map((entry) => entry.id);
    if (!targetIds.length) { setError(mode === 'selected' ? '削除対象の単語が選択されていません。' : '削除対象の単語がありません。'); return; }
    const ok = window.confirm(mode === 'selected' ? `選択した ${targetIds.length} 件の単語を削除しますか？` : `この教材の単語 ${targetIds.length} 件をすべて削除しますか？`);
    if (!ok) return;
    setSaving(true); setError('');
    try {
      const { error } = await supabase.from('vocabulary_entries').delete().in('id', targetIds);
      if (error) throw error;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '単語の削除に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  async function saveGrammarEntry(entryId: string) {
    const row = grammarDrafts[entryId];
    const { error } = await supabase.from('grammar_entries').update({
      entry_no: row.entry_no,
      title: row.title,
      explanation: row.explanation,
      example_sentence: row.example_sentence,
      japanese_explanation: row.japanese_explanation,
      is_verified: row.is_verified,
      updated_at: new Date().toISOString(),
    }).eq('id', entryId);
    if (error) { setError(error.message); return; }
    await load();
  }

  const processedCount = useMemo(() => files.filter((f) => f.upload_status === 'processed').length, [files]);
  const readyCount = useMemo(() => files.filter((f) => canRunOCR(f) && f.upload_status !== 'processed').length, [files]);
  const failedFiles = useMemo(() => files.filter((f) => f.upload_status === 'failed' || f.upload_status === 'ocr_failed'), [files]);
  const visibleFiles = useMemo(() => {
    switch (pageFilter) {
      case 'ready':
        return files.filter((file) => canRunOCR(file) && file.upload_status !== 'processed');
      case 'processed':
        return files.filter((file) => file.upload_status === 'processed');
      case 'failed':
        return files.filter((file) => file.upload_status === 'failed' || file.upload_status === 'ocr_failed');
      case 'unsupported':
        return files.filter((file) => !canRunOCR(file));
      case 'selected':
        return files.filter((file) => selectedFileIds.includes(file.id));
      default:
        return files;
    }
  }, [files, pageFilter, selectedFileIds]);
  const visibleReadyCount = useMemo(() => visibleFiles.filter((file) => canRunOCR(file) && file.upload_status !== 'processed').length, [visibleFiles]);
  const selectedPageCount = useMemo(() => files.filter((file) => selectedFileIds.includes(file.id)).length, [files, selectedFileIds]);
  const selectedReadyPageCount = useMemo(() => files.filter((file) => selectedFileIds.includes(file.id) && canRunOCR(file) && file.upload_status !== 'processed').length, [files, selectedFileIds]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!material) return <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">教材が見つかりません。</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/materials" className="inline-flex items-center gap-2 text-sm font-semibold theme-muted hover:theme-text"><ArrowLeft className="h-4 w-4" /> Materials に戻る</Link>
          <p className="mt-3 text-xs font-semibold uppercase tracking-caps theme-muted">Material detail</p>
          <h1 className="font-display text-4xl font-black tracking-[-0.05em] theme-text">{material.title}</h1>
          <p className="mt-2 text-sm theme-muted">OCR 成果物を教材単位で確認・修正できます。</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-full border theme-border px-4 py-3 font-semibold theme-text"><RefreshCw className="h-4 w-4" /> Refresh</button>
          <button type="button" onClick={() => setShowAppendModal(true)} className="inline-flex items-center gap-2 rounded-full border theme-border px-4 py-3 font-semibold theme-text"><ImagePlus className="h-4 w-4" /> ページ追加</button>
          <button type="button" onClick={() => void runBulkOCR()} disabled={bulkRunning || readyCount === 0} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{bulkRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} OCR未処理を一括実行</button>
        </div>
      </div>

      {error && <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">{error}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="theme-surface rounded-[28px] border theme-border p-5"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">Pages</p><p className="mt-3 font-display text-4xl font-black tracking-[-0.05em] theme-text">{files.length}</p></div>
        <div className="theme-surface rounded-[28px] border theme-border p-5"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">OCR processed</p><p className="mt-3 font-display text-4xl font-black tracking-[-0.05em] theme-text">{processedCount}</p></div>
        <div className="theme-surface rounded-[28px] border theme-border p-5"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">Vocabulary rows</p><p className="mt-3 font-display text-4xl font-black tracking-[-0.05em] theme-text">{vocabEntries.length}</p></div>
        <div className="theme-surface rounded-[28px] border theme-border p-5"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">Grammar rows</p><p className="mt-3 font-display text-4xl font-black tracking-[-0.05em] theme-text">{grammarEntries.length}</p></div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['pages','vocabulary','grammar','review'] as TabKey[]).map((key) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-black text-white' : 'border theme-border theme-text'}`}>{key === 'pages' ? 'Pages' : key === 'vocabulary' ? 'Vocabulary' : key === 'grammar' ? 'Grammar' : 'OCR Review'}</button>
        ))}
      </div>

      {tab === 'pages' && (
        <div className="theme-surface rounded-[30px] border theme-border p-6 space-y-4">
          {files.length === 0 ? <div className="rounded-[20px] bg-black/5 px-5 py-8 text-sm theme-muted">まだページがありません。</div> : <>
            <div className="rounded-[22px] border theme-border p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  ['all', `すべて ${files.length}`],
                  ['ready', `OCR未処理 ${readyCount}`],
                  ['processed', `OCR済み ${processedCount}`],
                  ['failed', `失敗 ${failedFiles.length}`],
                  ['unsupported', `OCR非対応 ${files.filter((file) => !canRunOCR(file)).length}`],
                  ['selected', `選択中 ${selectedPageCount}`],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPageFilter(key as PageFilterKey)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold ${pageFilter === key ? 'bg-black text-white' : 'border theme-border theme-text'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setSelectedVisibleFiles(visibleFiles)} className="inline-flex items-center gap-2 rounded-full border theme-border px-3 py-2 text-xs font-semibold theme-text"><CheckSquare className="h-3.5 w-3.5" /> 表示中を全選択</button>
                <button type="button" onClick={setSelectedFilesAll} className="inline-flex items-center gap-2 rounded-full border theme-border px-3 py-2 text-xs font-semibold theme-text"><CheckSquare className="h-3.5 w-3.5" /> OCR対象を全選択</button>
                <button type="button" onClick={clearSelectedFiles} className="inline-flex items-center gap-2 rounded-full border theme-border px-3 py-2 text-xs font-semibold theme-text"><Square className="h-3.5 w-3.5" /> 全解除</button>
                <button type="button" onClick={() => void runSelectedOCR()} disabled={bulkRunning || selectedReadyPageCount === 0} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{bulkRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} 選択OCR実行 ({selectedReadyPageCount})</button>
                <span className="text-xs theme-muted">表示中 {visibleFiles.length} 件 / OCR対象 {visibleReadyCount} 件 / 選択中 {selectedPageCount} 件</span>
              </div>
            </div>
            {visibleFiles.length === 0 ? <div className="rounded-[20px] bg-black/5 px-5 py-8 text-sm theme-muted">このフィルターに一致するページはありません。</div> : visibleFiles.map((file) => (
              <div key={file.id} className="flex flex-col gap-4 rounded-[22px] border theme-border p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <label className="mt-1 inline-flex items-center">
                    <input type="checkbox" checked={selectedFileIds.includes(file.id)} onChange={(e) => toggleSelectedFile(file.id, e.target.checked)} disabled={!canRunOCR(file)} />
                  </label>
                  <div>
                    <p className="text-sm font-semibold theme-text">{file.file_name}</p>
                    <p className="text-xs theme-muted">page {file.page_number || '-'} · {statusLabel(file.upload_status)} · {file.file_type.toUpperCase()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void deleteFile(file)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border theme-border theme-panel"><Trash2 className="h-4 w-4" /></button>
                  <button type="button" onClick={() => void runOCR(file)} disabled={bulkRunning || runningId === file.id || file.upload_status === 'processing' || !canRunOCR(file)} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{runningId === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}{canRunOCR(file) ? 'OCRを実行' : 'OCR非対応'}</button>
                </div>
              </div>
            ))}
          </>}
        </div>
      )}

      {tab === 'vocabulary' && (
        <div className="theme-surface rounded-[30px] border theme-border p-6 space-y-4">
          {vocabEntries.length === 0 ? <div className="rounded-[20px] bg-black/5 px-5 py-8 text-sm theme-muted">まだ単語抽出結果がありません。</div> : <>
            <div className="rounded-[22px] border theme-border p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={setSelectedAll} className="inline-flex items-center gap-2 rounded-full border theme-border px-3 py-2 text-xs font-semibold theme-text"><CheckSquare className="h-3.5 w-3.5" /> 全選択</button>
                <button type="button" onClick={clearSelectedAll} className="inline-flex items-center gap-2 rounded-full border theme-border px-3 py-2 text-xs font-semibold theme-text"><Square className="h-3.5 w-3.5" /> 全解除</button>
                <button type="button" onClick={() => applyVerifiedToSelected(true)} className="rounded-full border theme-border px-3 py-2 text-xs font-semibold theme-text">一括verified</button>
                <button type="button" onClick={() => applyVerifiedToSelected(false)} className="rounded-full border theme-border px-3 py-2 text-xs font-semibold theme-text">verified解除</button>
                <button type="button" onClick={() => void deleteVocabEntries('selected')} disabled={saving || selectedVocabIds.length === 0} className="inline-flex items-center gap-2 rounded-full border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> 選択削除</button>
                <button type="button" onClick={() => void deleteVocabEntries('all')} disabled={saving || vocabEntries.length === 0} className="inline-flex items-center gap-2 rounded-full border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> 一括削除</button>
                <button type="button" onClick={() => void bulkSaveVocab()} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} 一括保存</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={bulkPartOfSpeech} onChange={(e) => setBulkPartOfSpeech(e.target.value)} className="rounded-full border theme-border bg-transparent px-4 py-2 text-sm outline-none">
                  {POS_OPTIONS.map((opt) => <option key={opt || 'blank'} value={opt}>{opt || 'part of speech (optional)'}</option>)}
                </select>
                <button type="button" onClick={applyPartOfSpeechToSelected} className="rounded-full border theme-border px-3 py-2 text-xs font-semibold theme-text">品詞を一括入力</button>
                <span className="text-xs theme-muted">選択中 {selectedVocabIds.length || vocabEntries.length} 行</span>
              </div>
            </div>
            {vocabEntries.map((entry) => {
              const draft = vocabDrafts[entry.id];
              return <div key={entry.id} className="space-y-3 rounded-[22px] border theme-border p-4">
                <div className="grid gap-3 md:grid-cols-[90px_1.2fr_1.2fr_180px_140px]">
                  <input value={draft.entry_no} onChange={(e) => setVocabDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], entry_no: Number(e.target.value || 0) } }))} className="rounded-[16px] border theme-border bg-transparent px-3 py-2 outline-none" />
                  <input value={draft.english} onChange={(e) => setVocabDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], english: e.target.value } }))} className="rounded-[16px] border theme-border bg-transparent px-3 py-2 outline-none" placeholder="English" />
                  <input value={draft.japanese} onChange={(e) => setVocabDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], japanese: e.target.value } }))} className="rounded-[16px] border theme-border bg-transparent px-3 py-2 outline-none" placeholder="日本語意味" />
                  <select value={draft.part_of_speech || ''} onChange={(e) => setVocabDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], part_of_speech: e.target.value || null } }))} className="rounded-[16px] border theme-border bg-transparent px-3 py-2 outline-none">
                    {POS_OPTIONS.map((opt) => <option key={opt || 'blank'} value={opt}>{opt || 'part of speech'}</option>)}
                  </select>
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs theme-muted"><input type="checkbox" checked={selectedVocabIds.includes(entry.id)} onChange={(e) => toggleSelected(entry.id, e.target.checked)} /> select</label>
                    <label className="inline-flex items-center gap-2 text-xs theme-muted"><input type="checkbox" checked={draft.is_verified} onChange={(e) => setVocabDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], is_verified: e.target.checked } }))} /> verified</label>
                    <button type="button" onClick={() => void saveVocabEntry(entry.id)} className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-2 text-xs font-semibold text-white"><Save className="h-3.5 w-3.5" /> 保存</button>
                  </div>
                </div>
                <textarea value={draft.example_sentence || ''} onChange={(e) => setVocabDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], example_sentence: e.target.value } }))} className="min-h-[72px] w-full rounded-[16px] border theme-border bg-transparent px-3 py-2 outline-none" placeholder="Example sentence (optional)" />
              </div>;
            })}
          </>}
        </div>
      )}

      {tab === 'grammar' && (
        <div className="theme-surface rounded-[30px] border theme-border p-6 space-y-4">
          {grammarEntries.length === 0 ? <div className="rounded-[20px] bg-black/5 px-5 py-8 text-sm theme-muted">まだ文法抽出結果がありません。</div> : grammarEntries.map((entry) => {
            const draft = grammarDrafts[entry.id];
            return <div key={entry.id} className="space-y-3 rounded-[22px] border theme-border p-4">
              <div className="grid gap-3 md:grid-cols-[90px_1fr_140px]">
                <input value={draft.entry_no || ''} onChange={(e) => setGrammarDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], entry_no: Number(e.target.value || 0) } }))} className="rounded-[16px] border theme-border bg-transparent px-3 py-2 outline-none" placeholder="#" />
                <input value={draft.title} onChange={(e) => setGrammarDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], title: e.target.value } }))} className="rounded-[16px] border theme-border bg-transparent px-3 py-2 outline-none" placeholder="タイトル" />
                <label className="inline-flex items-center gap-2 text-xs theme-muted"><input type="checkbox" checked={draft.is_verified} onChange={(e) => setGrammarDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], is_verified: e.target.checked } }))} /> verified</label>
              </div>
              <textarea value={draft.explanation || ''} onChange={(e) => setGrammarDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], explanation: e.target.value } }))} className="min-h-[90px] w-full rounded-[16px] border theme-border bg-transparent px-3 py-2 outline-none" placeholder="Explanation" />
              <textarea value={draft.example_sentence || ''} onChange={(e) => setGrammarDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], example_sentence: e.target.value } }))} className="min-h-[70px] w-full rounded-[16px] border theme-border bg-transparent px-3 py-2 outline-none" placeholder="Example sentence" />
              <textarea value={draft.japanese_explanation || ''} onChange={(e) => setGrammarDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], japanese_explanation: e.target.value } }))} className="min-h-[70px] w-full rounded-[16px] border theme-border bg-transparent px-3 py-2 outline-none" placeholder="日本語説明" />
              <div className="flex justify-end"><button type="button" onClick={() => void saveGrammarEntry(entry.id)} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"><Save className="h-4 w-4" /> 保存</button></div>
            </div>;
          })}
        </div>
      )}

      {tab === 'review' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="theme-surface rounded-[30px] border theme-border p-6 space-y-4">
            <h2 className="text-lg font-semibold theme-text">OCR review queue</h2>
            {files.map((file) => {
              const latestRun = file.ocr_runs?.[0];
              return <div key={file.id} className="rounded-[20px] border theme-border p-4">
                <p className="text-sm font-semibold theme-text">{file.file_name}</p>
                <p className="mt-1 text-xs theme-muted">{statusLabel(file.upload_status)}</p>
                {latestRun?.error_message ? <pre className="mt-3 overflow-auto rounded-[16px] bg-black/5 p-3 text-xs whitespace-pre-wrap theme-muted">{latestRun.error_message}</pre> : null}
              </div>;
            })}
          </div>
          <div className="theme-surface rounded-[30px] border theme-border p-6 space-y-4">
            <h2 className="text-lg font-semibold theme-text">Summary</h2>
            <div className="rounded-[20px] bg-black/5 p-4 text-sm theme-muted">OCR成功後の成果物は Vocabulary / Grammar タブで教材単位に確認できます。必要に応じて修正し、verified にしてください。</div>
            {failedFiles.length ? <div className="rounded-[20px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">{failedFiles.length} 件のページが failed 状態です。エラーメッセージを確認し、再度 OCR を実行してください。</div> : null}
          </div>
        </div>
      )}

      <Modal open={showAppendModal} onClose={() => { setShowAppendModal(false); setAppendFiles([]); }} panelClassName="w-full max-w-3xl rounded-[32px] border border-black/10 bg-white p-0 shadow-[0_32px_120px_rgba(0,0,0,0.22)] overflow-hidden">
        <div className="border-b border-black/10 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Append pages</p>
          <h2 className="mt-2 font-display text-3xl font-black tracking-[-0.05em] text-black">{material.title} にページ追加</h2>
        </div>
        <form className="space-y-5 px-8 py-7" onSubmit={appendPages}>
          <div className="rounded-[22px] border border-dashed theme-border p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold theme-text">教材ページ画像</p>
                <p className="mt-1 text-sm theme-muted">JPG / PNG / WEBP / GIF は OCR 対応。HEIC / HEIF はアップロード可ですが OCR は非対応です。</p>
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-full border theme-border px-4 py-3 font-semibold theme-text"><Plus className="h-4 w-4" /> ファイルを選択</button>
            </div>
            <input ref={fileRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf" className="hidden" onChange={(e) => setAppendFiles(Array.from(e.target.files || []))} />
            <div className="mt-4 space-y-2">{appendFiles.length ? appendFiles.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-[16px] bg-black/5 px-4 py-3 text-sm"><span className="theme-text">{file.name}</span><span className="theme-muted">page {(files[files.length - 1]?.page_number || files.length || 0) + 1 + index}</span></div>) : <div className="rounded-[16px] bg-black/5 px-4 py-3 text-sm theme-muted">まだファイルが選択されていません。</div>}</div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => { setShowAppendModal(false); setAppendFiles([]); }} className="rounded-full border theme-border px-5 py-3 font-semibold theme-text">キャンセル</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} ページを追加</button></div>
        </form>
      </Modal>
    </div>
  );
}
