import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { endOfDay, endOfWeek, format, startOfDay, startOfWeek } from 'date-fns';
import { ArrowRight, Clock3, PenLine, Play, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Assignment, GrammarTest, Student, StudyPlanItem, StudySession, TestAttempt } from '../../types';

type VocabSummary = {
  count: number;
  accuracy: number | null;
};

type GrammarSummary = {
  count: number;
  accuracy: number | null;
};

function minutesToLabel(minutes: number) {
  if (minutes >= 60) return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;
  return `${minutes}min`;
}

function calcVocabSummary(attempts: TestAttempt[]): VocabSummary {
  if (!attempts.length) return { count: 0, accuracy: null };
  const percents = attempts.map((attempt) => {
    if (typeof attempt.score_percent === 'number') return Number(attempt.score_percent);
    if (typeof attempt.score === 'number') return Number(attempt.score);
    const total = typeof attempt.total_questions === 'number' ? attempt.total_questions : typeof attempt.attempts === 'number' ? attempt.attempts : 0;
    const correct = typeof attempt.correct_count === 'number' ? attempt.correct_count : typeof attempt.correct_answers === 'number' ? attempt.correct_answers : 0;
    return total > 0 ? (correct / total) * 100 : 0;
  });
  return { count: attempts.length, accuracy: Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length) };
}

function calcGrammarSummary(tests: GrammarTest[]): GrammarSummary {
  if (!tests.length) return { count: 0, accuracy: null };
  const percents = tests.map((test) => (test.total_questions > 0 ? (test.correct_answers / test.total_questions) * 100 : 0));
  return { count: tests.length, accuracy: Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length) };
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [todayAssignments, setTodayAssignments] = useState<Assignment[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<Assignment[]>([]);
  const [todaySessions, setTodaySessions] = useState<StudySession[]>([]);
  const [weeklySessions, setWeeklySessions] = useState<StudySession[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<StudyPlanItem[]>([]);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [timer, setTimer] = useState(0);
  const [vocabAttempts, setVocabAttempts] = useState<TestAttempt[]>([]);
  const [grammarHistory, setGrammarHistory] = useState<GrammarTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) void loadData();
  }, [user]);

  useEffect(() => {
    let interval: number | undefined;
    if (activeSession) {
      interval = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(activeSession.started_at).getTime()) / 1000);
        setTimer(elapsed);
      }, 1000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [activeSession]);

  async function loadData() {
    if (!user) return;
    setLoading(true);

    const { data: studentData } = await supabase
      .from('students')
      .select('*, profiles!students_profile_id_fkey(full_name)')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (!studentData) {
      setStudent(null);
      setLoading(false);
      return;
    }

    setStudent(studentData as Student);

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const todayStr = format(now, 'yyyy-MM-dd');
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();

    const [todayAssignmentsRes, pendingAssignmentsRes, todaySessionsRes, weeklySessionsRes, activeRes, vocabAttemptsRes, grammarRes, plansRes] = await Promise.all([
      supabase.from('assignments').select('*').eq('student_id', studentData.id).gte('due_date', todayStr).lte('due_date', todayStr).order('due_date', { ascending: true }),
      supabase.from('assignments').select('*').eq('student_id', studentData.id).neq('status', 'completed').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('study_sessions').select('*').eq('student_id', studentData.id).gte('started_at', todayStart.toISOString()).lte('started_at', todayEnd.toISOString()).not('ended_at', 'is', null),
      supabase.from('study_sessions').select('*').eq('student_id', studentData.id).gte('started_at', weekStart.toISOString()).lte('started_at', weekEnd.toISOString()).not('ended_at', 'is', null),
      supabase.from('study_sessions').select('*').eq('student_id', studentData.id).is('ended_at', null).maybeSingle(),
      supabase.from('test_attempts').select('*').eq('student_id', studentData.id).order('completed_at', { ascending: false }),
      supabase.from('grammar_tests').select('*').eq('student_id', studentData.id).order('created_at', { ascending: false }),
      supabase.from('study_plans').select('id').eq('student_id', studentData.id),
    ]);

    setTodayAssignments((todayAssignmentsRes.data || []) as Assignment[]);
    setPendingAssignments((pendingAssignmentsRes.data || []) as Assignment[]);
    setTodaySessions((todaySessionsRes.data || []) as StudySession[]);
    setWeeklySessions((weeklySessionsRes.data || []) as StudySession[]);
    setActiveSession((activeRes.data as StudySession | null) || null);
    setVocabAttempts((vocabAttemptsRes.data || []) as TestAttempt[]);
    setGrammarHistory((grammarRes.data || []) as GrammarTest[]);

    const planIds = (plansRes.data || []).map((row: any) => row.id);
    if (planIds.length) {
      const { data: itemsData } = await supabase.from('study_plan_items').select('*').in('plan_id', planIds).eq('day_of_week', dayOfWeek).order('start_time');
      setTodaySchedule((itemsData || []) as StudyPlanItem[]);
    } else {
      setTodaySchedule([]);
    }

    setLoading(false);
  }

  async function startStudy() {
    if (!student) return;
    const { data } = await supabase.from('study_sessions').insert({ student_id: student.id }).select().maybeSingle();
    if (data) {
      setActiveSession(data as StudySession);
      setTimer(0);
    }
  }

  async function stopStudy() {
    if (!activeSession) return;
    const duration = Math.max(Math.floor(timer / 60), 1);
    await supabase.from('study_sessions').update({ ended_at: new Date().toISOString(), duration_minutes: duration }).eq('id', activeSession.id);
    setActiveSession(null);
    setTimer(0);
    await loadData();
  }

  const displayName = useMemo(() => {
    const fromProfile = (student as any)?.profiles?.full_name;
    if (fromProfile) return fromProfile.split(' ')[0];
    const metaName = user?.user_metadata?.full_name;
    if (metaName) return String(metaName).split(' ')[0];
    if (user?.email) return user.email.split('@')[0];
    return 'Student';
  }, [student, user]);

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const todayKey = format(now, 'yyyy-MM-dd');
  const todayMinutes = todaySessions.reduce((sum, session) => sum + (session.duration_minutes || 0), 0);
  const weeklyMinutes = weeklySessions.reduce((sum, session) => sum + (session.duration_minutes || 0), 0);
  const todayVocabSummary = calcVocabSummary(vocabAttempts.filter((attempt) => {
    const stamp = attempt.completed_at || attempt.created_at;
    return stamp ? format(new Date(stamp), 'yyyy-MM-dd') === todayKey : false;
  }));
  const weeklyVocabSummary = calcVocabSummary(vocabAttempts.filter((attempt) => {
    const stamp = attempt.completed_at || attempt.created_at;
    if (!stamp) return false;
    const date = new Date(stamp).getTime();
    return date >= weekStart.getTime() && date <= weekEnd.getTime();
  }));
  const todayGrammarSummary = calcGrammarSummary(grammarHistory.filter((test) => format(new Date(test.created_at), 'yyyy-MM-dd') === todayKey));
  const weeklyGrammarSummary = calcGrammarSummary(grammarHistory.filter((test) => {
    const date = new Date(test.created_at).getTime();
    return date >= weekStart.getTime() && date <= weekEnd.getTime();
  }));

  const todayTaskItems = [
    ...todayAssignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      subtitle: assignment.due_date ? `期限 ${assignment.due_date}` : '本日分の課題',
      link: '/assignments',
    })),
    { id: 'vocab-test', title: 'Vocabulary test', subtitle: `${todayVocabSummary.count}回 / ${todayVocabSummary.accuracy ?? 0}%`, link: '/vocab-test' },
    { id: 'grammar-test', title: 'Grammar test', subtitle: `${todayGrammarSummary.count}回 / ${todayGrammarSummary.accuracy ?? 0}%`, link: '/grammar-test' },
  ];

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" /></div>;
  if (!student) return <div className="rounded-[2rem] border border-black/10 bg-white p-10 text-center shadow-soft">生徒プロフィールがまだ紐づいていません。</div>;

  return (
    <div className="space-y-6">
      <section className="theme-surface rounded-[2rem] border theme-border px-8 py-8">
        <p className="text-[11px] font-semibold uppercase tracking-caps theme-muted">Today</p>
        <h1 className="mt-2 font-display text-5xl font-black tracking-[-0.06em] theme-text">{greeting},<br />{displayName}</h1>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="theme-surface rounded-[30px] border theme-border p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Today&apos;s Task</p>
              <h2 className="mt-2 text-3xl font-display font-black tracking-[-0.04em] theme-text">See what to do now</h2>
            </div>
            <Link to="/assignments" className="text-sm font-semibold text-theme-accent">All tasks</Link>
          </div>
          <div className="space-y-3">
            {todayTaskItems.map((item) => (
              <Link key={item.id} to={item.link} className="flex items-center justify-between rounded-[22px] border theme-border px-5 py-4 hover:shadow-soft">
                <div>
                  <p className="text-base font-semibold theme-text">{item.title}</p>
                  <p className="mt-1 text-sm theme-muted">{item.subtitle}</p>
                </div>
                <ArrowRight className="h-4 w-4 theme-muted" />
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="theme-surface rounded-[26px] border theme-border p-5">
            <p className="text-xs font-semibold uppercase tracking-caps theme-muted">勉強時間</p>
            <p className="mt-3 text-4xl font-display font-black tracking-[-0.05em] theme-text">{todayMinutes}<span className="ml-1 text-lg font-semibold">min</span></p>
            <p className="mt-2 text-sm theme-muted">Today</p>
          </div>
          <div className="theme-surface rounded-[26px] border theme-border p-5">
            <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Test · Vocab</p>
            <p className="mt-3 text-4xl font-display font-black tracking-[-0.05em] theme-text">{todayVocabSummary.count}</p>
            <p className="mt-2 text-sm theme-muted">正答率 {todayVocabSummary.accuracy ?? 0}%</p>
          </div>
          <div className="theme-surface rounded-[26px] border theme-border p-5">
            <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Test · Grammar</p>
            <p className="mt-3 text-4xl font-display font-black tracking-[-0.05em] theme-text">{todayGrammarSummary.count}</p>
            <p className="mt-2 text-sm theme-muted">正答率 {todayGrammarSummary.accuracy ?? 0}%</p>
          </div>
          <div className="theme-surface rounded-[26px] border theme-border p-5">
            <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Study timer</p>
            <p className="mt-3 text-2xl font-display font-black tracking-[-0.05em] theme-text">{activeSession ? format(new Date(activeSession.started_at), 'HH:mm') : 'Ready'}</p>
            <div className="mt-4 flex gap-2">
              {activeSession ? (
                <button type="button" onClick={() => void stopStudy()} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"><Clock3 className="h-4 w-4" /> Stop {Math.floor(timer / 60)}m</button>
              ) : (
                <button type="button" onClick={() => void startStudy()} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"><Play className="h-4 w-4" /> Start timer</button>
              )}
              <Link to="/timer" className="inline-flex items-center rounded-full border theme-border px-4 py-2 text-sm font-semibold theme-text">Timer</Link>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="theme-surface rounded-[30px] border theme-border p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Schedule</p>
            <h2 className="mt-2 text-3xl font-display font-black tracking-[-0.04em] theme-text">Today timeline</h2>
          </div>
          {todaySchedule.length === 0 ? (
            <div className="rounded-[22px] bg-black/5 px-4 py-6 text-sm theme-muted">今日のスケジュールはまだありません。</div>
          ) : (
            <div className="space-y-3">
              {todaySchedule.map((item) => (
                <div key={item.id} className="grid gap-3 rounded-[22px] border theme-border px-4 py-4 md:grid-cols-[110px_1fr] md:items-center">
                  <div className="text-sm font-semibold theme-text">{item.start_time || '--:--'} {item.end_time ? `- ${item.end_time}` : ''}</div>
                  <div>
                    <p className="text-base font-semibold theme-text">{item.activity}</p>
                    <p className="mt-1 text-sm theme-muted">Plan order {item.sort_order}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="theme-surface rounded-[30px] border theme-border p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Weekly</p>
            <h2 className="mt-2 text-3xl font-display font-black tracking-[-0.04em] theme-text">This week</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[22px] border theme-border p-4">
              <p className="text-xs font-semibold uppercase tracking-caps theme-muted">勉強時間</p>
              <p className="mt-3 text-3xl font-display font-black theme-text">{minutesToLabel(weeklyMinutes)}</p>
            </div>
            <div className="rounded-[22px] border theme-border p-4">
              <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Vocab</p>
              <p className="mt-3 text-3xl font-display font-black theme-text">{weeklyVocabSummary.count}</p>
              <p className="mt-2 text-sm theme-muted">正答率 {weeklyVocabSummary.accuracy ?? 0}%</p>
            </div>
            <div className="rounded-[22px] border theme-border p-4">
              <p className="text-xs font-semibold uppercase tracking-caps theme-muted">Grammar</p>
              <p className="mt-3 text-3xl font-display font-black theme-text">{weeklyGrammarSummary.count}</p>
              <p className="mt-2 text-sm theme-muted">正答率 {weeklyGrammarSummary.accuracy ?? 0}%</p>
            </div>
          </div>
          <div className="rounded-[22px] border theme-border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Link to="/vocab-test" className="flex items-center justify-between rounded-[18px] bg-black/5 px-4 py-3">
                <div className="flex items-center gap-3"><span className="rounded-full bg-violet-100 p-2 text-violet-600"><Zap className="h-4 w-4" /></span><span className="text-sm font-semibold theme-text">Vocabulary test</span></div>
                <span className="text-sm font-bold theme-text">{weeklyVocabSummary.accuracy ?? 0}%</span>
              </Link>
              <Link to="/grammar-test" className="flex items-center justify-between rounded-[18px] bg-black/5 px-4 py-3">
                <div className="flex items-center gap-3"><span className="rounded-full bg-amber-100 p-2 text-amber-600"><PenLine className="h-4 w-4" /></span><span className="text-sm font-semibold theme-text">Grammar test</span></div>
                <span className="text-sm font-bold theme-text">{weeklyGrammarSummary.accuracy ?? 0}%</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
