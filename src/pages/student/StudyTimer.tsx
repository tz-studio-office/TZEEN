import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { StudySession, Student, DailyMission, StudentLevel } from '../../types';
import { Play, Square, Clock, Calendar } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const XP_PER_LEVEL = 100;
type TimeRange = 'today' | 'week' | 'month';

export default function StudyTimer() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [timer, setTimer] = useState(0);
  const [range, setRange] = useState<TimeRange>('today');
  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<DailyMission[]>([]);
  const [level, setLevel] = useState<StudentLevel | null>(null);

  useEffect(() => {
    if (user) loadData();
  }, [user, range]);

  useEffect(() => {
    let interval: number;
    if (activeSession) {
      interval = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(activeSession.started_at).getTime()) / 1000);
        setTimer(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  async function loadData() {
    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('profile_id', user!.id)
      .maybeSingle();

    if (!studentData) {
      setLoading(false);
      return;
    }
    setStudent(studentData);

    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    let start: Date, end: Date;
    if (range === 'today') {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (range === 'week') {
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(now);
      end = endOfMonth(now);
    }

    const [sessionsRes, activeRes, missionsRes, levelRes] = await Promise.all([
      supabase
        .from('study_sessions')
        .select('*')
        .eq('student_id', studentData.id)
        .gte('started_at', start.toISOString())
        .lte('started_at', end.toISOString())
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false }),
      supabase
        .from('study_sessions')
        .select('*')
        .eq('student_id', studentData.id)
        .is('ended_at', null)
        .maybeSingle(),
      supabase
        .from('daily_missions')
        .select('*')
        .eq('student_id', studentData.id)
        .eq('date', todayStr),
      supabase
        .from('student_levels')
        .select('*')
        .eq('student_id', studentData.id)
        .maybeSingle(),
    ]);

    setSessions(sessionsRes.data || []);
    setActiveSession(activeRes.data);
    setMissions(missionsRes.data || []);
    setLevel(levelRes.data);
    setLoading(false);
  }

  async function startStudy() {
    if (!student) return;
    const { data } = await supabase
      .from('study_sessions')
      .insert({ student_id: student.id })
      .select()
      .maybeSingle();
    if (data) {
      setActiveSession(data);
      setTimer(0);
    }
  }

  async function stopStudy() {
    if (!activeSession || !student) return;
    const duration = Math.max(Math.floor(timer / 60), 1);
    await supabase
      .from('study_sessions')
      .update({ ended_at: new Date().toISOString(), duration_minutes: duration })
      .eq('id', activeSession.id);

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const { data: streakData } = await supabase
      .from('streaks')
      .select('*')
      .eq('student_id', student.id)
      .maybeSingle();

    if (streakData) {
      if (streakData.last_activity_date !== todayStr) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
        const newStreak = streakData.last_activity_date === yesterdayStr ? streakData.current_streak + 1 : 1;
        await supabase
          .from('streaks')
          .update({
            current_streak: newStreak,
            longest_streak: Math.max(newStreak, streakData.longest_streak),
            last_activity_date: todayStr,
            updated_at: new Date().toISOString(),
          })
          .eq('id', streakData.id);
      }
    } else {
      await supabase.from('streaks').insert({
        student_id: student.id,
        current_streak: 1,
        longest_streak: 1,
        last_activity_date: todayStr,
      });
    }

    const studyMission = missions.find((m) => m.mission_type === 'study_time');
    if (studyMission && !studyMission.completed) {
      const newVal = studyMission.current_value + duration;
      await supabase
        .from('daily_missions')
        .update({ current_value: newVal, completed: newVal >= studyMission.target_value })
        .eq('id', studyMission.id);
    }

    if (level) {
      const xpGain = Math.min(duration, 30);
      const newXp = level.xp + xpGain;
      const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;
      await supabase
        .from('student_levels')
        .update({ xp: newXp, level: newLevel, updated_at: new Date().toISOString() })
        .eq('id', level.id);
    } else {
      await supabase.from('student_levels').insert({
        student_id: student.id,
        level: 1,
        xp: Math.min(duration, 30),
      });
    }

    setActiveSession(null);
    setTimer(0);
    loadData();
  }

  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-20">
        <p className="text-sand-500">You haven't been registered as a student yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-sand-900">Study Timer</h1>

      <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-8">
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center">
            <svg className="w-56 h-56" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" fill="none" stroke="#e7e0d8" strokeWidth="8" />
              {activeSession && (
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke="url(#timerGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(timer % 3600) / 3600 * 565.48} 565.48`}
                  transform="rotate(-90 100 100)"
                  className="transition-all duration-1000"
                />
              )}
              <defs>
                <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#16a34a" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className={`text-4xl font-mono font-bold ${activeSession ? 'text-accent-600' : 'text-sand-500'}`}>
                {formatTime(timer)}
              </p>
              {activeSession && (
                <p className="text-sm text-sand-500 mt-1 animate-pulse">Recording</p>
              )}
            </div>
          </div>

          <div className="mt-8">
            {activeSession ? (
              <button
                onClick={stopStudy}
                className="inline-flex items-center gap-3 px-8 py-4 bg-red-50 text-red-600 hover:bg-red-500/20 rounded-2xl font-semibold text-lg transition-all"
              >
                <Square className="w-6 h-6" />
                Stop Study
              </button>
            ) : (
              <button
                onClick={startStudy}
                className="inline-flex items-center gap-3 px-8 py-4 bg-accent-600 text-white hover:bg-accent-500 rounded-2xl font-semibold text-lg transition-all"
              >
                <Play className="w-6 h-6" />
                Start Study
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-sand-200 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sand-200">
          <h2 className="text-lg font-semibold text-sand-900">Study History</h2>
          <div className="flex items-center gap-1 bg-sand-100 rounded-xl p-1">
            {(['today', 'week', 'month'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  range === r ? 'bg-accent-50 text-accent-600' : 'text-sand-500 hover:text-sand-900'
                }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-b border-sand-200/60 bg-sand-50/30">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-accent-600" />
            <span className="text-sm text-sand-500">Total:</span>
            <span className="text-lg font-bold text-sand-900">
              {totalHours}h {remainingMinutes}m
            </span>
            <span className="text-sm text-sand-500">({sessions.length} sessions)</span>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sand-500 text-sm">No sessions recorded for this period.</p>
          </div>
        ) : (
          <div className="divide-y divide-sand-200">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-6 py-3">
                <Calendar className="w-4 h-4 text-sand-500 flex-shrink-0" />
                <span className="text-sm text-sand-500 w-28 flex-shrink-0">
                  {format(new Date(s.started_at), 'MMM d, HH:mm')}
                </span>
                <div className="flex-1">
                  <div className="w-full h-2 bg-sand-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full"
                      style={{ width: `${Math.min((s.duration_minutes / 120) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium text-sand-900 w-16 text-right flex-shrink-0">
                  {s.duration_minutes}m
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
