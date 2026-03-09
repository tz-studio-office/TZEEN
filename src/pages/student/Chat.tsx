import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Student } from '../../types';
import ChatComponent from '../../components/Chat';
import { MessageCircle } from 'lucide-react';

export default function StudentChat() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    const { data } = await supabase
      .from('students')
      .select('*, profiles!students_coach_id_fkey(full_name)')
      .eq('profile_id', user!.id)
      .maybeSingle();
    setStudent(data);
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
        <MessageCircle className="w-12 h-12 text-sand-400 mx-auto mb-4" />
        <p className="text-sand-500">You haven't been registered as a student yet.</p>
      </div>
    );
  }

  const coachName = (student.profiles as unknown as { full_name: string })?.full_name || 'Coach';

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-sand-900">Chat</h1>
        <span className="text-sm text-sand-500">with {coachName}</span>
      </div>
      <div className="flex-1 bg-white border border-sand-200 rounded-2xl shadow-sm overflow-hidden min-h-0">
        <ChatComponent studentId={student.id} />
      </div>
    </div>
  );
}
