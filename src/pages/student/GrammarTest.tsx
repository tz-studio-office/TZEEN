import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { GrammarTest as GrammarTestType, Student } from '../../types';
import { PenLine, CheckCircle2, XCircle, RotateCcw, Trophy } from 'lucide-react';
import { format } from 'date-fns';

const GRAMMAR_SETS: Record<string, { question: string; options: string[]; answer: string }[]> = {
  'Tenses': [
    { question: 'She ___ to school every day.', options: ['go', 'goes', 'going', 'gone'], answer: 'goes' },
    { question: 'They ___ playing soccer when it started raining.', options: ['are', 'was', 'were', 'is'], answer: 'were' },
    { question: 'I ___ already finished my homework.', options: ['has', 'have', 'had', 'having'], answer: 'have' },
    { question: 'By next year, she ___ graduated.', options: ['will have', 'has', 'had', 'is'], answer: 'will have' },
    { question: 'He ___ for two hours before the bus arrived.', options: ['waits', 'waited', 'had been waiting', 'was wait'], answer: 'had been waiting' },
    { question: 'We ___ dinner when you called.', options: ['eat', 'were eating', 'ate', 'eaten'], answer: 'were eating' },
    { question: 'She ___ English since 2020.', options: ['studies', 'studied', 'has been studying', 'study'], answer: 'has been studying' },
    { question: 'The train ___ at 9 AM tomorrow.', options: ['leaves', 'leave', 'leaving', 'left'], answer: 'leaves' },
  ],
  'Articles & Prepositions': [
    { question: 'She is ___ honest person.', options: ['a', 'an', 'the', 'no article'], answer: 'an' },
    { question: 'I am interested ___ learning English.', options: ['at', 'in', 'on', 'for'], answer: 'in' },
    { question: '___ sun rises in the east.', options: ['A', 'An', 'The', 'No article'], answer: 'The' },
    { question: 'He arrived ___ Monday morning.', options: ['in', 'at', 'on', 'by'], answer: 'on' },
    { question: 'She is good ___ mathematics.', options: ['in', 'at', 'on', 'with'], answer: 'at' },
    { question: 'I have been waiting ___ 3 o\'clock.', options: ['for', 'since', 'from', 'at'], answer: 'since' },
    { question: 'The book is ___ the table.', options: ['in', 'at', 'on', 'by'], answer: 'on' },
    { question: 'He depends ___ his parents.', options: ['in', 'on', 'at', 'for'], answer: 'on' },
  ],
  'Conditionals': [
    { question: 'If it rains, I ___ stay home.', options: ['will', 'would', 'can', 'should'], answer: 'will' },
    { question: 'If I ___ rich, I would travel the world.', options: ['am', 'was', 'were', 'be'], answer: 'were' },
    { question: 'If she had studied, she ___ passed.', options: ['will have', 'would have', 'has', 'had'], answer: 'would have' },
    { question: 'I ___ help you if I have time.', options: ['will', 'would', 'could have', 'might have'], answer: 'will' },
    { question: 'If I ___ known, I would have called.', options: ['have', 'has', 'had', 'would'], answer: 'had' },
    { question: 'Unless you hurry, you ___ miss the bus.', options: ['will', 'would', 'can', 'shall'], answer: 'will' },
    { question: 'If he ___ harder, he would succeed.', options: ['works', 'worked', 'working', 'work'], answer: 'worked' },
    { question: 'Had I known, I ___ told you.', options: ['will have', 'would have', 'had', 'have'], answer: 'would have' },
  ],
};

export default function GrammarTestPage() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [history, setHistory] = useState<GrammarTestType[]>([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [questions, setQuestions] = useState<typeof GRAMMAR_SETS['Tenses']>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
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

    const { data: historyData } = await supabase
      .from('grammar_tests')
      .select('*')
      .eq('student_id', studentData.id)
      .order('created_at', { ascending: false })
      .limit(10);

    setHistory(historyData || []);
    setLoading(false);
  }

  function startTest(topic: string) {
    const shuffled = [...GRAMMAR_SETS[topic]].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setSelectedTopic(topic);
    setCurrentQ(0);
    setScore(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setTestComplete(false);
  }

  function selectAnswer(answer: string) {
    if (selectedAnswer) return;
    setSelectedAnswer(answer);
    setShowResult(true);
    if (answer === questions[currentQ].answer) setScore((s) => s + 1);
  }

  async function nextQuestion() {
    if (currentQ + 1 >= questions.length) {
      setTestComplete(true);
      if (student) {
        await supabase.from('grammar_tests').insert({
          student_id: student.id,
          total_questions: questions.length,
          correct_answers: score,
          topic: selectedTopic,
        });

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const { data: mission } = await supabase
          .from('daily_missions')
          .select('*')
          .eq('student_id', student.id)
          .eq('date', todayStr)
          .eq('mission_type', 'grammar')
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

        loadData();
      }
      return;
    }
    setCurrentQ((q) => q + 1);
    setSelectedAnswer(null);
    setShowResult(false);
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
        <PenLine className="w-12 h-12 text-sand-400 mx-auto mb-4" />
        <p className="text-sand-500">You haven't been registered as a student yet.</p>
      </div>
    );
  }

  if (testComplete) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-12">
        <div className="w-20 h-20 bg-accent-50 rounded-full flex items-center justify-center mx-auto">
          <Trophy className="w-10 h-10 text-accent-600" />
        </div>
        <h1 className="text-3xl font-bold text-sand-900">Test Complete!</h1>
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-8">
          <p className="text-5xl font-bold text-sand-900">{score}/{questions.length}</p>
          <p className="text-sand-500 mt-2">Accuracy: {pct}%</p>
          <div className="w-full h-3 bg-sand-100 rounded-full overflow-hidden mt-4">
            <div
              className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-accent-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => { setSelectedTopic(''); setTestComplete(false); }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent-600 hover:bg-accent-500 text-white font-semibold rounded-xl transition-all"
        >
          <RotateCcw className="w-5 h-5" />
          Back to Tests
        </button>
      </div>
    );
  }

  if (selectedTopic && questions.length > 0) {
    const q = questions[currentQ];
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-sand-900">{selectedTopic}</h1>
          <span className="text-sm text-sand-500">{currentQ + 1} / {questions.length}</span>
        </div>
        <div className="w-full h-2 bg-sand-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full transition-all"
            style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
          />
        </div>
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm p-8">
          <p className="text-sm text-sand-500 mb-3">Fill in the blank:</p>
          <p className="text-xl font-medium text-sand-900">{q.question}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {q.options.map((opt) => {
            let cls = 'bg-white border border-sand-200 text-sand-900 hover:bg-sand-100 hover:border-sand-200';
            if (showResult) {
              if (opt === q.answer) cls = 'bg-accent-50 border border-accent-300 text-accent-600';
              else if (opt === selectedAnswer) cls = 'bg-red-50 border border-red-300 text-red-600';
              else cls = 'bg-sand-50/50 border border-sand-200 text-sand-400';
            }
            return (
              <button
                key={opt}
                onClick={() => selectAnswer(opt)}
                disabled={!!selectedAnswer}
                className={`p-4 rounded-xl text-sm font-medium transition-all ${cls}`}
              >
                <div className="flex items-center gap-2 justify-center">
                  {showResult && opt === q.answer && <CheckCircle2 className="w-4 h-4" />}
                  {showResult && opt === selectedAnswer && opt !== q.answer && <XCircle className="w-4 h-4" />}
                  {opt}
                </div>
              </button>
            );
          })}
        </div>
        {showResult && (
          <button
            onClick={nextQuestion}
            className="w-full py-3 bg-accent-600 hover:bg-accent-500 text-white font-semibold rounded-xl transition-all"
          >
            {currentQ + 1 >= questions.length ? 'See Results' : 'Next Question'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-sand-900">Grammar Test</h1>

      <div className="grid sm:grid-cols-3 gap-4">
        {Object.keys(GRAMMAR_SETS).map((topic) => (
          <button
            key={topic}
            onClick={() => startTest(topic)}
            className="bg-white border border-sand-200 rounded-2xl shadow-sm p-6 text-left hover:bg-sand-100 hover:border-sand-200 transition-all"
          >
            <PenLine className="w-8 h-8 text-blue-600 mb-3" />
            <p className="text-sm font-semibold text-sand-900">{topic}</p>
            <p className="text-xs text-sand-500 mt-1">{GRAMMAR_SETS[topic].length} questions</p>
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <div className="bg-white border border-sand-200 rounded-2xl shadow-sm">
          <div className="px-6 py-4 border-b border-sand-200">
            <h2 className="text-lg font-semibold text-sand-900">Test History</h2>
          </div>
          <div className="divide-y divide-sand-200">
            {history.map((t) => {
              const pct = t.total_questions > 0 ? Math.round((t.correct_answers / t.total_questions) * 100) : 0;
              return (
                <div key={t.id} className="flex items-center gap-4 px-6 py-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    pct >= 80 ? 'bg-accent-50' : pct >= 50 ? 'bg-amber-50' : 'bg-red-50'
                  }`}>
                    <span className={`text-sm font-bold ${
                      pct >= 80 ? 'text-accent-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'
                    }`}>{pct}%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-sand-900">{t.topic}</p>
                    <p className="text-xs text-sand-500">{format(new Date(t.created_at), 'MMM d, HH:mm')}</p>
                  </div>
                  <span className="text-sm font-medium text-sand-900">{t.correct_answers}/{t.total_questions}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
