import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { StudyPlan as StudyPlanType, StudyPlanItem } from '../../types';
import { CalendarDays, Clock, ExternalLink, Calendar } from 'lucide-react';
import { format, addDays, startOfWeek, nextMonday } from 'date-fns';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function buildGoogleCalendarUrl(
  title: string,
  startTime: string,
  endTime: string,
  date: Date,
  recur?: string
) {
  const dateStr = format(date, 'yyyyMMdd');
  const start = `${dateStr}T${startTime.replace(/:/g, '').slice(0, 4)}00`;
  const end = `${dateStr}T${endTime.replace(/:/g, '').slice(0, 4)}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  if (recur) params.set('recur', recur);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getNextDateForDay(dayIndex: number): Date {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const target = addDays(monday, dayIndex);
  if (target <= now) {
    return addDays(nextMonday(now), dayIndex);
  }
  return target;
}

const RRULE_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export default function StudentStudyPlan() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<StudyPlanType[]>([]);
  const [items, setItems] = useState<Record<string, StudyPlanItem[]>>({});
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

    const { data: plansData } = await supabase
      .from('study_plans')
      .select('*')
      .eq('student_id', studentData.id)
      .order('created_at', { ascending: false });

    if (plansData && plansData.length > 0) {
      setPlans(plansData);
      const planIds = plansData.map((p) => p.id);
      const { data: itemsData } = await supabase
        .from('study_plan_items')
        .select('*')
        .in('plan_id', planIds)
        .order('sort_order');

      const grouped: Record<string, StudyPlanItem[]> = {};
      (itemsData || []).forEach((item) => {
        if (!grouped[item.plan_id]) grouped[item.plan_id] = [];
        grouped[item.plan_id].push(item);
      });
      setItems(grouped);
    }
    setLoading(false);
  }

  function addItemToCalendar(item: StudyPlanItem, plan: StudyPlanType) {
    const dayIndex = item.day_of_week ?? 0;
    const date = plan.schedule_type === 'weekly' ? getNextDateForDay(dayIndex) : new Date();
    const recur = plan.schedule_type === 'weekly'
      ? `RRULE:FREQ=WEEKLY;BYDAY=${RRULE_DAYS[dayIndex]}`
      : 'RRULE:FREQ=DAILY';
    const url = buildGoogleCalendarUrl(
      item.activity,
      item.start_time || '19:00',
      item.end_time || '19:30',
      date,
      recur
    );
    window.open(url, '_blank');
  }

  function addAllToCalendar(plan: StudyPlanType) {
    const planItems = items[plan.id] || [];
    planItems.forEach((item, i) => {
      setTimeout(() => addItemToCalendar(item, plan), i * 300);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-20">
        <CalendarDays className="w-12 h-12 text-sand-400 mx-auto mb-4" />
        <p className="text-sand-500">No study plan assigned yet.</p>
        <p className="text-sand-500 text-sm mt-1">Your coach will create one for you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-sand-900">My Study Plan</h1>

      {plans.map((plan) => {
        const planItems = items[plan.id] || [];
        return (
          <div key={plan.id} className="bg-white border border-sand-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-sand-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-sand-900">{plan.title || 'Study Plan'}</h2>
                <span className="text-xs text-accent-600 capitalize bg-accent-50 px-2 py-0.5 rounded-lg mt-1 inline-block">
                  {plan.schedule_type}
                </span>
              </div>
              {planItems.length > 0 && (
                <button
                  onClick={() => addAllToCalendar(plan)}
                  className="flex items-center gap-2 px-3 py-2 bg-sand-100 hover:bg-sand-200 text-sand-700 hover:text-sand-900 text-xs font-medium rounded-xl transition-all"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Add All to Google Calendar
                </button>
              )}
            </div>

            <div className="p-6">
              {planItems.length === 0 ? (
                <p className="text-sm text-sand-500 text-center">No schedule items yet.</p>
              ) : plan.schedule_type === 'weekly' ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-sand-200">
                        <th className="text-left text-xs font-medium text-sand-500 uppercase tracking-wider pb-3 w-28">Day</th>
                        <th className="text-left text-xs font-medium text-sand-500 uppercase tracking-wider pb-3 w-32">Time</th>
                        <th className="text-left text-xs font-medium text-sand-500 uppercase tracking-wider pb-3">Activity</th>
                        <th className="w-10 pb-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map((day, idx) => {
                        const dayItems = planItems.filter((i) => i.day_of_week === idx);
                        if (dayItems.length === 0) return null;
                        return dayItems.map((item, itemIdx) => (
                          <tr key={item.id} className="border-b border-sand-200/60 hover:bg-sand-50/30 transition-colors">
                            <td className="py-3 pr-4">
                              {itemIdx === 0 && (
                                <span className="text-sm font-medium text-sand-600">{day}</span>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-sand-500" />
                                <span className="text-xs text-sand-500 font-mono">
                                  {item.start_time?.slice(0, 5)} - {item.end_time?.slice(0, 5)}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="text-sm text-sand-900">{item.activity}</span>
                            </td>
                            <td className="py-3">
                              <button
                                onClick={() => addItemToCalendar(item, plan)}
                                className="p-1.5 text-sand-400 hover:text-accent-600 transition-colors"
                                title="Add to Google Calendar"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-sand-200">
                        <th className="text-left text-xs font-medium text-sand-500 uppercase tracking-wider pb-3 w-32">Time</th>
                        <th className="text-left text-xs font-medium text-sand-500 uppercase tracking-wider pb-3">Activity</th>
                        <th className="w-10 pb-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {planItems.map((item) => (
                        <tr key={item.id} className="border-b border-sand-200/60 hover:bg-sand-50/30 transition-colors">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-sand-500" />
                              <span className="text-xs text-sand-500 font-mono">
                                {item.start_time?.slice(0, 5)} - {item.end_time?.slice(0, 5)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-sm text-sand-900">{item.activity}</span>
                          </td>
                          <td className="py-3">
                            <button
                              onClick={() => addItemToCalendar(item, plan)}
                              className="p-1.5 text-sand-400 hover:text-accent-600 transition-colors"
                              title="Add to Google Calendar"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
