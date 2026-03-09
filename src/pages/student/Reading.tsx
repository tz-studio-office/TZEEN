import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { ReadingMaterial, ReadingSession, Student } from '../../types';
import { BookOpen, Play, Square, Clock, BarChart3, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export default function StudentReading() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [materials, setMaterials] = useState<ReadingMaterial[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [activeMaterial, setActiveMaterial] = useState<ReadingMaterial | null>(null);
  const [reading, setReading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  useEffect(() => {
    if (reading) {
      intervalRef.current = window.setInterval(() => setTimer((t) => t + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [reading]);

  async function loadData() {
    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('profile_id', user!.id)
      .maybeSingle();

    if (!studentData) { setLoading(false); return; }
    setStudent(studentData);

    const [matsRes, sessRes] = await Promise.all([
      supabase
        .from('reading_materials')
        .select('*')
        .or(`student_id.eq.${studentData.id},student_id.is.null`)
        .order('created_at', { ascending: false }),
      supabase
        .from('reading_sessions')
        .select('*, reading_materials(title)')
        .eq('student_id', studentData.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    setMaterials(matsRes.data || []);
    setSessions(sessRes.data || []);
    setLoading(false);
  }

  function startReading(material: ReadingMaterial) {
    setActiveMaterial(material);
    setReading(true);
    setTimer(0);
  }

  async function stopReading() {
    if (!student || !activeMaterial) return;
    setReading(false);

    await supabase.from('reading_sessions').insert({
      student_id: student.id,
      material_id: activeMaterial.id,
      duration_seconds: timer,
    });

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const { data: mission } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('student_id', student.id)
      .eq('date', todayStr)
      .eq('mission_type', 'reading')
      .maybeSingle();

    if (mission) {
      await supabase
        .from('daily_missions')
        .update({
          current_value: mission.current_value + 1,
          completed: mission.current_value + 1 >= mission.target_value,
        })
        .eq('id', mission.id);
    }

    setActiveMaterial(null);
    setTimer(0);
    loadData();
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  const totalSessions = sessions.length;
  const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 60);

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
        <BookOpen className="w-12 h-12 text-sand-400 mx-auto mb-4" />
        <p className="text-sand-500">You haven't been registered as a student yet.</p>
      </div>
    );
  }

  if (activeMaterial) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-sand-900">{activeMaterial.title}</h1>
          <span className={`text-xs font-medium px-3 py-1 rounded-lg ${
            reading ? 'bg-accent-50 text-accent-600 animate-pulse' : 'bg-sand-100 text-sand-500'
          }`}>
            {formatTime(timer)}
          </span>
        </div>

        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-8">
          <div className="prose prose-invert max-w-none">
            <p className="text-sand-800 text-lg leading-relaxed whitespace-pre-wrap font-serif">
              {activeMaterial.content}
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          {reading ? (
            <button
              onClick={stopReading}
              className="inline-flex items-center gap-3 px-8 py-4 bg-red-50 text-red-600 hover:bg-red-500/20 rounded-2xl font-semibold text-lg transition-all"
            >
              <Square className="w-6 h-6" />
              Finish Reading
            </button>
          ) : (
            <button
              onClick={() => setReading(true)}
              className="inline-flex items-center gap-3 px-8 py-4 bg-accent-600 text-white hover:bg-accent-500 rounded-2xl font-semibold text-lg transition-all"
            >
              <Play className="w-6 h-6" />
              Start Reading
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-sand-900">Reading Training</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-accent-600" />
            <span className="text-xs font-medium text-sand-500 uppercase tracking-wider">Sessions</span>
          </div>
          <p className="text-3xl font-bold text-sand-900">{totalSessions}</p>
        </div>
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-medium text-sand-500 uppercase tracking-wider">Total Time</span>
          </div>
          <p className="text-3xl font-bold text-sand-900">{totalMinutes}m</p>
        </div>
      </div>

      <div className="bg-white border border-sand-200 rounded-2xl shadow-sm">
        <div className="px-6 py-4 border-b border-sand-200">
          <h2 className="text-lg font-semibold text-sand-900">Reading Materials</h2>
        </div>
        {materials.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen className="w-10 h-10 text-sand-400 mx-auto mb-3" />
            <p className="text-sand-500">No reading materials available yet.</p>
            <p className="text-sand-400 text-sm mt-1">Ask your coach to add reading materials.</p>
          </div>
        ) : (
          <div className="divide-y divide-sand-200">
            {materials.map((m) => (
              <button
                key={m.id}
                onClick={() => startReading(m)}
                className="flex items-center gap-4 px-6 py-4 w-full text-left hover:bg-sand-50/50 transition-all group"
              >
                <div className="w-10 h-10 bg-accent-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-accent-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sand-900 truncate">{m.title}</p>
                  <p className="text-xs text-sand-500 capitalize">{m.difficulty}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-sand-400 group-hover:text-sand-500 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {sessions.length > 0 && (
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm">
          <div className="px-6 py-4 border-b border-sand-200">
            <h2 className="text-lg font-semibold text-sand-900">Recent Sessions</h2>
          </div>
          <div className="divide-y divide-sand-200">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-6 py-3">
                <BarChart3 className="w-4 h-4 text-sand-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-sand-900 truncate">
                    {s.reading_materials?.title || 'Reading session'}
                  </p>
                  <p className="text-xs text-sand-500">{format(new Date(s.created_at), 'MMM d, HH:mm')}</p>
                </div>
                <span className="text-sm font-medium text-sand-900">{Math.round(s.duration_seconds / 60)}m</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
