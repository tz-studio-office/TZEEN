import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Student, Assignment } from '../../types';
import { Plus, ClipboardList, Trash2, X, CheckCircle2, Circle } from 'lucide-react';
import { format } from 'date-fns';
import Modal from '../../components/Modal';

export default function CoachAssignments() {
  const { user, profile: authProfile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filterStudent, setFilterStudent] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    student_id: '',
    title: '',
    textbook: '',
    pages: '',
    due_date: '',
    submission_method: '',
  });

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    const isAdmin = authProfile?.role === 'admin';
    let studentsQuery = supabase.from('students').select('*, profiles!students_profile_id_fkey(full_name)');
    let assignQuery = supabase.from('assignments').select('*').order('created_at', { ascending: false });
    if (!isAdmin) {
      studentsQuery = studentsQuery.eq('coach_id', user!.id);
      assignQuery = assignQuery.eq('coach_id', user!.id);
    }
    const [studentsRes, assignRes] = await Promise.all([studentsQuery, assignQuery]);
    setStudents(studentsRes.data || []);
    setAssignments(assignRes.data || []);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('assignments').insert({
      ...form,
      coach_id: user!.id,
      due_date: form.due_date || null,
    });
    setShowCreate(false);
    setForm({ student_id: '', title: '', textbook: '', pages: '', due_date: '', submission_method: '' });
    await loadData();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('assignments').delete().eq('id', id);
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  }

  async function toggleStatus(a: Assignment) {
    const newStatus = a.status === 'completed' ? 'pending' : 'completed';
    await supabase.from('assignments').update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    }).eq('id', a.id);
    loadData();
  }

  function getStudentName(studentId: string) {
    const s = students.find((st) => st.id === studentId);
    return (s?.profiles as unknown as { full_name: string })?.full_name || 'Student';
  }

  const filtered = assignments.filter((a) => {
    if (filterStudent !== 'all' && a.student_id !== filterStudent) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    return true;
  });

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
        <h1 className="text-2xl font-bold text-sand-900">Assignments</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-xl text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          New Assignment
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={filterStudent}
          onChange={(e) => setFilterStudent(e.target.value)}
          className="px-4 py-2 bg-white border border-sand-200 rounded-xl text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-accent-200"
        >
          <option value="all">All Students</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {(s.profiles as unknown as { full_name: string })?.full_name || 'Student'}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-white border border-sand-200 rounded-xl text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-accent-200"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-12 text-center">
          <ClipboardList className="w-12 h-12 text-sand-400 mx-auto mb-4" />
          <p className="text-sand-500">No assignments found.</p>
        </div>
      ) : (
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm divide-y divide-sand-200">
          {filtered.map((a) => (
            <div key={a.id} className="flex items-center gap-4 px-6 py-4">
              <button onClick={() => toggleStatus(a)} className="flex-shrink-0">
                {a.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-accent-600" />
                ) : (
                  <Circle className="w-5 h-5 text-sand-400 hover:text-sand-500 transition-colors" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${a.status === 'completed' ? 'text-sand-500 line-through' : 'text-sand-900'}`}>
                  {a.title}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-sand-500">{getStudentName(a.student_id)}</span>
                  {a.textbook && (
                    <>
                      <span className="text-sand-300">|</span>
                      <span className="text-xs text-sand-500">{a.textbook} {a.pages && `p.${a.pages}`}</span>
                    </>
                  )}
                  {a.due_date && (
                    <>
                      <span className="text-sand-300">|</span>
                      <span className="text-xs text-sand-500">Due {format(new Date(a.due_date), 'MMM d')}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(a.id)}
                className="p-1.5 text-sand-400 hover:text-red-600 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
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
              <h2 className="text-lg font-semibold text-sand-900">New Assignment</h2>
              <button onClick={() => setShowCreate(false)} className="text-sand-500 hover:text-sand-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-sand-600 mb-2">Student</label>
                <select
                  value={form.student_id}
                  onChange={(e) => setForm({ ...form, student_id: e.target.value })}
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
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                  placeholder="e.g., Complete vocabulary chapter 5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-sand-600 mb-2">Textbook</label>
                  <input
                    type="text"
                    value={form.textbook}
                    onChange={(e) => setForm({ ...form, textbook: e.target.value })}
                    className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                    placeholder="Textbook name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sand-600 mb-2">Pages</label>
                  <input
                    type="text"
                    value={form.pages}
                    onChange={(e) => setForm({ ...form, pages: e.target.value })}
                    className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                    placeholder="e.g., 30-45"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-sand-600 mb-2">Due Date</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sand-600 mb-2">Submission Method</label>
                <input
                  type="text"
                  value={form.submission_method}
                  onChange={(e) => setForm({ ...form, submission_method: e.target.value })}
                  className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                  placeholder="e.g., Photo upload, in-class"
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