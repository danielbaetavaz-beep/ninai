'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function WeekTab({ plan, weeklyPlan }: { plan: any; weeklyPlan: any }) {
  const [meals, setMeals] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);

  const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  const dayLabels: Record<string, string> = { segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sabado: 'Sáb', domingo: 'Dom' };
  const todayIdx = (new Date().getDay() + 6) % 7;

  useEffect(() => {
    if (!weeklyPlan) return;
    loadWeekData();
  }, [weeklyPlan]);

  async function loadWeekData() {
    const ws = weeklyPlan.week_start;
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    const { data: m } = await supabase.from('meals').select('*').eq('plan_id', plan.id).gte('date', ws).lte('date', we.toISOString().split('T')[0]);
    const { data: e } = await supabase.from('exercises').select('*').eq('plan_id', plan.id).gte('date', ws).lte('date', we.toISOString().split('T')[0]);
    setMeals(m || []);
    setExercises(e || []);
  }

  const dayFlags = days.map((d, i) => {
    const date = new Date(weeklyPlan?.week_start);
    date.setDate(date.getDate() + i);
    const ds = date.toISOString().split('T')[0];
    const dayMeals = meals.filter(m => m.date === ds);
    return {
      day: d,
      green: dayMeals.filter(m => m.flag === 'green').length,
      yellow: dayMeals.filter(m => m.flag === 'yellow').length,
      red: dayMeals.filter(m => m.flag === 'red').length,
      total: dayMeals.length,
    };
  });

  const exPlan = weeklyPlan?.exercise_plan_detailed || {};
  const exDone = exercises.filter(e => e.done).length;
  const exTotal = days.filter(d => exPlan[d] && exPlan[d].type !== 'descanso').length;
  const totalGreen = dayFlags.reduce((s, d) => s + d.green, 0);
  const totalMeals = dayFlags.reduce((s, d) => s + d.total, 0);
  const greenPct = totalMeals > 0 ? Math.round((totalGreen / totalMeals) * 100) : 0;
  const maxBar = Math.max(...dayFlags.map(d => d.green + d.yellow + d.red), 1);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-lg font-medium">Semana {weeklyPlan?.week_number || 1}</p>
        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{weeklyPlan?.week_start}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-xl font-medium">{greenPct}%</p>
          <p className="text-[10px] text-gray-400">Refeições verdes</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-xl font-medium">{exDone}/{exTotal}</p>
          <p className="text-[10px] text-gray-400">Exercícios feitos</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-xl font-medium">{totalMeals}</p>
          <p className="text-[10px] text-gray-400">Refeições registradas</p>
        </div>
      </div>

      <p className="text-sm font-medium mb-2">Bandeiras da semana</p>
      <div className="flex gap-1 items-end h-20 mb-1">
        {dayFlags.map((d, i) => {
          const total = d.green + d.yellow + d.red;
          if (total === 0) return <div key={i} className="flex-1 h-full flex items-end"><div className="w-full h-2 bg-gray-100 rounded" /></div>;
          const h = 64;
          return (
            <div key={i} className="flex-1 flex flex-col-reverse">
              <div style={{ height: (d.green / maxBar) * h }} className="bg-green-400 rounded-b" />
              {d.yellow > 0 && <div style={{ height: (d.yellow / maxBar) * h }} className="bg-amber-400" />}
              {d.red > 0 && <div style={{ height: (d.red / maxBar) * h }} className="bg-red-400 rounded-t" />}
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mb-4">
        {days.map((d, i) => <span key={d} className={`flex-1 text-center text-[10px] ${i === todayIdx ? 'text-teal-400 font-medium' : 'text-gray-300'}`}>{dayLabels[d]}</span>)}
      </div>

      <p className="text-sm font-medium mb-2">Exercícios da semana</p>
      {days.map((d, i) => {
        const ex = exPlan[d];
        if (!ex) return null;
        const date = new Date(weeklyPlan.week_start);
        date.setDate(date.getDate() + i);
        const ds = date.toISOString().split('T')[0];
        const done = exercises.find(e => e.date === ds);
        const isRest = ex.type === 'descanso';
        return (
          <div key={d} className="flex items-center gap-2 py-2 border-b border-gray-50">
            <div className={`w-2 h-2 rounded-full ${done?.done ? 'bg-green-400' : i === todayIdx ? 'bg-blue-400' : isRest ? 'bg-gray-200' : 'bg-gray-300'}`} />
            <span className="flex-1 text-sm">{dayLabels[d]} — {ex.type}</span>
            {done?.done && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-800">Feito</span>}
            {!done?.done && i === todayIdx && !isRest && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-800">Hoje</span>}
            {!done?.done && i > todayIdx && !isRest && <span className="text-[10px] text-gray-300">Previsto</span>}
          </div>
        );
      })}

      <p className="text-sm font-medium mt-4 mb-2">Agenda da semana</p>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr>
              <td className="py-1 text-gray-300"></td>
              {days.map((d, i) => <td key={d} className={`py-1 text-center ${i === todayIdx ? 'text-teal-400 font-medium' : 'text-gray-400'}`}>{dayLabels[d]}</td>)}
            </tr>
          </thead>
          <tbody>
            {['Café da manhã', 'Almoço', 'Jantar'].map(meal => (
              <tr key={meal}>
                <td className="py-1 text-gray-400 pr-1">{meal.split(' ')[0]}</td>
                {days.map(d => {
                  const r = weeklyPlan?.routine?.[d]?.meals?.[meal];
                  return (
                    <td key={d} className="py-1 text-center">
                      <span className={`px-1.5 py-0.5 rounded ${r === 'casa' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                        {r === 'casa' ? 'Casa' : 'Fora'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
