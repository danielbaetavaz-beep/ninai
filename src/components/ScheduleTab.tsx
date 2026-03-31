'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday, toLocalDateStr } from '@/lib/dates';

export default function ScheduleTab({ plan, onPlanGenerated }: { plan: any; onPlanGenerated: () => void }) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [dailyPlans, setDailyPlans] = useState<any[]>([]);
  const [pastSchedules, setPastSchedules] = useState<any[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const todayStr = getLocalToday();
  const dayLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // Build next 14 days
  const futureDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { date: toLocalDateStr(d), dayLabel: dayLabels[d.getDay()], dayOfWeek: d.getDay(), isToday: i === 0 };
  });

  // Build past 7 days for prefill reference
  const pastDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 7 + i);
    return { date: toLocalDateStr(d), dayOfWeek: d.getDay() };
  });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const futureDates = futureDays.map(d => d.date);
    const pastDates = pastDays.map(d => d.date);

    const [{ data: sched }, { data: plans }, { data: pastSched }] = await Promise.all([
      supabase.from('daily_schedule').select('*').eq('plan_id', plan.id).in('date', futureDates),
      supabase.from('daily_plans').select('*').eq('plan_id', plan.id).in('date', futureDates),
      supabase.from('daily_schedule').select('*').eq('plan_id', plan.id).in('date', pastDates),
    ]);
    setSchedules(sched || []);
    setDailyPlans(plans || []);
    setPastSchedules(pastSched || []);
    setLoading(false);
  }

  function getSchedule(date: string) { return schedules.find(s => s.date === date); }
  function getDailyPlan(date: string) { return dailyPlans.find(p => p.date === date); }

  // Prefill: find same day-of-week from past week
  function getPrefill(dayOfWeek: number) {
    const pastDay = pastDays.find(d => d.dayOfWeek === dayOfWeek);
    if (!pastDay) return null;
    return pastSchedules.find(s => s.date === pastDay.date);
  }

  async function saveSchedule(date: string, field: string, value: any, dayOfWeek?: number) {
    const existing = getSchedule(date);
    // If no existing schedule, try prefill
    const prefill = !existing && dayOfWeek !== undefined ? getPrefill(dayOfWeek) : null;

    const baseData = {
      morning: existing?.morning || prefill?.morning || 'casa',
      afternoon: existing?.afternoon || prefill?.afternoon || 'casa',
      evening: existing?.evening || prefill?.evening || 'casa',
      has_gym: existing?.has_gym ?? prefill?.has_gym ?? false,
    };

    const data = { plan_id: plan.id, date, ...baseData, [field]: value };

    if (existing) {
      await supabase.from('daily_schedule').update({ [field]: value }).eq('id', existing.id);
      setSchedules(prev => prev.map(s => s.id === existing.id ? { ...s, [field]: value } : s));
    } else {
      const { data: inserted } = await supabase.from('daily_schedule').insert(data).select().single();
      if (inserted) setSchedules(prev => [...prev, inserted]);
    }
  }

  // Auto-prefill a day when user first interacts
  async function ensureScheduleExists(date: string, dayOfWeek: number) {
    if (getSchedule(date)) return;
    const prefill = getPrefill(dayOfWeek);
    const data = {
      plan_id: plan.id,
      date,
      morning: prefill?.morning || 'casa',
      afternoon: prefill?.afternoon || 'casa',
      evening: prefill?.evening || 'casa',
      has_gym: prefill?.has_gym ?? false,
    };
    const { data: inserted } = await supabase.from('daily_schedule').insert(data).select().single();
    if (inserted) setSchedules(prev => [...prev, inserted]);
  }

  async function generateDayPlan(date: string) {
    const sched = getSchedule(date);
    if (!sched) return;
    setGenerating(date);

    const d = new Date(date + 'T12:00:00');
    const dayLabel = dayLabels[d.getDay()];

    const res = await fetch('/api/generate-daily-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        days: [{ date, dayLabel, morning: sched.morning, afternoon: sched.afternoon, evening: sched.evening, has_gym: sched.has_gym }],
        mealPlanBase: plan.meal_plan_base, exercisePlanBase: plan.exercise_plan_base, goals: plan.goals,
      }),
    });
    const result = await res.json();

    if (result.days?.length > 0) {
      const dayPlan = result.days[0];
      const existing = getDailyPlan(date);
      if (existing) {
        await supabase.from('daily_plans').update({ meals: dayPlan.meals, exercise: dayPlan.exercise, generated_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await supabase.from('daily_plans').insert({ plan_id: plan.id, date, meals: dayPlan.meals, exercise: dayPlan.exercise });
      }
    }
    setGenerating(null);
    await loadAll();
    onPlanGenerated();
  }

  if (loading) return <div className="p-4 text-center text-gray-400 text-sm">Carregando...</div>;

  return (
    <div className="p-4">
      <p className="text-lg font-medium mb-1">Agenda</p>
      <p className="text-xs text-gray-400 mb-4">Seus próximos 14 dias. Preencha a programação e gere o cardápio.</p>

      {futureDays.map(day => {
        const sched = getSchedule(day.date);
        const dp = getDailyPlan(day.date);
        const prefill = !sched ? getPrefill(day.dayOfWeek) : null;
        const hasPlan = !!dp;
        const hasSchedule = !!sched;
        const isGenerating = generating === day.date;
        const isExpanded = expandedDay === day.date;
        const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

        // Display values: use existing schedule, or prefill hint
        const displayMorning = sched?.morning || prefill?.morning || 'casa';
        const displayAfternoon = sched?.afternoon || prefill?.afternoon || 'casa';
        const displayEvening = sched?.evening || prefill?.evening || 'casa';
        const displayGym = sched?.has_gym ?? prefill?.has_gym ?? false;

        return (
          <div key={day.date} className={`mb-3 rounded-xl overflow-hidden border ${day.isToday ? 'border-teal-200 bg-teal-50/30' : hasPlan ? 'border-green-100 bg-green-50/20' : 'border-gray-100 bg-gray-50'}`}>
            {/* Day header */}
            <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setExpandedDay(isExpanded ? null : day.date)}>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${hasPlan ? 'bg-green-400' : hasSchedule ? 'bg-amber-400' : 'bg-gray-200'}`} />
                <span className="text-sm font-medium">{day.dayLabel}</span>
                <span className="text-xs text-gray-400">{dateLabel}</span>
                {day.isToday && <span className="text-xs text-teal-500">hoje</span>}
              </div>
              <div className="flex items-center gap-2">
                {hasPlan && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ cardápio</span>}
                {hasSchedule && !hasPlan && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">programado</span>}
                {!hasSchedule && prefill && <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">sugestão</span>}
                <svg className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-3 pb-3 border-t border-gray-100/50">
                {/* Schedule controls */}
                <div className="mt-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 font-medium">Programação</span>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                      <input type="checkbox" checked={displayGym} onChange={async e => { await ensureScheduleExists(day.date, day.dayOfWeek); saveSchedule(day.date, 'has_gym', e.target.checked, day.dayOfWeek); }} className="rounded" />
                      Academia
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['morning', 'afternoon', 'evening'] as const).map(period => {
                      const labels = { morning: 'Manhã', afternoon: 'Tarde', evening: 'Noite' };
                      const val = period === 'morning' ? displayMorning : period === 'afternoon' ? displayAfternoon : displayEvening;
                      return (
                        <button key={period} onClick={async () => { await ensureScheduleExists(day.date, day.dayOfWeek); saveSchedule(day.date, period, val === 'casa' ? 'fora' : 'casa', day.dayOfWeek); }}
                          className={`text-xs py-1.5 rounded-lg font-medium ${val === 'casa' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                          {labels[period]}: {val === 'casa' ? 'Casa' : 'Fora'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Generate / regenerate button */}
                {(hasSchedule || prefill) && !hasPlan && (
                  <button onClick={async () => { await ensureScheduleExists(day.date, day.dayOfWeek); generateDayPlan(day.date); }} disabled={isGenerating} className="w-full py-2.5 bg-teal-400 text-white rounded-lg text-xs font-medium disabled:opacity-50 mb-3">
                    {isGenerating ? 'Gerando cardápio...' : 'Gerar cardápio'}
                  </button>
                )}

                {/* Show generated plan */}
                {hasPlan && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 font-medium">Cardápio do dia</p>
                    {(dp.meals || []).map((meal: any, idx: number) => (
                      <div key={idx} className="bg-white rounded-lg p-2.5 border border-gray-50">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-teal-700">{meal.meal}</p>
                          {meal.location && <span className="text-[10px] text-gray-400">{meal.location}</span>}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{meal.description}</p>
                        {meal.macros && (
                          <div className="flex gap-3 mt-1.5 text-[10px] text-gray-400">
                            <span>P:{meal.macros.protein_g}g</span>
                            <span>C:{meal.macros.carbs_g}g</span>
                            <span>G:{meal.macros.fat_g}g</span>
                            <span>{meal.macros.calories}kcal</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {dp.exercise && (
                      <div className="bg-blue-50 rounded-lg p-2.5">
                        <p className="text-xs font-medium text-blue-700">Exercício: {dp.exercise.type}</p>
                        <p className="text-xs text-blue-600">{dp.exercise.description}</p>
                      </div>
                    )}

                    <button onClick={() => generateDayPlan(day.date)} disabled={isGenerating} className="w-full py-2 border border-gray-200 text-gray-500 rounded-lg text-xs disabled:opacity-50">
                      {isGenerating ? 'Regenerando...' : 'Regenerar cardápio'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
