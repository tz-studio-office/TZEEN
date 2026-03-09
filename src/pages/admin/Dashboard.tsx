import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Clock3,
  GraduationCap,
  Shield,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';

interface SystemStats {
  totalUsers: number;
  totalCoaches: number;
  totalStudents: number;
  totalAdmins: number;
  totalAssignments: number;
  pendingAssignments: number;
  completedAssignments: number;
  totalSessionsThisWeek: number;
  totalMinutesThisWeek: number;
  totalStudyPlans: number;
  totalTemplates: number;
  recentUsers: Profile[];
}

function StatPanel({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-[2rem] border border-sand-900/8 bg-white/70 p-6 shadow-soft">
      <p className="editorial-kicker">{label}</p>
      <div className="mt-4 font-display text-5xl font-bold leading-none tracking-[-0.07em] text-sand-900">{value}</div>
      <p className="mt-4 text-sm leading-6 text-sand-500">{detail}</p>
    </div>
  );
}

function SystemRow({
  icon: Icon,
  label,
  description,
  value,
}: {
  icon: typeof Users;
  label: string;
  description: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[1.6rem] border border-sand-900/8 bg-[#fbfbf8] px-4 py-4">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-sand-900/8 bg-white text-sand-900">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-[-0.02em] text-sand-900">{label}</p>
          <p className="text-xs text-sand-500">{description}</p>
        </div>
      </div>
      <div className="font-display text-3xl font-bold tracking-[-0.06em] text-sand-900">{value}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    const [profilesRes, assignmentsRes, sessionsRes, plansRes, templatesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('assignments').select('id, status'),
      supabase
        .from('study_sessions')
        .select('id, duration_minutes')
        .gte('started_at', weekStart.toISOString())
        .lte('started_at', weekEnd.toISOString()),
      supabase.from('study_plans').select('id'),
      supabase.from('curriculum_templates').select('id'),
    ]);

    const profiles = profilesRes.data || [];
    const assignments = assignmentsRes.data || [];
    const sessions = sessionsRes.data || [];

    setStats({
      totalUsers: profiles.length,
      totalCoaches: profiles.filter((p) => p.role === 'coach').length,
      totalStudents: profiles.filter((p) => p.role === 'student').length,
      totalAdmins: profiles.filter((p) => p.role === 'admin').length,
      totalAssignments: assignments.length,
      pendingAssignments: assignments.filter((a) => a.status === 'pending').length,
      completedAssignments: assignments.filter((a) => a.status === 'completed').length,
      totalSessionsThisWeek: sessions.length,
      totalMinutesThisWeek: sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0),
      totalStudyPlans: plansRes.data?.length || 0,
      totalTemplates: templatesRes.data?.length || 0,
      recentUsers: profiles.slice(0, 5),
    });
    setLoading(false);
  }

  if (loading || !stats) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-sand-900/10 bg-white/70 px-5 py-3 text-sm font-medium text-sand-600 shadow-soft">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sand-900" />
          Loading interface
        </div>
      </div>
    );
  }

  const completionRate = stats.totalAssignments > 0 ? Math.round((stats.completedAssignments / stats.totalAssignments) * 100) : 0;
  const weeklyHours = Math.round((stats.totalMinutesThisWeek / 60) * 10) / 10;

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="rounded-[2.5rem] border border-sand-900/8 bg-white/75 p-8 shadow-shell">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="editorial-kicker">01 / Admin Dashboard</p>
              <h2 className="mt-5 font-display text-[clamp(3rem,7vw,6.5rem)] font-bold leading-[0.88] tracking-[-0.08em] text-sand-900">
                BUILDING
                <br />
                LEARNING
                <br />
                SYSTEMS.
              </h2>
              <p className="mt-6 max-w-xl text-base leading-7 text-sand-600">
                Structure your organization, shape access, and manage the operating layer of the platform through a
                quieter, more editorial interface.
              </p>
            </div>

            <Link
              to="/admin/users"
              className="inline-flex items-center gap-2 rounded-full bg-sand-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sand-800"
            >
              Manage Users
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <StatPanel
              label="Users"
              value={stats.totalUsers}
              detail={`${stats.totalAdmins} admin / ${stats.totalCoaches} coach / ${stats.totalStudents} student`}
            />
            <StatPanel label="Weekly Study" value={`${weeklyHours}h`} detail={`${stats.totalSessionsThisWeek} logged sessions this week`} />
            <StatPanel label="Completion" value={`${completionRate}%`} detail={`${stats.completedAssignments} completed of ${stats.totalAssignments} assignments`} />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[2.5rem] border border-sand-900/8 bg-[#111111] p-7 text-white shadow-shell">
            <p className="editorial-kicker !text-white/45">System focus</p>
            <div className="mt-8 space-y-4 font-display text-[clamp(1.7rem,4vw,2.6rem)] font-bold uppercase leading-[1.02] tracking-[-0.06em]">
              <div>Education</div>
              <div>Operations</div>
              <div>Structure</div>
            </div>
            <p className="mt-8 text-sm leading-6 text-white/65">
              Minimal, premium, monochrome. A learning management layer with editorial hierarchy instead of default SaaS visuals.
            </p>
          </div>

          <div className="rounded-[2.5rem] border border-sand-900/8 bg-white/75 p-7 shadow-soft">
            <p className="editorial-kicker">Today</p>
            <p className="mt-5 font-display text-4xl font-bold tracking-[-0.06em] text-sand-900">{format(new Date(), 'MMM d')}</p>
            <p className="mt-2 text-sm text-sand-500">{format(new Date(), 'EEEE')}</p>
            <div className="mt-8 space-y-3 text-sm leading-6 text-sand-600">
              <div className="flex items-center justify-between rounded-[1.2rem] border border-sand-900/8 bg-[#fbfbf8] px-4 py-3">
                <span>Study plans</span>
                <span className="font-semibold text-sand-900">{stats.totalStudyPlans}</span>
              </div>
              <div className="flex items-center justify-between rounded-[1.2rem] border border-sand-900/8 bg-[#fbfbf8] px-4 py-3">
                <span>Templates</span>
                <span className="font-semibold text-sand-900">{stats.totalTemplates}</span>
              </div>
              <div className="flex items-center justify-between rounded-[1.2rem] border border-sand-900/8 bg-[#fbfbf8] px-4 py-3">
                <span>Pending assignments</span>
                <span className="font-semibold text-sand-900">{stats.pendingAssignments}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2.5rem] border border-sand-900/8 bg-white/75 p-7 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="editorial-kicker">02 / System Overview</p>
              <h3 className="mt-3 font-display text-4xl font-bold tracking-[-0.06em] text-sand-900">Quiet Metrics</h3>
            </div>
            <Sparkles className="h-5 w-5 text-sand-400" />
          </div>

          <div className="mt-8 grid gap-4">
            <SystemRow icon={Shield} label="Admins" description="Global system operators" value={stats.totalAdmins} />
            <SystemRow icon={UserCheck} label="Coaches" description="Active coaching staff" value={stats.totalCoaches} />
            <SystemRow icon={GraduationCap} label="Students" description="Enrolled learners" value={stats.totalStudents} />
            <SystemRow icon={BookOpen} label="Study Plans" description="Structured learning systems" value={stats.totalStudyPlans} />
            <SystemRow icon={ClipboardList} label="Templates" description="Reusable curriculum structures" value={stats.totalTemplates} />
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-sand-900/8 bg-white/75 p-7 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="editorial-kicker">03 / Recent Users</p>
              <h3 className="mt-3 font-display text-4xl font-bold tracking-[-0.06em] text-sand-900">People Flow</h3>
            </div>
            <Link to="/admin/users" className="text-sm font-semibold text-sand-500 transition hover:text-sand-900">
              View all
            </Link>
          </div>

          <div className="mt-8 space-y-3">
            {stats.recentUsers.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-sand-900/10 bg-[#fbfbf8] p-6 text-sm text-sand-500">
                No users yet.
              </div>
            ) : (
              stats.recentUsers.map((profile, index) => {
                const iconMap = {
                  admin: Shield,
                  coach: UserCheck,
                  student: GraduationCap,
                } as const;

                const Icon = iconMap[profile.role] || Users;

                return (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between gap-4 rounded-[1.7rem] border border-sand-900/8 bg-[#fbfbf8] px-4 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-sand-900/8 bg-white text-sand-900">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-[-0.02em] text-sand-900">
                          {profile.full_name || 'Unnamed'}
                        </p>
                        <p className="text-xs uppercase tracking-[0.18em] text-sand-400">{profile.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-2xl font-bold tracking-[-0.05em] text-sand-900">{String(index + 1).padStart(2, '0')}</p>
                      <p className="text-[11px] uppercase tracking-caps text-sand-400">
                        {format(new Date(profile.created_at), 'MMM d')}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2.5rem] border border-sand-900/8 bg-white/75 p-7 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="editorial-kicker">04 / Quick Actions</p>
            <h3 className="mt-3 font-display text-4xl font-bold tracking-[-0.06em] text-sand-900">Operational Paths</h3>
          </div>
          <p className="max-w-xl text-sm leading-6 text-sand-500">
            Use these shortcuts to move through the most important system functions without dropping into a dense admin-tool layout.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {[
            {
              to: '/admin/users',
              title: 'User Management',
              body: 'Assign roles, adjust access, and refine organizational structure.',
            },
            {
              to: '/students',
              title: 'All Students',
              body: 'Review enrolled learners and move into coaching details quickly.',
            },
            {
              to: '/templates',
              title: 'Templates',
              body: 'Build reusable learning systems with a cleaner visual language.',
            },
          ].map((action, index) => (
            <Link
              key={action.title}
              to={action.to}
              className="group rounded-[2rem] border border-sand-900/8 bg-[#fbfbf8] p-6 transition hover:-translate-y-0.5 hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-caps text-sand-400">0{index + 1}</p>
                <ArrowRight className="h-4 w-4 text-sand-300 transition group-hover:translate-x-0.5 group-hover:text-sand-900" />
              </div>
              <h4 className="mt-8 font-display text-[2rem] font-bold leading-[0.95] tracking-[-0.06em] text-sand-900">{action.title}</h4>
              <p className="mt-4 text-sm leading-6 text-sand-500">{action.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-sand-900/8 bg-white/70 p-6 shadow-soft">
          <p className="editorial-kicker">Assignments</p>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div className="font-display text-5xl font-bold tracking-[-0.07em] text-sand-900">{stats.totalAssignments}</div>
            <ClipboardList className="h-5 w-5 text-sand-300" />
          </div>
          <p className="mt-4 text-sm text-sand-500">Current assignment volume across the platform.</p>
        </div>

        <div className="rounded-[2rem] border border-sand-900/8 bg-white/70 p-6 shadow-soft">
          <p className="editorial-kicker">Sessions</p>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div className="font-display text-5xl font-bold tracking-[-0.07em] text-sand-900">{stats.totalSessionsThisWeek}</div>
            <Clock3 className="h-5 w-5 text-sand-300" />
          </div>
          <p className="mt-4 text-sm text-sand-500">Tracked study sessions for the current week.</p>
        </div>

        <div className="rounded-[2rem] border border-sand-900/8 bg-white/70 p-6 shadow-soft">
          <p className="editorial-kicker">Students</p>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div className="font-display text-5xl font-bold tracking-[-0.07em] text-sand-900">{stats.totalStudents}</div>
            <GraduationCap className="h-5 w-5 text-sand-300" />
          </div>
          <p className="mt-4 text-sm text-sand-500">Total learners currently inside the system.</p>
        </div>
      </section>
    </div>
  );
}
