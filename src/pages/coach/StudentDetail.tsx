import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Student, Assignment, StudySession, Streak, WeeklyGoal, VocabTest, GrammarTest, ReadingSession, ReadingMaterial, WeeklyReport, StudentLevel } from '../../types';
import {
  ArrowLeft, Flame, Clock, ClipboardList, Target, Trash2, CreditCard as Edit3,
  Save, X, TrendingUp, BookOpen, PenLine, Zap, FileText, BarChart3, Plus,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import Chat from '../../components/Chat';
import Modal from '../../components/Modal';

type Tab = 'overview' | 'chat' | 'reports';

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState<WeeklyGoal | null>(null);
  const [vocabTests, setVocabTests] = useState<VocabTest[]>([]);
  const [grammarTests, setGrammarTests] = useState<GrammarTest[]>([]);
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [level, setLevel] = useState<StudentLevel | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ goal: '', english_level: '', textbook: '' });
  const [goalHours, setGoalHours] = useState(10);
  const [goalDesc, setGoalDesc] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [readingMaterials, setReadingMaterials] = useState<ReadingMaterial[]>([]);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [materialForm, setMaterialForm] = useState({ title: '', content: '', difficulty: 'beginner' });
  const [savingMaterial, setSavingMaterial] = useState(false);

  useEffect(() => { if (id && user) loadData(); }, [id, user]);

  async function loadData() {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    const [studentRes, assignRes, sessionRes, streakRes, goalRes, vocabRes, grammarRes, readingRes, reportRes, levelRes, materialsRes] = await Promise.all([
      supabase.from('students').select('*, profiles!students_profile_id_fkey(full_name)').eq('id', id!).maybeSingle(),
      supabase.from('assignments').select('*').eq('student_id', id!).order('created_at', { ascending: false }),
      supabase.from('study_sessions').select('*').eq('student_id', id!).gte('started_at', weekStart.toISOString()).lte('started_at', weekEnd.toISOString()).not('ended_at', 'is', null),
      supabase.from('streaks').select('*').eq('student_id', id!).maybeSingle(),
      supabase.from('weekly_goals').select('*').eq('student_id', id!).gte('week_start', format(weekStart, 'yyyy-MM-dd')).lte('week_start', format(weekEnd, 'yyyy-MM-dd')).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('vocab_tests').select('*').eq('student_id', id!).order('created_at', { ascending: false }).limit(5),
      supabase.from('grammar_tests').select('*').eq('student_id', id!).order('created_at', { ascending: false }).limit(5),
      supabase.from('reading_sessions').select('*').eq('student_id', id!).order('created_at', { ascending: false }).limit(5),
      supabase.from('weekly_reports').select('*').eq('student_id', id!).order('week_start', { ascending: false }).limit(8),
      supabase.from('student_levels').select('*').eq('student_id', id!).maybeSingle(),
      supabase.from('reading_materials').select('*').or(`student_id.eq.${id!},student_id.is.null`).eq('coach_id', user!.id).order('created_at', { ascending: false }),
    ]);

    if (studentRes.data) {
      setStudent(studentRes.data);
      setEditData({ goal: studentRes.data.goal, english_level: studentRes.data.english_level, textbook: studentRes.data.textbook });
    }
    setAssignments(assignRes.data || []);
    setSessions(sessionRes.data || []);
    setStreak(streakRes.data);
    setWeeklyGoal(goalRes.data);
    setVocabTests(vocabRes.data || []);
    setGrammarTests(grammarRes.data || []);
    setReadingSessions(readingRes.data || []);
    setReports(reportRes.data || []);
    setLevel(levelRes.data);
    setReadingMaterials(materialsRes.data || []);
    if (goalRes.data) { setGoalHours(goalRes.data.study_hours_target); setGoalDesc(goalRes.data.description); }
    setLoading(false);
  }

  async function handleSave() {
    await supabase.from('students').update(editData).eq('id', id!);
    setEditing(false); loadData();
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to remove this student?')) return;
    await supabase.from('students').delete().eq('id', id!);
    navigate('/students');
  }

  async function saveWeeklyGoal() {
    if (!student || !user) return;
    setSavingGoal(true);
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    if (weeklyGoal) {
      await supabase.from('weekly_goals').update({ study_hours_target: goalHours, description: goalDesc }).eq('id', weeklyGoal.id);
    } else {
      await supabase.from('weekly_goals').insert({ student_id: student.id, coach_id: user.id, week_start: weekStart, study_hours_target: goalHours, description: goalDesc });
    }
    setSavingGoal(false); loadData();
  }

  async function addReadingMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!student || !user) return;
    setSavingMaterial(true);
    await supabase.from('reading_materials').insert({
      coach_id: user.id,
      student_id: student.id,
      title: materialForm.title,
      content: materialForm.content,
      difficulty: materialForm.difficulty,
    });
    setSavingMaterial(false);
    setShowAddMaterial(false);
    setMaterialForm({ title: '', content: '', difficulty: 'beginner' });
    loadData();
  }

  async function deleteReadingMaterial(materialId: string) {
    await supabase.from('reading_materials').delete().eq('id', materialId);
    setReadingMaterials((prev) => prev.filter((m) => m.id !== materialId));
  }

  async function generateWeeklyReport() {
    if (!student || !user) return;
    setGeneratingReport(true);
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weeklyMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const studyHours = Math.round((weeklyMinutes / 60) * 10) / 10;
    const vocabAvg = vocabTests.length > 0 ? Math.round(vocabTests.reduce((s, t) => s + (t.total_questions > 0 ? (t.correct_answers / t.total_questions) * 100 : 0), 0) / vocabTests.length) : null;
    const grammarAvg = grammarTests.length > 0 ? Math.round(grammarTests.reduce((s, t) => s + (t.total_questions > 0 ? (t.correct_answers / t.total_questions) * 100 : 0), 0) / grammarTests.length) : null;
    const readingTotal = readingSessions.length;
    const streakDays = streak?.current_streak || 0;

    const summaryParts = [`Study time: ${studyHours}h this week.`];
    if (vocabAvg !== null) summaryParts.push(`Vocabulary accuracy: ${vocabAvg}%.`);
    if (grammarAvg !== null) summaryParts.push(`Grammar accuracy: ${grammarAvg}%.`);
    if (readingTotal > 0) summaryParts.push(`${readingTotal} reading sessions completed.`);
    summaryParts.push(`Current streak: ${streakDays} days.`);
    const pendingCount = assignments.filter(a => a.status === 'pending').length;
    const completedCount = assignments.filter(a => a.status === 'completed').length;
    summaryParts.push(`Assignments: ${completedCount} completed, ${pendingCount} pending.`);

    await supabase.from('weekly_reports').insert({
      student_id: student.id,
      week_start: weekStartStr,
      study_hours: studyHours,
      vocab_accuracy: vocabAvg,
      grammar_accuracy: grammarAvg,
      reading_score: readingTotal,
      streak_days: streakDays,
      summary: summaryParts.join('\n'),
    });

    setGeneratingReport(false); loadData();
  }

  const weeklyMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const weeklyHours = Math.round((weeklyMinutes / 60) * 10) / 10;
  const pendingCount = assignments.filter((a) => a.status === 'pending').length;
  const completedCount = assignments.filter((a) => a.status === 'completed').length;
  const goalTarget = weeklyGoal?.study_hours_target || goalHours;
  const goalPercent = goalTarget > 0 ? Math.min(Math.round((weeklyHours / goalTarget) * 100), 100) : 0;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!student) return <div className="text-center py-20"><p className="text-sand-500">Student not found.</p></div>;

  const profileName = (student.profiles as unknown as { full_name: string })?.full_name || 'Student';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/students')} className="text-sand-500 hover:text-sand-900 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-sand-900">{profileName}</h1>
            {level && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-bold text-blue-600">
                <Zap className="w-3 h-3" /> Lv.{level.level}
              </span>
            )}
          </div>
          <p className="text-sand-500 text-sm mt-0.5">Started {format(new Date(student.start_date), 'MMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(!editing)} className="p-2 text-sand-500 hover:text-sand-900 hover:bg-sand-100 rounded-xl transition-all"><Edit3 className="w-5 h-5" /></button>
          <button onClick={handleDelete} className="p-2 text-sand-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-white border border-sand-200 rounded-xl p-1">
        {([['overview', 'Overview'], ['chat', 'Chat'], ['reports', 'Reports']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-accent-50 text-accent-600' : 'text-sand-500 hover:text-sand-900'}`}>{label}</button>
        ))}
      </div>

      {tab === 'chat' && (
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 16rem)' }}>
          <Chat studentId={student.id} />
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-sand-900">Weekly Reports</h2>
            <button onClick={generateWeeklyReport} disabled={generatingReport} className="flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-xl text-sm transition-all disabled:opacity-50">
              <FileText className="w-4 h-4" />
              {generatingReport ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
          {reports.length === 0 ? (
            <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-8 text-center">
              <BarChart3 className="w-10 h-10 text-sand-400 mx-auto mb-3" />
              <p className="text-sand-500">No reports yet. Generate one above.</p>
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="bg-white border border-sand-200 rounded-2xl shadow-sm p-6">
                <h3 className="text-sand-900 font-semibold mb-3">Week of {format(new Date(report.week_start), 'MMM d, yyyy')}</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <div className="bg-sand-50/50 rounded-xl p-3">
                    <p className="text-xs text-sand-500">Study Time</p>
                    <p className="text-xl font-bold text-sand-900">{report.study_hours}h</p>
                  </div>
                  {report.vocab_accuracy !== null && (
                    <div className="bg-sand-50/50 rounded-xl p-3">
                      <p className="text-xs text-sand-500">Vocabulary</p>
                      <p className="text-xl font-bold text-sand-900">{report.vocab_accuracy}%</p>
                    </div>
                  )}
                  {report.grammar_accuracy !== null && (
                    <div className="bg-sand-50/50 rounded-xl p-3">
                      <p className="text-xs text-sand-500">Grammar</p>
                      <p className="text-xl font-bold text-sand-900">{report.grammar_accuracy}%</p>
                    </div>
                  )}
                  <div className="bg-sand-50/50 rounded-xl p-3">
                    <p className="text-xs text-sand-500">Streak</p>
                    <p className="text-xl font-bold text-sand-900">{report.streak_days}d</p>
                  </div>
                </div>
                {report.summary && <p className="text-sm text-sand-600 whitespace-pre-wrap bg-sand-50/30 rounded-xl p-3">{report.summary}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'overview' && (
        <>
          {editing && (
            <Modal
              open={editing}
              onClose={() => setEditing(false)}
              panelClassName="bg-white border border-sand-200 rounded-2xl shadow-2xl w-full max-w-xl"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-sand-200 pb-4">
                  <h2 className="text-lg font-semibold text-sand-900">Edit Student</h2>
                  <button onClick={() => setEditing(false)} className="text-sand-500 hover:text-sand-900 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div><label className="block text-sm font-medium text-sand-600 mb-2">Goal</label><input type="text" value={editData.goal} onChange={(e) => setEditData({ ...editData, goal: e.target.value })} className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none focus:ring-2 focus:ring-accent-200" /></div>
                <div>
                  <label className="block text-sm font-medium text-sand-600 mb-2">Level</label>
                  <select value={editData.english_level} onChange={(e) => setEditData({ ...editData, english_level: e.target.value })} className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none focus:ring-2 focus:ring-accent-200">
                    <option value="beginner">Beginner</option>
                    <option value="elementary">Elementary</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="upper-intermediate">Upper Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-sand-600 mb-2">Textbook</label><input type="text" value={editData.textbook} onChange={(e) => setEditData({ ...editData, textbook: e.target.value })} className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none focus:ring-2 focus:ring-accent-200" /></div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setEditing(false)} className="flex items-center gap-2 px-4 py-2 bg-sand-100 text-sand-700 rounded-xl text-sm font-medium hover:bg-sand-200"><X className="w-4 h-4" /> Cancel</button>
                  <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-xl text-sm font-semibold hover:bg-accent-500"><Save className="w-4 h-4" /> Save</button>
                </div>
              </div>
            </Modal>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3"><Flame className="w-5 h-5 text-amber-600" /><span className="text-xs font-medium text-sand-500 uppercase tracking-wider">Streak</span></div>
              <p className="text-3xl font-bold text-sand-900">{streak?.current_streak || 0}d</p>
            </div>
            <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3"><Clock className="w-5 h-5 text-blue-600" /><span className="text-xs font-medium text-sand-500 uppercase tracking-wider">Weekly</span></div>
              <p className="text-3xl font-bold text-sand-900">{weeklyHours}h</p>
            </div>
            <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3"><ClipboardList className="w-5 h-5 text-amber-600" /><span className="text-xs font-medium text-sand-500 uppercase tracking-wider">Pending</span></div>
              <p className="text-3xl font-bold text-sand-900">{pendingCount}</p>
            </div>
            <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3"><Target className="w-5 h-5 text-accent-600" /><span className="text-xs font-medium text-sand-500 uppercase tracking-wider">Done</span></div>
              <p className="text-3xl font-bold text-sand-900">{completedCount}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-sand-900 mb-1">Student Info</h2>
              <div className="grid sm:grid-cols-3 gap-4 mt-4">
                <div><p className="text-xs text-sand-500 uppercase tracking-wider mb-1">Goal</p><p className="text-sm text-sand-900">{student.goal || 'Not set'}</p></div>
                <div><p className="text-xs text-sand-500 uppercase tracking-wider mb-1">Level</p><p className="text-sm text-sand-900 capitalize">{student.english_level}</p></div>
                <div><p className="text-xs text-sand-500 uppercase tracking-wider mb-1">Textbook</p><p className="text-sm text-sand-900">{student.textbook || 'Not set'}</p></div>
              </div>
            </div>
            <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-sand-900">Weekly Goal</h2><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2"><span className="text-sand-500">Progress</span><span className="text-sand-900 font-medium">{weeklyHours}h / {goalTarget}h</span></div>
                <div className="w-full h-3 bg-sand-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" style={{ width: `${goalPercent}%` }} /></div>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1"><label className="block text-xs text-sand-500 mb-1">Target (hours)</label><input type="number" min="1" max="168" value={goalHours} onChange={(e) => setGoalHours(Number(e.target.value))} className="w-full px-3 py-2 bg-sand-50 border border-sand-200 rounded-lg text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-accent-200" /></div>
                <div className="flex-1"><label className="block text-xs text-sand-500 mb-1">Note</label><input type="text" value={goalDesc} onChange={(e) => setGoalDesc(e.target.value)} placeholder="e.g., Focus on reading" className="w-full px-3 py-2 bg-sand-50 border border-sand-200 rounded-lg text-sand-900 text-sm placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200" /></div>
                <button onClick={saveWeeklyGoal} disabled={savingGoal} className="px-4 py-2 bg-accent-600 text-white rounded-lg text-sm font-semibold hover:bg-accent-500 disabled:opacity-50 flex-shrink-0">{savingGoal ? '...' : weeklyGoal ? 'Update' : 'Set'}</button>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {vocabTests.length > 0 && (
              <div className="bg-white border border-sand-200 rounded-2xl shadow-sm">
                <div className="px-5 py-3 border-b border-sand-200 flex items-center gap-2"><BookOpen className="w-4 h-4 text-accent-600" /><h3 className="text-sm font-semibold text-sand-900">Vocabulary Tests</h3></div>
                <div className="divide-y divide-sand-200">
                  {vocabTests.map((t) => {
                    const pct = t.total_questions > 0 ? Math.round((t.correct_answers / t.total_questions) * 100) : 0;
                    return <div key={t.id} className="flex items-center justify-between px-5 py-2.5"><span className="text-xs text-sand-500">{format(new Date(t.created_at), 'MMM d')}</span><span className={`text-sm font-bold ${pct >= 80 ? 'text-accent-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span></div>;
                  })}
                </div>
              </div>
            )}
            {grammarTests.length > 0 && (
              <div className="bg-white border border-sand-200 rounded-2xl shadow-sm">
                <div className="px-5 py-3 border-b border-sand-200 flex items-center gap-2"><PenLine className="w-4 h-4 text-blue-600" /><h3 className="text-sm font-semibold text-sand-900">Grammar Tests</h3></div>
                <div className="divide-y divide-sand-200">
                  {grammarTests.map((t) => {
                    const pct = t.total_questions > 0 ? Math.round((t.correct_answers / t.total_questions) * 100) : 0;
                    return <div key={t.id} className="flex items-center justify-between px-5 py-2.5"><span className="text-xs text-sand-500">{format(new Date(t.created_at), 'MMM d')}</span><span className={`text-sm font-bold ${pct >= 80 ? 'text-accent-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span></div>;
                  })}
                </div>
              </div>
            )}
            {readingSessions.length > 0 && (
              <div className="bg-white border border-sand-200 rounded-2xl shadow-sm">
                <div className="px-5 py-3 border-b border-sand-200 flex items-center gap-2"><BookOpen className="w-4 h-4 text-emerald-600" /><h3 className="text-sm font-semibold text-sand-900">Reading Sessions</h3></div>
                <div className="divide-y divide-sand-200">
                  {readingSessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-2.5"><span className="text-xs text-sand-500">{format(new Date(s.created_at), 'MMM d')}</span><span className="text-sm font-medium text-sand-900">{Math.round(s.duration_seconds / 60)}m</span></div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border border-sand-200 rounded-2xl shadow-sm">
            <div className="px-6 py-4 border-b border-sand-200"><h2 className="text-lg font-semibold text-sand-900">Recent Assignments</h2></div>
            {assignments.length === 0 ? (
              <div className="p-8 text-center"><p className="text-sand-500">No assignments yet.</p></div>
            ) : (
              <div className="divide-y divide-sand-200">
                {assignments.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-center gap-4 px-6 py-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.status === 'completed' ? 'bg-accent-500' : 'bg-amber-500'}`} />
                    <div className="flex-1 min-w-0"><p className="text-sm text-sand-900 truncate">{a.title}</p><p className="text-xs text-sand-500">{a.due_date ? `Due ${format(new Date(a.due_date), 'MMM d')}` : 'No due date'}</p></div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${a.status === 'completed' ? 'bg-accent-50 text-accent-600' : 'bg-amber-50 text-amber-600'}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-sand-200 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-sand-200">
              <h2 className="text-lg font-semibold text-sand-900">Reading Materials</h2>
              <button
                onClick={() => setShowAddMaterial(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-50 text-accent-600 hover:bg-accent-100 rounded-lg text-xs font-medium transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Material
              </button>
            </div>
            {readingMaterials.length === 0 ? (
              <div className="p-8 text-center">
                <BookOpen className="w-10 h-10 text-sand-400 mx-auto mb-3" />
                <p className="text-sand-500">No reading materials yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-sand-200">
                {readingMaterials.map((m) => (
                  <div key={m.id} className="flex items-center gap-4 px-6 py-3">
                    <BookOpen className="w-4 h-4 text-accent-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-sand-900 truncate">{m.title}</p>
                      <p className="text-xs text-sand-500 capitalize">{m.difficulty}</p>
                    </div>
                    <button
                      onClick={() => deleteReadingMaterial(m.id)}
                      className="p-1 text-sand-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showAddMaterial && (
            <Modal
              open={showAddMaterial}
              onClose={() => setShowAddMaterial(false)}
              panelClassName="bg-white border border-sand-200 rounded-2xl shadow-2xl w-full max-w-lg"
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-sand-200">
                  <h2 className="text-lg font-semibold text-sand-900">Add Reading Material</h2>
                  <button onClick={() => setShowAddMaterial(false)} className="text-sand-500 hover:text-sand-900 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={addReadingMaterial} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-sand-600 mb-2">Title</label>
                    <input
                      type="text"
                      value={materialForm.title}
                      onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
                      required
                      className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                      placeholder="e.g., The Tortoise and the Hare"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-sand-600 mb-2">Difficulty</label>
                    <select
                      value={materialForm.difficulty}
                      onChange={(e) => setMaterialForm({ ...materialForm, difficulty: e.target.value })}
                      className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="elementary">Elementary</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-sand-600 mb-2">Content</label>
                    <textarea
                      value={materialForm.content}
                      onChange={(e) => setMaterialForm({ ...materialForm, content: e.target.value })}
                      required
                      rows={8}
                      className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all resize-none"
                      placeholder="Paste or type the reading passage here..."
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddMaterial(false)}
                      className="flex-1 py-3 bg-sand-100 hover:bg-sand-200 text-sand-700 font-medium rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingMaterial}
                      className="flex-1 py-3 bg-accent-600 hover:bg-accent-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                    >
                      {savingMaterial ? 'Adding...' : 'Add Material'}
                    </button>
                  </div>
                </form>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}