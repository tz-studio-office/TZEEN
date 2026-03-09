import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Assignment } from '../../types';
import { CheckCircle2, Circle, ClipboardList, Filter } from 'lucide-react';
import { format } from 'date-fns';

export default function StudentAssignments() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    const { data: studentData } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', user!.id)
      .maybeSingle();

    if (!studentData) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('assignments')
      .select('*')
      .eq('student_id', studentData.id)
      .order('due_date', { ascending: true, nullsFirst: false });

    setAssignments(data || []);
    setLoading(false);
  }

  async function toggleComplete(assignment: Assignment) {
    const newStatus = assignment.status === 'completed' ? 'pending' : 'completed';
    await supabase
      .from('assignments')
      .update({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', assignment.id);
    loadData();
  }

  const filtered = assignments.filter((a) => {
    if (filter === 'pending') return a.status === 'pending';
    if (filter === 'completed') return a.status === 'completed';
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
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-sand-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-sand-200 rounded-xl text-sand-900 text-sm focus:outline-none focus:ring-2 focus:ring-accent-200"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-12 text-center">
          <ClipboardList className="w-12 h-12 text-sand-400 mx-auto mb-4" />
          <p className="text-sand-500">No assignments.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <div
              key={a.id}
              className="bg-white border border-sand-200 rounded-2xl shadow-sm p-5 flex items-start gap-4"
            >
              <button onClick={() => toggleComplete(a)} className="mt-0.5 flex-shrink-0">
                {a.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-accent-600" />
                ) : (
                  <Circle className="w-5 h-5 text-sand-400 hover:text-sand-500 transition-colors" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium ${
                    a.status === 'completed' ? 'text-sand-500 line-through' : 'text-sand-900'
                  }`}
                >
                  {a.title}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                  {a.textbook && (
                    <span className="text-xs text-sand-500">
                      {a.textbook} {a.pages && `p.${a.pages}`}
                    </span>
                  )}
                  {a.due_date && (
                    <span className="text-xs text-sand-500">
                      Due: {format(new Date(a.due_date), 'MMM d, yyyy')}
                    </span>
                  )}
                  {a.submission_method && (
                    <span className="text-xs text-sand-500">Submit: {a.submission_method}</span>
                  )}
                </div>
              </div>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-lg flex-shrink-0 ${
                  a.status === 'completed'
                    ? 'bg-accent-50 text-accent-600'
                    : 'bg-amber-50 text-amber-600'
                }`}
              >
                {a.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
