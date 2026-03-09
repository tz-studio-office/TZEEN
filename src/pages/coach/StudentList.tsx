import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Student, Profile } from '../../types';
import { Plus, Search, CircleUser as UserCircle, ChevronRight, X, UserPlus, Link as LinkIcon, Eye, EyeOff } from 'lucide-react';
import Modal from '../../components/Modal';

type AddMode = 'create' | 'link';

export default function StudentList() {
  const { user, session, profile: authProfile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState<AddMode>('create');
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    full_name: '',
    goal: '',
    english_level: 'beginner',
    textbook: '',
  });
  const [linkForm, setLinkForm] = useState({
    goal: '',
    english_level: 'beginner',
    textbook: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (user) loadStudents();
  }, [user]);

  async function loadStudents() {
    let query = supabase
      .from('students')
      .select('*, profiles!students_profile_id_fkey(full_name)')
      .order('created_at', { ascending: false });
    if (authProfile?.role !== 'admin') {
      query = query.eq('coach_id', user!.id);
    }
    const { data, error } = await query;
    if (error) console.error('loadStudents error:', error);
    setStudents(data || []);
    setLoading(false);
  }

  async function openAddModal() {
    setShowAdd(true);
    setFormError('');
    setSelectedProfileId('');
    setAddMode('create');
    setCreateForm({ email: '', password: '', full_name: '', goal: '', english_level: 'beginner', textbook: '' });
    setLinkForm({ goal: '', english_level: 'beginner', textbook: '' });

    const { data: allStudentProfiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('full_name');

    const { data: existingStudents } = await supabase
      .from('students')
      .select('profile_id');

    const linkedIds = new Set((existingStudents || []).map((s) => s.profile_id).filter(Boolean));
    setAvailableProfiles(
      (allStudentProfiles || []).filter((p) => !linkedIds.has(p.id))
    );
  }

  async function handleCreateAndAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!createForm.email || !createForm.password || !createForm.full_name) {
      setFormError('Please fill in all required fields.');
      return;
    }

    setSaving(true);

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: createForm.email,
        password: createForm.password,
        full_name: createForm.full_name,
        role: 'student',
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setFormError(result.error || 'Failed to create student account.');
      setSaving(false);
      return;
    }

    const { error: insertErr } = await supabase
      .from('students')
      .insert({
        profile_id: result.user.id,
        coach_id: user!.id,
        goal: createForm.goal,
        english_level: createForm.english_level,
        textbook: createForm.textbook,
      });

    if (insertErr) {
      setFormError(insertErr.message);
      setSaving(false);
      return;
    }

    setShowAdd(false);
    setSaving(false);
    loadStudents();
  }

  async function handleLinkExisting(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!selectedProfileId) {
      setFormError('Please select a student.');
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('students')
      .insert({
        profile_id: selectedProfileId,
        coach_id: user!.id,
        goal: linkForm.goal,
        english_level: linkForm.english_level,
        textbook: linkForm.textbook,
      });

    if (error) {
      setFormError(error.message);
      setSaving(false);
      return;
    }

    setShowAdd(false);
    setSaving(false);
    loadStudents();
  }

  const filtered = students.filter((s) => {
    const name = (s.profiles as unknown as { full_name: string })?.full_name || '';
    return name.toLowerCase().includes(search.toLowerCase());
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
        <h1 className="text-2xl font-bold text-sand-900">Students</h1>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-xl text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Student
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-300 transition-all"
        />
      </div>

      <div className="bg-white border border-sand-200 rounded-2xl shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sand-500">{search ? 'No students match your search.' : 'No students yet.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-sand-200">
            {filtered.map((student) => (
              <Link
                key={student.id}
                to={`/students/${student.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-sand-50/50 transition-all group"
              >
                <div className="w-10 h-10 bg-sand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <UserCircle className="w-6 h-6 text-sand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sand-900 truncate">
                    {(student.profiles as unknown as { full_name: string })?.full_name || 'Unlinked Student'}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-sand-500 capitalize">{student.english_level}</span>
                    {student.goal && (
                      <>
                        <span className="text-sand-300">|</span>
                        <span className="text-xs text-sand-500 truncate">{student.goal}</span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-sand-400 group-hover:text-sand-500 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        panelClassName="bg-white border border-sand-200 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
      >
            <div className="flex items-center justify-between px-6 py-4 border-b border-sand-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-sand-900">Add Student</h2>
              <button onClick={() => setShowAdd(false)} className="text-sand-500 hover:text-sand-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-sand-200 flex-shrink-0">
              <button
                onClick={() => { setAddMode('create'); setFormError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${
                  addMode === 'create'
                    ? 'text-accent-600 border-b-2 border-accent-400'
                    : 'text-sand-500 hover:text-sand-600'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Create New
              </button>
              <button
                onClick={() => { setAddMode('link'); setFormError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${
                  addMode === 'link'
                    ? 'text-accent-600 border-b-2 border-accent-400'
                    : 'text-sand-500 hover:text-sand-600'
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                Link Existing
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {formError && (
                <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                  {formError}
                </div>
              )}

              {addMode === 'create' ? (
                <form onSubmit={handleCreateAndAdd} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-sand-600 mb-2">Full Name *</label>
                    <input
                      type="text"
                      value={createForm.full_name}
                      onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                      required
                      className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                      placeholder="Student name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-sand-600 mb-2">Email *</label>
                    <input
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      required
                      className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                      placeholder="student@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-sand-600 mb-2">Password *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={createForm.password}
                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                        required
                        minLength={6}
                        className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all pr-12"
                        placeholder="Min. 6 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sand-500 hover:text-sand-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-sand-600 mb-2">Goal</label>
                    <input
                      type="text"
                      value={createForm.goal}
                      onChange={(e) => setCreateForm({ ...createForm, goal: e.target.value })}
                      className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                      placeholder="e.g., TOEIC 800, daily conversation"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-sand-600 mb-2">English Level</label>
                    <select
                      value={createForm.english_level}
                      onChange={(e) => setCreateForm({ ...createForm, english_level: e.target.value })}
                      className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="elementary">Elementary</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="upper-intermediate">Upper Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-sand-600 mb-2">Textbook</label>
                    <input
                      type="text"
                      value={createForm.textbook}
                      onChange={(e) => setCreateForm({ ...createForm, textbook: e.target.value })}
                      className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                      placeholder="e.g., English Grammar in Use"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAdd(false)}
                      className="flex-1 py-3 bg-sand-100 hover:bg-sand-200 text-sand-700 font-medium rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 py-3 bg-accent-600 hover:bg-accent-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                    >
                      {saving ? 'Creating...' : 'Create & Add'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleLinkExisting} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-sand-600 mb-2">Student Account</label>
                    {availableProfiles.length === 0 ? (
                      <p className="text-sm text-sand-500 bg-sand-50 border border-sand-200 rounded-xl px-4 py-3">
                        No unassigned student accounts found. Use "Create New" tab to create one.
                      </p>
                    ) : (
                      <select
                        value={selectedProfileId}
                        onChange={(e) => setSelectedProfileId(e.target.value)}
                        className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                        required
                      >
                        <option value="">Select a student...</option>
                        {availableProfiles.map((p) => (
                          <option key={p.id} value={p.id}>{p.full_name || 'Unnamed'}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-sand-600 mb-2">Goal</label>
                    <input
                      type="text"
                      value={linkForm.goal}
                      onChange={(e) => setLinkForm({ ...linkForm, goal: e.target.value })}
                      className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                      placeholder="e.g., TOEIC 800, daily conversation"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-sand-600 mb-2">English Level</label>
                    <select
                      value={linkForm.english_level}
                      onChange={(e) => setLinkForm({ ...linkForm, english_level: e.target.value })}
                      className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="elementary">Elementary</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="upper-intermediate">Upper Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-sand-600 mb-2">Textbook</label>
                    <input
                      type="text"
                      value={linkForm.textbook}
                      onChange={(e) => setLinkForm({ ...linkForm, textbook: e.target.value })}
                      className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                      placeholder="e.g., English Grammar in Use"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAdd(false)}
                      className="flex-1 py-3 bg-sand-100 hover:bg-sand-200 text-sand-700 font-medium rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving || availableProfiles.length === 0}
                      className="flex-1 py-3 bg-accent-600 hover:bg-accent-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                    >
                      {saving ? 'Adding...' : 'Add Student'}
                    </button>
                  </div>
                </form>
              )}
            </div>
      </Modal>
      )}
    </div>
  );
}