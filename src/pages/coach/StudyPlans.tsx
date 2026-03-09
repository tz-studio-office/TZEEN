import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Student, StudyPlan, StudyPlanItem } from '../../types';
import Modal from '../../components/Modal';
import {
  Plus,
  CalendarDays,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function StudyPlans() {
  const { user, profile: authProfile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [planItems, setPlanItems] = useState<Record<string, StudyPlanItem[]>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPlan, setNewPlan] = useState({ student_id: '', title: '', schedule_type: 'daily' as StudyPlan['schedule_type'] });
  const [newItem, setNewItem] = useState({ start_time: '19:00', end_time: '19:30', activity: '', day_of_week: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    const isAdmin = authProfile?.role === 'admin';
    let studentsQuery = supabase.from('students').select('*, profiles!students_profile_id_fkey(full_name)');
    let plansQuery = supabase.from('study_plans').select('*').order('created_at', { ascending: false });
    if (!isAdmin) {
      studentsQuery = studentsQuery.eq('coach_id', user!.id);
      plansQuery = plansQuery.eq('coach_id', user!.id);
    }
    const [studentsRes, plansRes] = await Promise.all([studentsQuery, plansQuery]);
    setStudents(studentsRes.data || []);
    setPlans(plansRes.data || []);
    setLoading(false);
  }

  async function loadItems(planId: string) {
    if (planItems[planId]) return;
    const { data } = await supabase
      .from('study_plan_items')
      .select('*')
      .eq('plan_id', planId)
      .order('sort_order');
    setPlanItems((prev) => ({ ...prev, [planId]: data || [] }));
  }

  async function toggleExpand(planId: string) {
    if (expandedPlan === planId) {
      setExpandedPlan(null);
    } else {
      setExpandedPlan(planId);
      await loadItems(planId);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('study_plans').insert({
      ...newPlan,
      coach_id: user!.id,
    });
    setShowCreate(false);
    setNewPlan({ student_id: '', title: '', schedule_type: 'daily' });
    await loadData();
    setSaving(false);
  }

  async function handleAddItem(planId: string) {
    if (!newItem.activity.trim()) return;
    const existingItems = planItems[planId] || [];
    await supabase.from('study_plan_items').insert({
      plan_id: planId,
      start_time: newItem.start_time,
      end_time: newItem.end_time,
      activity: newItem.activity,
      day_of_week: newItem.day_of_week,
      sort_order: existingItems.length,
    });
    setNewItem({ start_time: '19:00', end_time: '19:30', activity: '', day_of_week: 0 });
    setPlanItems((prev) => ({ ...prev, [planId]: undefined as unknown as StudyPlanItem[] }));
    await loadItems(planId);
  }

  async function handleDeleteItem(planId: string, itemId: string) {
    await supabase.from('study_plan_items').delete().eq('id', itemId);
    setPlanItems((prev) => ({
      ...prev,
      [planId]: prev[planId]?.filter((i) => i.id !== itemId) || [],
    }));
  }

  async function handleDeletePlan(planId: string) {
    if (!confirm('Delete this study plan?')) return;
    await supabase.from('study_plans').delete().eq('id', planId);
    setPlans((prev) => prev.filter((p) => p.id !== planId));
    if (expandedPlan === planId) setExpandedPlan(null);
  }

  function getStudentName(studentId: string) {
    const s = students.find((st) => st.id === studentId);
    return (s?.profiles as unknown as { full_name: string })?.full_name || 'Student';
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
        <h1 className="text-2xl font-bold text-sand-900">Study Plans</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-xl text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          New Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-12 text-center">
          <CalendarDays className="w-12 h-12 text-sand-400 mx-auto mb-4" />
          <p className="text-sand-500">No study plans yet.</p>
          <p className="text-sand-500 text-sm mt-1">Create one for your students.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-white border border-sand-200 rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => toggleExpand(plan.id)}
                className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-sand-50/50 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sand-900 truncate">{plan.title || 'Untitled Plan'}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-sand-500">{getStudentName(plan.student_id)}</span>
                    <span className="text-xs text-accent-500 capitalize bg-accent-50 px-2 py-0.5 rounded-lg">
                      {plan.schedule_type}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePlan(plan.id);
                  }}
                  className="p-1.5 text-sand-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {expandedPlan === plan.id ? (
                  <ChevronUp className="w-4 h-4 text-sand-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-sand-500" />
                )}
              </button>

              {expandedPlan === plan.id && (
                <div className="border-t border-sand-200 px-6 py-4 space-y-4">
                  {(planItems[plan.id] || []).length === 0 ? (
                    <p className="text-sm text-sand-500 text-center py-2">No items yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(planItems[plan.id] || []).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-4 py-3 bg-sand-50/50 rounded-xl"
                        >
                          <Clock className="w-4 h-4 text-sand-500 flex-shrink-0" />
                          <span className="text-xs text-sand-500 font-mono w-24 flex-shrink-0">
                            {item.start_time?.slice(0, 5)} - {item.end_time?.slice(0, 5)}
                          </span>
                          {plan.schedule_type === 'weekly' && (
                            <span className="text-xs text-accent-600 bg-accent-50 px-2 py-0.5 rounded-lg flex-shrink-0">
                              {DAYS[item.day_of_week]}
                            </span>
                          )}
                          <span className="text-sm text-sand-900 flex-1">{item.activity}</span>
                          <button
                            onClick={() => handleDeleteItem(plan.id, item.id)}
                            className="text-sand-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-3 pt-2">
                    <div className="flex-shrink-0">
                      <label className="block text-xs text-sand-500 mb-1">Start</label>
                      <input
                        type="time"
                        value={newItem.start_time}
                        onChange={(e) => setNewItem({ ...newItem, start_time: e.target.value })}
                        className="px-3 py-2 bg-sand-50 border border-sand-200 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-accent-200 w-28"
                      />
                    </div>
                    <div className="flex-shrink-0">
                      <label className="block text-xs text-sand-500 mb-1">End</label>
                      <input
                        type="time"
                        value={newItem.end_time}
                        onChange={(e) => setNewItem({ ...newItem, end_time: e.target.value })}
                        className="px-3 py-2 bg-sand-50 border border-sand-200 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-accent-200 w-28"
                      />
                    </div>
                    {plan.schedule_type === 'weekly' && (
                      <div className="flex-shrink-0">
                        <label className="block text-xs text-sand-500 mb-1">Day</label>
                        <select
                          value={newItem.day_of_week}
                          onChange={(e) => setNewItem({ ...newItem, day_of_week: Number(e.target.value) })}
                          className="px-3 py-2 bg-sand-50 border border-sand-200 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-accent-200"
                        >
                          {DAYS.map((d, i) => (
                            <option key={i} value={i}>{d}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="block text-xs text-sand-500 mb-1">Activity</label>
                      <input
                        type="text"
                        value={newItem.activity}
                        onChange={(e) => setNewItem({ ...newItem, activity: e.target.value })}
                        placeholder="e.g., Vocabulary study"
                        className="w-full px-3 py-2 bg-sand-50 border border-sand-200 rounded-lg text-sand-900 text-sm placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200"
                      />
                    </div>
                    <button
                      onClick={() => handleAddItem(plan.id)}
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
              <h2 className="text-lg font-semibold text-sand-900">New Study Plan</h2>
              <button onClick={() => setShowCreate(false)} className="text-sand-500 hover:text-sand-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-sand-600 mb-2">Student</label>
                <select
                  value={newPlan.student_id}
                  onChange={(e) => setNewPlan({ ...newPlan, student_id: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                >
                  <option value="">Select student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {(s.profiles as unknown as { full_name: string })?.full_name || 'Student'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-sand-600 mb-2">Title</label>
                <input
                  type="text"
                  value={newPlan.title}
                  onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                  placeholder="e.g., Daily Study Routine"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sand-600 mb-2">Schedule Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['daily', 'weekly', 'monthly'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewPlan({ ...newPlan, schedule_type: type })}
                      className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all ${
                        newPlan.schedule_type === type
                          ? 'bg-accent-50 border-accent-300 text-accent-600'
                          : 'bg-sand-50 border-sand-200 text-sand-500 hover:border-sand-300'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
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