import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Profile, UserRole } from '../../types';
import Modal from '../../components/Modal';
import {
  Shield,
  Users,
  UserCheck,
  GraduationCap,
  ChevronDown,
  Search,
  Plus,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';

const ROLE_CONFIG: Record<UserRole, { icon: typeof Shield; color: string; bg: string }> = {
  admin: { icon: Shield, color: 'text-red-600', bg: 'bg-red-50' },
  coach: { icon: UserCheck, color: 'text-accent-600', bg: 'bg-accent-50' },
  student: { icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
};

export default function UserManagement() {
  const { user, session, refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | UserRole>('all');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createData, setCreateData] = useState({ email: '', password: '', full_name: '', role: 'coach' as UserRole });
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (user) loadProfiles();
  }, [user]);

  async function loadProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setProfiles(data || []);
    setLoading(false);
  }

  async function changeRole(profileId: string, newRole: UserRole) {
    if (profileId === user!.id && newRole !== 'admin') {
      if (!confirm('You are about to remove your own admin role. Are you sure?')) return;
    }
    setUpdating(profileId);
    await supabase.from('profiles').update({ role: newRole }).eq('id', profileId);
    await loadProfiles();
    if (profileId === user!.id) await refreshProfile();
    setUpdating(null);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: createData.email,
        password: createData.password,
        full_name: createData.full_name,
        role: createData.role,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setCreateError(result.error || 'Failed to create user.');
      setCreating(false);
      return;
    }

    setCreating(false);
    setShowCreate(false);
    setCreateData({ email: '', password: '', full_name: '', role: 'coach' });
    await loadProfiles();
  }

  const filtered = profiles.filter((p) => {
    const matchesSearch =
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.includes(search);
    const matchesRole = filterRole === 'all' || p.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const counts = {
    admin: profiles.filter((p) => p.role === 'admin').length,
    coach: profiles.filter((p) => p.role === 'coach').length,
    student: profiles.filter((p) => p.role === 'student').length,
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
        <div>
          <h1 className="text-2xl font-bold text-sand-900">User Management</h1>
          <p className="text-sand-500 mt-1">Manage user roles and permissions</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-xl text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {showCreate && (
        <Modal
          open={showCreate}
          onClose={() => { setShowCreate(false); setCreateError(''); }}
          panelClassName="bg-white border border-sand-200 rounded-2xl shadow-2xl p-6 w-full max-w-3xl"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-sand-900">Create New User</h2>
            <button onClick={() => { setShowCreate(false); setCreateError(''); }} className="text-sand-500 hover:text-sand-900">
              <X className="w-5 h-5" />
            </button>
          </div>
          {createError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
              {createError}
            </div>
          )}
          <form onSubmit={handleCreateUser} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-sand-600 mb-2">Full Name</label>
              <input
                type="text"
                value={createData.full_name}
                onChange={(e) => setCreateData({ ...createData, full_name: e.target.value })}
                required
                className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                placeholder="John Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sand-600 mb-2">Email</label>
              <input
                type="email"
                value={createData.email}
                onChange={(e) => setCreateData({ ...createData, email: e.target.value })}
                required
                className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sand-600 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={createData.password}
                  onChange={(e) => setCreateData({ ...createData, password: e.target.value })}
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
              <label className="block text-sm font-medium text-sand-600 mb-2">Role</label>
              <select
                value={createData.role}
                onChange={(e) => setCreateData({ ...createData, role: e.target.value as UserRole })}
                className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
              >
                <option value="coach">Coach</option>
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-3 bg-accent-600 hover:bg-accent-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
      </Modal>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-red-600" />
            <span className="text-xs font-medium text-sand-500 uppercase tracking-wider">Admins</span>
          </div>
          <p className="text-3xl font-bold text-sand-900">{counts.admin}</p>
        </div>
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck className="w-5 h-5 text-accent-600" />
            <span className="text-xs font-medium text-sand-500 uppercase tracking-wider">Coaches</span>
          </div>
          <p className="text-3xl font-bold text-sand-900">{counts.coach}</p>
        </div>
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-medium text-sand-500 uppercase tracking-wider">Students</span>
          </div>
          <p className="text-3xl font-bold text-sand-900">{counts.student}</p>
        </div>
      </div>

      <div className="bg-white border border-sand-200 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-6 py-4 border-b border-sand-200">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sand-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full pl-10 pr-4 py-2.5 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 text-sm placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200"
            />
          </div>
          <div className="flex items-center gap-2 bg-sand-100 rounded-xl p-1">
            {(['all', 'admin', 'coach', 'student'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setFilterRole(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                  filterRole === r ? 'bg-accent-50 text-accent-600' : 'text-sand-500 hover:text-sand-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 text-sand-400 mx-auto mb-3" />
            <p className="text-sand-500">No users found.</p>
          </div>
        ) : (
          <div className="divide-y divide-sand-200">
            {filtered.map((profile) => {
              const config = ROLE_CONFIG[profile.role];
              const Icon = config.icon;
              return (
                <div key={profile.id} className="flex items-center gap-4 px-6 py-4">
                  <div className={`w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sand-900 truncate">
                      {profile.full_name || 'Unnamed User'}
                      {profile.id === user!.id && (
                        <span className="text-xs text-sand-500 ml-2">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-sand-500 truncate">{profile.id}</p>
                  </div>
                  <div className="relative flex-shrink-0">
                    <select
                      value={profile.role}
                      onChange={(e) => changeRole(profile.id, e.target.value as UserRole)}
                      disabled={updating === profile.id}
                      className={`appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-200 ${
                        profile.role === 'admin'
                          ? 'bg-red-50 border-red-200 text-red-600'
                          : profile.role === 'coach'
                            ? 'bg-accent-50 border-accent-200 text-accent-600'
                            : 'bg-blue-50 border-blue-200 text-blue-600'
                      } disabled:opacity-50`}
                    >
                      <option value="admin">Admin</option>
                      <option value="coach">Coach</option>
                      <option value="student">Student</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sand-500 pointer-events-none" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}