import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowRight, BookOpen, Files, ImagePlus, Loader2, Pencil, Plus, RefreshCw, Trash2, UploadCloud, Wand2 } from 'lucide-react';
import type { Material, MaterialFile } from '../../types';
import Modal from '../../components/Modal';

type MaterialWithFiles = Material & { material_files?: MaterialFile[] };
type ModalMode = 'create' | 'append';
const ACCEPTED_EXTENSIONS = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'heic', 'heif', 'pdf'];
const OCR_SUPPORTED = new Set(['jpeg', 'jpg', 'png', 'webp', 'gif']);

function extFromFile(file: File) {
  const raw = file.name.split('.').pop()?.toLowerCase() || '';
  return ACCEPTED_EXTENSIONS.includes(raw) ? raw : 'jpeg';
}

function statusLabel(status?: string) {
  switch (status) {
    case 'processing': return 'OCR processing';
    case 'processed': return 'OCR complete';
    case 'failed': return 'OCR failed';
    default: return 'Uploaded';
  }
}

function canRunOCR(file: MaterialFile) {
  return OCR_SUPPORTED.has(file.file_type);
}

export default function MaterialsPage() {
  const { user, profile, session } = useAuth();
  const [materials, setMaterials] = useState<MaterialWithFiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [bulkRunningId, setBulkRunningId] = useState<string | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<MaterialWithFiles | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: '',
    material_type: 'vocabulary_book' as Material['material_type'],
    publisher: '',
    description: '',
  });

  useEffect(() => {
    if (user) void loadMaterials();
  }, [user, profile]);

  async function loadMaterials() {
    setLoading(true);
    setError('');
    let query = supabase.from('materials').select('*, material_files(*)').order('created_at', { ascending: false });
    if (profile?.organization_id) query = query.eq('organization_id', profile.organization_id);
    else query = query.is('organization_id', null);
    const { data, error: fetchError } = await query;
    if (fetchError) setError(fetchError.message);
    const normalized = ((data || []) as MaterialWithFiles[]).map((m) => ({
      ...m,
      material_files: [...(m.material_files || [])].sort((a, b) => (a.page_number || 0) - (b.page_number || 0)),
    }));
    setMaterials(normalized);
    setLoading(false);
  }

  function resetForm() {
    setForm({ title: '', material_type: 'vocabulary_book', publisher: '', description: '' });
    setFiles([]);
    setError('');
    setEditingMaterial(null);
    setModalMode('create');
    if (fileRef.current) fileRef.current.value = '';
  }

  function openCreateModal() {
    resetForm();
    setShowModal(true);
  }

  function openAppendModal(material: MaterialWithFiles) {
    setModalMode('append');
    setEditingMaterial(material);
    setForm({ title: material.title, material_type: material.material_type, publisher: material.publisher || '', description: material.description || '' });
    setFiles([]); setError('');
    if (fileRef.current) fileRef.current.value = '';
    setShowModal(true);
  }

  async function uploadSingleFile(file: File, materialId: string, pageNumber: number) {
    if (!session?.access_token) throw new Error('Session expired. Please sign in again.');
    const body = new FormData();
    body.append('file', file); body.append('materialId', materialId); body.append('pageNumber', String(pageNumber));
    const response = await fetch('/api/upload-material', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || 'R2 upload failed.');
    return { r2_key: payload?.key || `materials/${materialId}/${file.name}`, file_url: payload?.url as string, file_name: file.name, file_type: extFromFile(file), page_number: pageNumber, upload_status: 'uploaded' as const };
  }

  async function insertMaterialFiles(materialId: string, uploadFiles: File[], startPage = 1) {
    const uploadedRows = [] as Omit<MaterialFile, 'id' | 'created_at'>[];
    for (const [index, file] of uploadFiles.entries()) {
      const uploaded = await uploadSingleFile(file, materialId, startPage + index);
      uploadedRows.push({ material_id: materialId, ...uploaded });
    }
    const { error: filesError } = await supabase.from('material_files').insert(uploadedRows);
    if (filesError) throw filesError;
  }

  async function handleCreateOrAppendMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.title.trim()) return setError('教材名を入力してください。');
    if (files.length === 0) return setError('少なくとも1ファイル追加してください。');
    setSaving(true); setError('');
    try {
      let materialId = editingMaterial?.id || '';
      if (modalMode === 'create') {
        const { data: material, error: materialError } = await supabase.from('materials').insert({
          organization_id: profile?.organization_id || null,
          title: form.title.trim(),
          material_type: form.material_type,
          publisher: form.publisher.trim() || null,
          description: form.description.trim() || null,
          created_by: user.id,
        }).select('*').single();
        if (materialError || !material) throw new Error(materialError?.message || '教材作成に失敗しました。');
        materialId = material.id;
      }
      const currentCount = editingMaterial?.material_files?.length || 0;
      await insertMaterialFiles(materialId, files, currentCount + 1);
      resetForm(); setShowModal(false); await loadMaterials();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'ファイルアップロードに失敗しました。');
    } finally { setSaving(false); }
  }

  async function runOCR(file: MaterialFile) {
    if (!canRunOCR(file)) return setError(`${file.file_name} は OCR 非対応です。HEIC / HEIF は JPG か PNG に変換してください。`);
    setRunningId(file.id); setError('');
    try {
      const res = await fetch('/api/process-material-ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ material_file_id: file.id }) });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'OCRの実行に失敗しました。');
      await loadMaterials();
    } catch (e) { setError(e instanceof Error ? e.message : 'OCRの実行に失敗しました。'); }
    finally { setRunningId(null); }
  }

  async function runBulkOCR(material: MaterialWithFiles) {
    const targets = (material.material_files || []).filter((file) => canRunOCR(file) && file.upload_status !== 'processed');
    const skipped = (material.material_files || []).filter((file) => !canRunOCR(file));
    if (targets.length === 0) return setError(skipped.length ? 'OCR対応画像がありません。HEIC / HEIF は JPG / PNG に変換してください。' : 'OCR対象の未処理ページがありません。');
    setBulkRunningId(material.id); setError(skipped.length ? `${skipped.length}件の HEIC / HEIF / PDF はスキップしました。` : '');
    try {
      for (const file of targets) {
        const res = await fetch('/api/process-material-ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ material_file_id: file.id }) });
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.error || `OCR failed on ${file.file_name}`);
      }
      await loadMaterials();
    } catch (e) { setError(e instanceof Error ? e.message : '一括OCRの実行に失敗しました。'); }
    finally { setBulkRunningId(null); }
  }

  async function deleteMaterial(materialId: string) {
    if (!window.confirm('この教材を削除しますか？')) return;
    const { error: deleteError } = await supabase.from('materials').delete().eq('id', materialId);
    if (deleteError) return setError(deleteError.message);
    await loadMaterials();
  }

  const totalFiles = useMemo(() => materials.reduce((sum, material) => sum + (material.material_files?.length || 0), 0), [materials]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Materials</p>
          <h1 className="font-display text-4xl font-black tracking-[-0.05em] theme-text">OCR-ready textbook library</h1>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void loadMaterials()} className="inline-flex items-center gap-2 rounded-full border theme-border px-4 py-3 font-semibold theme-text"><RefreshCw className="h-4 w-4" /> Refresh</button>
          <button type="button" onClick={openCreateModal} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 font-semibold text-white"><Plus className="h-4 w-4" /> 教材を追加</button>
        </div>
      </div>

      {error && <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="theme-surface rounded-[28px] border theme-border p-5"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">Titles</p><p className="mt-3 font-display text-4xl font-black tracking-[-0.05em] theme-text">{materials.length}</p></div>
        <div className="theme-surface rounded-[28px] border theme-border p-5"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">Uploaded pages</p><p className="mt-3 font-display text-4xl font-black tracking-[-0.05em] theme-text">{totalFiles}</p></div>
        <div className="theme-surface rounded-[28px] border theme-border p-5"><p className="text-xs font-semibold uppercase tracking-caps theme-muted">Workflow</p><p className="mt-3 text-sm leading-6 theme-muted">教材ごとに詳細ページで OCR 成果物を確認できます。ページ追加・削除・一括OCR・抽出結果修正まで対応します。</p></div>
      </div>

      <div className="theme-surface rounded-[30px] border theme-border p-6 md:p-8">
        {loading ? <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div> : materials.length === 0 ? <div className="rounded-[26px] bg-black/5 px-6 py-10 text-sm theme-muted">教材はまだありません。単語帳や問題集の画像を登録すると、R2保存とOCRの対象になります。</div> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {materials.map((material) => {
              const filesCount = material.material_files?.length || 0;
              const processedCount = (material.material_files || []).filter((f) => f.upload_status === 'processed').length;
              const readyFiles = (material.material_files || []).filter((f) => canRunOCR(f) && f.upload_status !== 'processed').length;
              const latestFile = material.material_files?.[0];
              return (
                <div key={material.id} className="theme-panel rounded-[26px] border theme-border p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase tracking-caps theme-text">{material.material_type.replace('_', ' ')}</div>
                      <h3 className="mt-3 text-xl font-display font-black tracking-[-0.04em] theme-text">{material.title}</h3>
                      <p className="mt-1 text-sm theme-muted">{material.publisher || 'Publisher 未設定'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openAppendModal(material)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border theme-border theme-panel"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => void deleteMaterial(material.id)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border theme-border theme-panel"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <p className="text-sm leading-6 theme-muted line-clamp-2">{material.description || '説明はまだありません。'}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[22px] bg-black/5 px-4 py-4"><div className="flex items-center gap-2 text-sm font-semibold theme-text"><Files className="h-4 w-4" /> Pages</div><p className="mt-2 text-2xl font-display font-black tracking-[-0.04em] theme-text">{filesCount}</p></div>
                    <div className="rounded-[22px] bg-black/5 px-4 py-4"><div className="flex items-center gap-2 text-sm font-semibold theme-text"><BookOpen className="h-4 w-4" /> OCR status</div><p className="mt-2 text-sm theme-muted">{processedCount} processed / {readyFiles} ready</p></div>
                  </div>
                  {latestFile ? <div className="rounded-[20px] bg-black/5 px-4 py-3 text-sm theme-muted">最新ページ: {latestFile.file_name} · {statusLabel(latestFile.upload_status)}</div> : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/materials/${material.id}`} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"><ArrowRight className="h-4 w-4" /> 詳細を見る</Link>
                    <button type="button" onClick={() => void runBulkOCR(material)} disabled={bulkRunningId === material.id || readyFiles === 0} className="inline-flex items-center gap-2 rounded-full border theme-border px-4 py-2 text-sm font-semibold theme-text disabled:cursor-not-allowed disabled:opacity-50">{bulkRunningId === material.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} 一括OCR</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); resetForm(); }} panelClassName="w-full max-w-3xl rounded-[32px] border border-black/10 bg-white p-0 shadow-[0_32px_120px_rgba(0,0,0,0.22)] overflow-hidden">
        <div className="border-b border-black/10 bg-white px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-caps text-black/50">{modalMode === 'create' ? 'Create material' : 'Append pages'}</p>
          <h2 className="mt-2 font-display text-3xl font-black tracking-[-0.05em] text-black">{modalMode === 'create' ? '教材を追加' : `${editingMaterial?.title} にページ追加`}</h2>
        </div>
        <form className="space-y-5 bg-white px-8 py-7" onSubmit={handleCreateOrAppendMaterial}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-black">教材名</span>
              <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className="w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-black outline-none" placeholder="例: Target1900" disabled={modalMode === 'append'} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-black">教材タイプ</span>
              <select value={form.material_type} onChange={(e) => setForm((prev) => ({ ...prev, material_type: e.target.value as Material['material_type'] }))} className="w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-black outline-none" disabled={modalMode === 'append'}>
                <option value="vocabulary_book">Vocabulary book</option><option value="grammar_book">Grammar book</option><option value="reading">Reading</option><option value="other">Other</option>
              </select>
            </label>
            <label className="space-y-2"><span className="text-sm font-semibold text-black">出版社</span><input value={form.publisher} onChange={(e) => setForm((prev) => ({ ...prev, publisher: e.target.value }))} className="w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-black outline-none" placeholder="任意" disabled={modalMode === 'append'} /></label>
          </div>
          <label className="space-y-2"><span className="text-sm font-semibold text-black">説明</span><textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="min-h-[110px] w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-black outline-none" placeholder="任意" disabled={modalMode === 'append'} /></label>
          <div className="rounded-[22px] border border-dashed border-black/12 bg-black/[0.02] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm font-semibold text-black">教材ページ画像</p><p className="mt-1 text-sm text-black/55">JPG / PNG / WEBP / GIF は OCR 対応。HEIC / HEIF はアップロード可ですが OCR は非対応です。</p></div>
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-3 font-semibold text-black"><UploadCloud className="h-4 w-4" /> ファイルを選択</button>
            </div>
            <input ref={fileRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            <div className="mt-4 space-y-2">{files.length ? files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-[16px] bg-black/5 px-4 py-3 text-sm"><span className="text-black">{file.name}</span><span className="text-black/55">page {index + 1}</span></div>) : <div className="rounded-[16px] bg-black/5 px-4 py-3 text-sm text-black/55">まだファイルが選択されていません。</div>}</div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="rounded-full border border-black/10 px-5 py-3 font-semibold text-black/70">キャンセル</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{modalMode === 'create' ? '教材を作成' : 'ページを追加'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
