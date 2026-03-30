'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday, toLocalDateStr } from '@/lib/dates';

export default function ScheduleTab({ plan, onPlanGenerated }: { plan: any; onPlanGenerated: () => void }) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [dailyPlans, setDailyPlans] = useState<any[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const todayStr = getLocalToday();
  const dayLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // Build next 14 days
  const futureDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      date: toLocalDateStr(d),
      dayLabel: dayLabels[d.getDay()],
      isToday: i === 0,
    };
  });

  useEffect(() => { loadSchedules(); }, []);

  async function loadSchedules() {
    const dates = futureDays.map(d => d.date);
    const { data: sched } = await supabase.from('daily_schedule').select('*').eq('plan_id', plan.id).in('date', dates);
    const { data: plans } = await supabase.from('daily_plans').select('*').eq('plan_id', plan.id).in('date', dates);
    setSchedules(sched || []);
    setDailyPlans(plans || []);
    setLoading(false);
  }

  function getSchedule(date: string) {
    return schedules.find(s => s.date === date);
  }

  function getDailyPlan(date: string) {
    return dailyPlans.find(p => p.date === date);
  }

  async function saveSchedule(date: string, field: string, value: any) {
    const existing = getSchedule(date);
    const data = {
      plan_id: plan.id,
      date,
      morning: existing?.morning || 'casa',
      afternoon: existing?.afternoon || 'casa',
      evening: existing?.evening || 'casa',
      has_gym: existing?.has_gym || false,
      [field]: value,
    };

    if (existing) {
      await supabase.from('daily_schedule').update({ [field]: value }).eq('id', existing.id);
      setSchedules(prev => prev.map(s => s.id === existing.id ? { ...s, [field]: value } : s));
    } else {
      const { data: inserted } = await supabase.from('daily_schedule').insert(data).select().single();
      if (inserted) setSchedules(prev => [...prev, inserted]);
    }
  }

  async function generateDayPlan(date: string) {
    const sched = getSchedule(date);
    if (!sched) return;

    setGenerating(date);

    const d = new Date(date + 'T12:00:00');
    const dayLabel = dayLabels[d.getDay()];

    const res = await fetch('/api/generate-daily-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        days: [{ date, dayLabel, morning: sched.morning, afternoon: sched.afternoon, evening: sched.evening, has_gym: sched.has_gym }],
        mealPlanBase: plan.meal_plan_base,
        exercisePlanBase: plan.exercise_plan_base,
        goals: plan.goals,
      }),
    });
    const result = await res.json();

    if (result.days && result.days.length > 0) {
      const dayPlan = result.days[0];
      // Upsert daily plan
      const existing = getDailyPlan(date);
      if (existing) {
        await supabase.from('daily_plans').update({ meals: dayPlan.meals, exercise: dayPlan.exercise, generated_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await supabase.from('daily_plans').insert({ plan_id: plan.id, date, meals: dayPlan.meals, exercise: dayPlan.exercise });
      }
    }

    setGenerating(null);
    await loadSchedules();
    onPlanGenerated();
  }

  if (loading) return <div className="p-4 text-center text-gray-400 text-sm">Carregando...</div>;

  return (
    <div className="p-4">
      <p className="text-lg font-medium mb-1">Programação</p>
      <p className="text-xs text-gray-400 mb-4">Preencha os dias e gere o cardápio. Dias sem programação não terão cardápio.</p>

      {futureDays.map(day => {
        const sched = getSchedule(day.date);
        const dp = getDailyPlan(day.date);
        const hasPlan = !!dp;
        const hasSchedule = !!sched;
        const isGenerating = generating === day.date;
        const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

        return (
          <div key={day.date} className={`mb-3 rounded-xl p-3 ${day.isToday ? 'bg-teal-50 border border-teal-200' : hasPlan ? 'bg-green-50/50 border border-green-100' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{day.dayLabel}</span>
                <span className="text-xs text-gray-400">{dateLabel}</span>
                {day.isToday && <span className="text-xs text-teal-500">hoje</span>}
              </div>
              <div className="flex items-center gap-2">
                {hasPlan && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ cardápio</span>}
                <label className="flex items-center gap-1 text-xs text-gray-500">
                  <input type="checkbox" checked={sched?.has_gym || false} onChange={e => saveSchedule(day.date, 'has_gym', e.target.checked)} className="rounded" />
                  Acad.
                </label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-2">
              {(['morning', 'afternoon', 'evening'] as const).map(period => {
                const labels = { morning: 'Manhã', afternoon: 'Tarde', evening: 'Noite' };
                const val = sched?.[period] || 'casa';
                return (
                  <button key={period} onClick={() => saveSchedule(day.date, period, val === 'casa' ? 'fora' : 'casa')}
                    className={`text-xs py-1.5 rounded-lg font-medium ${val === 'casa' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                    {labels[period]}: {val === 'casa' ? 'Casa' : 'Fora'}
                  </button>
                );
              })}
            </div>

            {hasSchedule && !hasPlan && (
              <button onClick={() => generateDayPlan(day.date)} disabled={isGenerating} className="w-full py-2 bg-teal-400 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                {isGenerating ? 'Gerando cardápio...' : 'Gerar cardápio'}
              </button>
            )}
            {hasSchedule && hasPlan && (
              <button onClick={() => generateDayPlan(day.date)} disabled={isGenerating} className="w-full py-2 border border-gray-200 text-gray-500 rounded-lg text-xs disabled:opacity-50">
                {isGenerating ? 'Regenerando...' : 'Regenerar cardápio'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
