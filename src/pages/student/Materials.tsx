import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Material, Student } from '../../types';

type MaterialStats = Record<string, { vocab: number; grammar: number }>;

export default function StudentMaterials() {
  const { user, profile } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [stats, setStats] = useState<MaterialStats>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) void load(); }, [user, profile?.organization_id]);

  async function load() {
    if (!user) return;
    setLoading(true);

    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('profile_id', user.id)
      .maybeSingle();

    setStudent((studentData as Student | null) || null);

    const [{ data: vocabRows }, { data: grammarRows }] = await Promise.all([
      supabase.from('vocabulary_entries').select('material_id, id'),
      supabase.from('grammar_entries').select('material_id, id'),
    ]);

    const nextStats: MaterialStats = {};
    (vocabRows || []).forEach((row: any) => {
      if (!row.material_id) return;
      nextStats[row.material_id] ??= { vocab: 0, grammar: 0 };
      nextStats[row.material_id].vocab += 1;
    });
    (grammarRows || []).forEach((row: any) => {
      if (!row.material_id) return;
      nextStats[row.material_id] ??= { vocab: 0, grammar: 0 };
      nextStats[row.material_id].grammar += 1;
    });

    const materialIds = Object.keys(nextStats);
    if (!materialIds.length) {
      setStats({});
      setMaterials([]);
      setLoading(false);
      return;
    }

    const orgId = (studentData as Student | null)?.organization_id || profile?.organization_id || null;

    let materialsQuery = supabase.from('materials').select('*').in('id', materialIds).order('title');
    if (orgId) materialsQuery = materialsQuery.eq('organization_id', orgId);

    let { data: materialRows, error: materialError } = await materialsQuery;

    if ((materialError || !materialRows?.length) && orgId) {
      const fallback = await supabase.from('materials').select('*').in('id', materialIds).order('title');
      materialRows = fallback.data || [];
      materialError = fallback.error;
    }

    if (materialError) {
      console.error('Student materials load failed:', materialError.message);
    }

    const visibleMaterials = ((materialRows || []) as Material[])
      .filter((material) => {
        const row = nextStats[material.id];
        return !!row && (row.vocab > 0 || row.grammar > 0);
      });

    setStats(nextStats);
    setMaterials(visibleMaterials);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((m) => [m.title, m.publisher || '', m.description || ''].join(' ').toLowerCase().includes(q));
  }, [materials, search]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="theme-surface rounded-[2rem] border theme-border px-8 py-8">
        <p className="text-[11px] font-semibold uppercase tracking-caps theme-muted">Materials</p>
        <h1 className="mt-2 font-display text-5xl font-black tracking-[-0.06em] theme-text">Study Materials</h1>
        <p className="mt-3 text-sm theme-muted">保存済みの単語と文法を教材ごとに確認できます。</p>
      </div>

      <div className="theme-surface rounded-[2rem] border theme-border p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 theme-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="教材を検索..." className="w-full rounded-[1.2rem] border theme-border bg-transparent py-3 pl-11 pr-4 outline-none" />
        </div>
      </div>

      <div className="theme-surface rounded-[2rem] border theme-border p-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-[1.5rem] bg-black/5 px-5 py-10 text-center text-sm theme-muted">
            保存済みの単語または文法がある教材がありません。
          </div>
        ) : filtered.map((material) => {
          const row = stats[material.id] || { vocab: 0, grammar: 0 };
          return (
            <Link key={material.id} to={`/student-materials/${material.id}`} className="block rounded-[1.5rem] border theme-border px-5 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="theme-nav-icon flex h-12 w-12 items-center justify-center rounded-full border theme-border"><BookOpen className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold theme-text">{material.title}</p>
                    <p className="mt-1 text-xs theme-muted">{material.publisher || 'Publisher 未設定'} · {material.material_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs theme-muted">
                  <span>単語 {row.vocab}</span>
                  <span>文法 {row.grammar}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
