import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { WeeklyReport, Student } from '../../types';
import { BarChart3, Clock, BookOpen, PenLine, Flame, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

export default function StudentReports() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('profile_id', user!.id)
      .maybeSingle();

    if (!studentData) { setLoading(false); return; }
    setStudent(studentData);

    const { data: reportsData } = await supabase
      .from('weekly_reports')
      .select('*')
      .eq('student_id', studentData.id)
      .order('week_start', { ascending: false })
      .limit(12);

    setReports(reportsData || []);
    setLoading(false);
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
        <BarChart3 className="w-12 h-12 text-sand-400 mx-auto mb-4" />
        <p className="text-sand-500">You haven't been registered as a student yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-sand-900">Weekly Reports</h1>

      {reports.length === 0 ? (
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-12 text-center">
          <BarChart3 className="w-12 h-12 text-sand-400 mx-auto mb-4" />
          <p className="text-sand-500">No reports available yet.</p>
          <p className="text-sand-500 text-sm mt-1">Your coach will generate weekly reports as you study.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="bg-white border border-sand-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-sand-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-sand-900">
                    Week of {format(new Date(report.week_start), 'MMM d, yyyy')}
                  </h3>
                </div>
                <TrendingUp className="w-5 h-5 text-accent-600" />
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-sand-50/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span className="text-xs text-sand-500">Study Time</span>
                    </div>
                    <p className="text-2xl font-bold text-sand-900">{report.study_hours}h</p>
                  </div>
                  {report.vocab_accuracy !== null && (
                    <div className="bg-sand-50/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="w-4 h-4 text-accent-600" />
                        <span className="text-xs text-sand-500">Vocabulary</span>
                      </div>
                      <p className="text-2xl font-bold text-sand-900">{report.vocab_accuracy}%</p>
                    </div>
                  )}
                  {report.grammar_accuracy !== null && (
                    <div className="bg-sand-50/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <PenLine className="w-4 h-4 text-amber-600" />
                        <span className="text-xs text-sand-500">Grammar</span>
                      </div>
                      <p className="text-2xl font-bold text-sand-900">{report.grammar_accuracy}%</p>
                    </div>
                  )}
                  <div className="bg-sand-50/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="w-4 h-4 text-amber-600" />
                      <span className="text-xs text-sand-500">Streak</span>
                    </div>
                    <p className="text-2xl font-bold text-sand-900">{report.streak_days}d</p>
                  </div>
                </div>
                {report.summary && (
                  <div className="bg-sand-50/30 rounded-xl p-4 border border-sand-200/40">
                    <p className="text-sm text-sand-600 leading-relaxed whitespace-pre-wrap">{report.summary}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
