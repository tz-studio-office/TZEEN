import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Student, Assignment } from '../../types';
import { Users, ClipboardList, Clock, TrendingUp, ChevronRight, CircleUser as UserCircle } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';

interface StudentWithStats extends Student {
  pending_count: number;
  weekly_minutes: number;
  streak_count: number;
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [totalAssignments, setTotalAssignments] = useState(0);
  const [pendingAssignments, setPendingAssignments] = useState(0);
  const [totalWeeklyMinutes, setTotalWeeklyMinutes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    const { data: studentsData } = await supabase
      .from('students')
      .select('*, profiles!students_profile_id_fkey(full_name)')
      .eq('coach_id', user!.id);

    if (!studentsData || studentsData.length === 0) {
      setLoading(false);
      return;
    }

    const studentIds = studentsData.map((s) => s.id);
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    const [assignRes, sessionsRes, streaksRes] = await Promise.all([
      supabase.from('assignments').select('*').in('student_id', studentIds),
      supabase
        .from('study_sessions')
        .select('*')
        .in('student_id', studentIds)
        .gte('started_at', weekStart.toISOString())
        .lte('started_at', weekEnd.toISOString()),
      supabase.from('streaks').select('*').in('student_id', studentIds),
    ]);

    const allAssignments: Assignment[] = assignRes.data || [];
    const allSessions = sessionsRes.data || [];
    const allStreaks = streaksRes.data || [];

    setTotalAssignments(allAssignments.length);
    setPendingAssignments(allAssignments.filter((a) => a.status === 'pending').length);
    setTotalWeeklyMinutes(allSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0));

    const enriched: StudentWithStats[] = studentsData.map((s) => ({
      ...s,
      pending_count: allAssignments.filter((a) => a.student_id === s.id && a.status === 'pending').length,
      weekly_minutes: allSessions
        .filter((sess) => sess.student_id === s.id)
        .reduce((sum, sess) => sum + (sess.duration_minutes || 0), 0),
      streak_count: allStreaks.find((st) => st.student_id === s.id)?.current_streak || 0,
    }));

    setStudents(enriched);
    setLoading(false);
  }

  const totalWeeklyHours = Math.round((totalWeeklyMinutes / 60) * 10) / 10;

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
          <h1 className="text-2xl font-bold text-sand-900">Coach Dashboard</h1>
          <p className="text-sand-500 mt-1">{format(new Date(), 'EEEE, MMMM d')}</p>
        </div>
        <Link
          to="/students"
          className="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-xl text-sm transition-all"
        >
          Manage Students
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-accent-600" />
            <span className="text-xs font-medium text-sand-500 uppercase tracking-wider">Students</span>
          </div>
          <p className="text-3xl font-bold text-sand-900">{students.length}</p>
          <p className="text-xs text-sand-500 mt-1">active</p>
        </div>

        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-medium text-sand-500 uppercase tracking-wider">Pending</span>
          </div>
          <p className="text-3xl font-bold text-sand-900">{pendingAssignments}</p>
          <p className="text-xs text-sand-500 mt-1">assignments</p>
        </div>

        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-medium text-sand-500 uppercase tracking-wider">Weekly</span>
          </div>
          <p className="text-3xl font-bold text-sand-900">{totalWeeklyHours}h</p>
          <p className="text-xs text-sand-500 mt-1">total study</p>
        </div>

        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-medium text-sand-500 uppercase tracking-wider">Complete</span>
          </div>
          <p className="text-3xl font-bold text-sand-900">
            {totalAssignments > 0
              ? Math.round(((totalAssignments - pendingAssignments) / totalAssignments) * 100)
              : 0}
            %
          </p>
          <p className="text-xs text-sand-500 mt-1">rate</p>
        </div>
      </div>

      <div className="bg-white border border-sand-200 rounded-2xl shadow-sm">
        <div className="px-6 py-4 border-b border-sand-200">
          <h2 className="text-lg font-semibold text-sand-900">Student Overview</h2>
        </div>
        {students.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sand-500">No students yet.</p>
            <Link
              to="/students"
              className="inline-block mt-3 text-accent-600 hover:text-accent-500 text-sm font-medium transition-colors"
            >
              Add your first student
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-sand-200">
            {students.map((student) => (
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
                    {(student.profiles as unknown as { full_name: string })?.full_name || 'Student'}
                  </p>
                  <p className="text-xs text-sand-500 capitalize">{student.english_level}</p>
                </div>
                <div className="hidden sm:flex items-center gap-6 text-xs text-sand-500">
                  <div className="text-center">
                    <p className="font-medium text-sand-900">{student.pending_count}</p>
                    <p>pending</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sand-900">{Math.round(student.weekly_minutes / 60 * 10) / 10}h</p>
                    <p>this week</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sand-900">{student.streak_count}d</p>
                    <p>streak</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-sand-400 group-hover:text-sand-500 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
