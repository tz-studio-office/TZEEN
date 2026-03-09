import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { CurriculumTemplate, TemplateItem } from '../../types';
import Modal from '../../components/Modal';
import {
  Plus,
  FileText,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  BookOpen,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'TOEIC', label: 'TOEIC' },
  { value: 'Eiken', label: 'Eiken' },
  { value: 'university', label: 'University Exam' },
  { value: 'custom', label: 'Custom' },
] as const;

export default function Templates() {
  const { user, profile: authProfile } = useAuth();
  const [templates, setTemplates] = useState<CurriculumTemplate[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, TemplateItem[]>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'TOEIC' as CurriculumTemplate['category'],
    duration_weeks: 12,
    description: '',
  });
  const [newItem, setNewItem] = useState({ week_number: 1, activity: '', description: '' });

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    let query = supabase
      .from('curriculum_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (authProfile?.role !== 'admin') {
      query = query.eq('coach_id', user!.id);
    }
    const { data } = await query;
    setTemplates(data || []);
    setLoading(false);
  }

  async function loadItems(templateId: string) {
    if (items[templateId]) return;
    const { data } = await supabase
      .from('template_items')
      .select('*')
      .eq('template_id', templateId)
      .order('week_number')
      .order('sort_order');
    setItems((prev) => ({ ...prev, [templateId]: data || [] }));
  }

  async function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      await loadItems(id);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('curriculum_templates').insert({
      ...form,
      coach_id: user!.id,
    });
    setShowCreate(false);
    setForm({ name: '', category: 'TOEIC', duration_weeks: 12, description: '' });
    await loadData();
    setSaving(false);
  }

  async function handleAddItem(templateId: string) {
    if (!newItem.activity.trim()) return;
    const existing = items[templateId] || [];
    await supabase.from('template_items').insert({
      template_id: templateId,
      week_number: newItem.week_number,
      activity: newItem.activity,
      description: newItem.description,
      sort_order: existing.length,
    });
    setNewItem({ week_number: 1, activity: '', description: '' });
    setItems((prev) => ({ ...prev, [templateId]: undefined as unknown as TemplateItem[] }));
    await loadItems(templateId);
  }

  async function handleDeleteItem(templateId: string, itemId: string) {
    await supabase.from('template_items').delete().eq('id', itemId);
    setItems((prev) => ({
      ...prev,
      [templateId]: prev[templateId]?.filter((i) => i.id !== itemId) || [],
    }));
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return;
    await supabase.from('curriculum_templates').delete().eq('id', id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (expanded === id) setExpanded(null);
  }

  function getCategoryColor(category: string) {
    switch (category) {
      case 'TOEIC': return 'bg-blue-50 text-blue-600';
      case 'Eiken': return 'bg-emerald-50 text-emerald-600';
      case 'university': return 'bg-amber-50 text-amber-600';
      default: return 'bg-sand-100 text-sand-500';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-sand-900">Curriculum Templates</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-xl text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-12 text-center">
          <FileText className="w-12 h-12 text-sand-400 mx-auto mb-4" />
          <p className="text-sand-500">No templates yet.</p>
          <p className="text-sand-500 text-sm mt-1">Create reusable curriculum templates.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div key={template.id} className="bg-white border border-sand-200 rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => toggleExpand(template.id)}
                className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-sand-50/50 transition-all"
              >
                <div className="w-10 h-10 bg-sand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-sand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sand-900 truncate">{template.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${getCategoryColor(template.category)}`}>
                      {template.category}
                    </span>
                    <span className="text-xs text-sand-500">{template.duration_weeks} weeks</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTemplate(template.id);
                  }}
                  className="p-1.5 text-sand-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {expanded === template.id ? (
                  <ChevronUp className="w-4 h-4 text-sand-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-sand-500" />
                )}
              </button>

              {expanded === template.id && (
                <div className="border-t border-sand-200 px-6 py-4 space-y-4">
                  {template.description && (
                    <p className="text-sm text-sand-500">{template.description}</p>
                  )}

                  {(items[template.id] || []).length === 0 ? (
                    <p className="text-sm text-sand-500 text-center py-2">No items yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(items[template.id] || []).map((item) => (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-sand-50/50 rounded-xl">
                          <span className="text-xs text-accent-600 bg-accent-50 px-2 py-0.5 rounded-lg font-medium flex-shrink-0">
                            Week {item.week_number}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-sand-900 truncate">{item.activity}</p>
                            {item.description && (
                              <p className="text-xs text-sand-500 truncate">{item.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteItem(template.id, item.id)}
                            className="text-sand-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-3 pt-2">
                    <div className="flex-shrink-0 w-20">
                      <label className="block text-xs text-sand-500 mb-1">Week</label>
                      <input
                        type="number"
                        min={1}
                        max={template.duration_weeks}
                        value={newItem.week_number}
                        onChange={(e) => setNewItem({ ...newItem, week_number: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-sand-50 border border-sand-200 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-accent-200"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-sand-500 mb-1">Activity</label>
                      <input
                        type="text"
                        value={newItem.activity}
                        onChange={(e) => setNewItem({ ...newItem, activity: e.target.value })}
                        placeholder="e.g., Vocabulary Ch.1-3"
                        className="w-full px-3 py-2 bg-sand-50 border border-sand-200 rounded-lg text-sand-900 text-sm placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200"
                      />
                    </div>
                    <button
                      onClick={() => handleAddItem(template.id)}
                      className="px-4 py-2 bg-accent-50 text-accent-600 hover:bg-accent-100 rounded-lg text-sm font-medium transition-all flex-shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        panelClassName="bg-white border border-sand-200 rounded-2xl shadow-2xl w-full max-w-md"
      >
            <div className="flex items-center justify-between px-6 py-4 border-b border-sand-200">
              <h2 className="text-lg font-semibold text-sand-900">New Template</h2>
              <button onClick={() => setShowCreate(false)} className="text-sand-500 hover:text-sand-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-sand-600 mb-2">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                  placeholder="e.g., TOEIC 800 Program"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sand-600 mb-2">Category</label>
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setForm({ ...form, category: cat.value })}
                      className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all ${
                        form.category === cat.value
                          ? 'bg-accent-50 border-accent-300 text-accent-600'
                          : 'bg-sand-50 border-sand-200 text-sand-500 hover:border-sand-300'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-sand-600 mb-2">Duration (weeks)</label>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={form.duration_weeks}
                  onChange={(e) => setForm({ ...form, duration_weeks: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sand-600 mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all resize-none"
                  placeholder="Describe this curriculum..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 bg-sand-100 hover:bg-sand-200 text-sand-700 font-medium rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-accent-600 hover:bg-accent-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
      </Modal>
      )}
    </div>
  );
}