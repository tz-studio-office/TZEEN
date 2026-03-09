import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, X, Trash2, CreditCard as Edit3, BookOpenCheck, Search, ImagePlus } from 'lucide-react';
import Modal from '../../components/Modal';

interface ReadingMaterial {
  id: string;
  coach_id: string;
  student_id: string | null;
  title: string;
  content: string;
  difficulty: string;
  image_url: string | null;
  created_at: string;
}

interface StudentOption {
  id: string;
  profile_name: string;
}

export default function ReadingMaterials() {
  const { user, session } = useAuth();
  const [materials, setMaterials] = useState<ReadingMaterial[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ReadingMaterial | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    difficulty: 'intermediate',
    student_id: '',
  });

  useEffect(() => {
    if (user) {
      loadMaterials();
      loadStudents();
    }
  }, [user]);

  async function loadMaterials() {
    const { data } = await supabase
      .from('reading_materials')
      .select('*')
      .eq('coach_id', user!.id)
      .order('created_at', { ascending: false });
    setMaterials(data || []);
    setLoading(false);
  }

  async function loadStudents() {
    const { data } = await supabase
      .from('students')
      .select('id, profiles!students_profile_id_fkey(full_name)')
      .eq('coach_id', user!.id);
    setStudents(
      (data || []).map((s) => ({
        id: s.id,
        profile_name: (s.profiles as unknown as { full_name: string })?.full_name || 'Unnamed',
      }))
    );
  }

  function openCreate() {
    setEditing(null);
    setForm({ title: '', content: '', difficulty: 'intermediate', student_id: '' });
    setFormError('');
    setImageFile(null);
    setImagePreview(null);
    setShowModal(true);
  }

  function openEdit(m: ReadingMaterial) {
    setEditing(m);
    setForm({
      title: m.title,
      content: m.content,
      difficulty: m.difficulty,
      student_id: m.student_id || '',
    });
    setFormError('');
    setImageFile(null);
    setImagePreview(m.image_url || null);
    setShowModal(true);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image must be under 5MB.');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function uploadImage(file: File): Promise<string | null> {
    if (!session?.access_token) {
      setFormError('Your session expired. Please sign in again.');
      return null;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(import.meta.env.VITE_R2_UPLOAD_ENDPOINT || '/api/r2-upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setFormError(payload?.error || 'Image upload failed.');
        return null;
      }

      return payload?.url || null;
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Image upload failed.');
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }

    setSaving(true);

    let imageUrl = editing?.image_url || null;
    if (imageFile) {
      const url = await uploadImage(imageFile);
      if (url === null && imageFile) {
        setSaving(false);
        return;
      }
      imageUrl = url;
    } else if (!imagePreview) {
      imageUrl = null;
    }

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      difficulty: form.difficulty,
      student_id: form.student_id || null,
      coach_id: user!.id,
      image_url: imageUrl,
    };

    if (editing) {
      const { error } = await supabase
        .from('reading_materials')
        .update(payload)
        .eq('id', editing.id);
      if (error) {
        setFormError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from('reading_materials')
        .insert(payload);
      if (error) {
        setFormError(error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowModal(false);
    loadMaterials();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('reading_materials').delete().eq('id', id);
    if (!error) loadMaterials();
  }

  const filtered = materials.filter(
    (m) => m.title.toLowerCase().includes(search.toLowerCase())
  );

  const difficultyColors: Record<string, string> = {
    beginner: 'bg-green-50 text-green-600',
    elementary: 'bg-blue-50 text-blue-600',
    intermediate: 'bg-yellow-50 text-yellow-600',
    'upper-intermediate': 'bg-amber-50 text-amber-600',
    advanced: 'bg-red-50 text-red-600',
  };

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
        <h1 className="text-2xl font-bold text-sand-900">Reading Materials</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-xl text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Material
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search materials..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-300 transition-all"
        />
      </div>

      <div className="bg-white border border-sand-200 rounded-2xl shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpenCheck className="w-10 h-10 text-sand-400 mx-auto mb-3" />
            <p className="text-sand-500">{search ? 'No materials match your search.' : 'No reading materials yet.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-sand-200">
            {filtered.map((m) => {
              const student = students.find((s) => s.id === m.student_id);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-sand-50/50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden">
                    {m.image_url ? (
                      <img src={m.image_url} alt={m.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-sand-100 flex items-center justify-center">
                        <BookOpenCheck className="w-5 h-5 text-sand-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sand-900 truncate">{m.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md capitalize ${difficultyColors[m.difficulty] || 'text-sand-500'}`}>
                        {m.difficulty}
                      </span>
                      {student && (
                        <>
                          <span className="text-sand-300">|</span>
                          <span className="text-xs text-sand-500">{student.profile_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(m)}
                      className="p-2 text-sand-500 hover:text-accent-600 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="p-2 text-sand-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        panelClassName="bg-white border border-sand-200 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
      >
            <div className="flex items-center justify-between px-6 py-4 border-b border-sand-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-sand-900">
                {editing ? 'Edit Material' : 'New Reading Material'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-sand-500 hover:text-sand-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="overflow-y-auto flex-1 p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-sand-600 mb-2">Image</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                {imagePreview ? (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden border border-sand-200">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 w-7 h-7 bg-sand-900/30 hover:bg-sand-900/50 rounded-lg flex items-center justify-center transition-colors"
                    >
                      <X className="w-4 h-4 text-sand-900" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-28 border-2 border-dashed border-sand-200 hover:border-accent-300 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors"
                  >
                    <ImagePlus className="w-6 h-6 text-sand-500" />
                    <span className="text-xs text-sand-500">Click to upload (max 5MB)</span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-sand-600 mb-2">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                  placeholder="Material title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-sand-600 mb-2">Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all resize-none"
                  placeholder="Reading content or passage..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-sand-600 mb-2">Difficulty</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
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
                <label className="block text-sm font-medium text-sand-600 mb-2">Assign to Student (optional)</label>
                <select
                  value={form.student_id}
                  onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                  className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                >
                  <option value="">All students</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.profile_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-sand-100 hover:bg-sand-200 text-sand-700 font-medium rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="flex-1 py-3 bg-accent-600 hover:bg-accent-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : saving ? 'Saving...' : editing ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
      </Modal>
      )}
    </div>
  );
}