'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function WeekTab({ plan, weeklyPlan }: { plan: any; weeklyPlan: any }) {
  const [meals, setMeals] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  const dayLabels: Record<string, string> = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo' };

  useEffect(() => { if (weeklyPlan) loadWeekData(); }, [weeklyPlan]);

  async function loadWeekData() {
    const ws = weeklyPlan.week_start;
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    const { data: m } = await supabase.from('meals').select('*').eq('plan_id', plan.id).gte('date', ws).lte('date', we.toISOString().split('T')[0]);
    const { data: e } = await supabase.from('exercises').select('*').eq('plan_id', plan.id).gte('date', ws).lte('date', we.toISOString().split('T')[0]);
    setMeals(m || []);
    setExercises(e || []);
  }

  const mealPlan = weeklyPlan?.meal_plan_detailed || {};
  const exPlan = weeklyPlan?.exercise_plan_detailed || {};

  const todayStr = new Date().toISOString().split('T')[0];

  const dayData = days.map((d, i) => {
    const date = new Date(weeklyPlan?.week_start + 'T12:00:00');
    date.setDate(date.getDate() + i);
    const ds = date.toISOString().split('T')[0];
    const dayMeals = meals.filter(m => m.date === ds);
    const dayEx = exercises.find(e => e.date === ds);
    const planned = mealPlan[d] || [];
    const green = dayMeals.filter(m => m.flag === 'green').length;
    const yellow = dayMeals.filter(m => m.flag === 'yellow').length;
    const red = dayMeals.filter(m => m.flag === 'red').length;
    const total = dayMeals.length;
    const isPast = ds < todayStr;
    const isToday = ds === todayStr;
    const isFuture = ds > todayStr;

    let dominantFlag = 'none';
    if (total > 0) {
      if (green >= yellow && green >= red) dominantFlag = 'green';
      else if (yellow >= red) dominantFlag = 'yellow';
      else dominantFlag = 'red';
    }

    return { day: d, date: ds, dayMeals, dayEx, planned, plannedEx: exPlan[d], green, yellow, red, total, isPast, isToday, isFuture, dominantFlag };
  });

  const flagBg: Record<string, string> = { green: 'bg-green-50 border-green-200', yellow: 'bg-amber-50 border-amber-200', red: 'bg-red-50 border-red-200', none: 'bg-gray-50 border-gray-100' };
  const flagDot: Record<string, string> = { green: 'bg-green-400', yellow: 'bg-amber-400', red: 'bg-red-400', none: 'bg-gray-200' };

  const exDone = exercises.filter(e => e.done).length;
  const exTotal = days.filter(d => exPlan[d] && exPlan[d].type !== 'descanso').length;
  const totalGreen = dayData.reduce((s, d) => s + d.green, 0);
  const totalMeals = dayData.reduce((s, d) => s + d.total, 0);
  const greenPct = totalMeals > 0 ? Math.round((totalGreen / totalMeals) * 100) : 0;

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
          <p className="text-[10px] text-gray-400">Registradas</p>
        </div>
      </div>

      <p className="text-sm font-medium mb-3">Dias da semana</p>

      {dayData.map((dd) => {
        const isOpen = expandedDay === dd.day;
        const borderStyle = dd.isToday ? 'border-teal-300 bg-teal-50/30' : dd.isPast ? `border ${flagBg[dd.dominantFlag]}` : 'border border-gray-100 bg-gray-50/50';

        return (
          <div key={dd.day} className="mb-2">
            <button
              onClick={() => setExpandedDay(isOpen ? null : dd.day)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border ${borderStyle} transition-all`}
            >
              {dd.isPast && dd.total > 0 ? (
                <div className={`w-3 h-3 rounded-full ${flagDot[dd.dominantFlag]}`} />
              ) : dd.isToday ? (
                <div className="w-3 h-3 rounded-full bg-teal-400 animate-pulse" />
              ) : (
                <div className="w-3 h-3 rounded-full bg-gray-200" />
              )}

              <span className={`text-sm font-medium flex-1 text-left ${dd.isToday ? 'text-teal-700' : dd.isFuture ? 'text-gray-400' : ''}`}>
                {dayLabels[dd.day]}
                <span className="text-[10px] text-gray-400 ml-1.5">{dd.date ? new Date(dd.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}</span>
                {dd.isToday && <span className="text-xs text-teal-500 ml-1">hoje</span>}
              </span>

              {dd.plannedEx && dd.plannedEx.type !== 'descanso' && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${dd.dayEx?.done ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
                  {dd.dayEx?.done ? '✓' : ''} {dd.plannedEx.type}
                </span>
              )}

              {dd.total > 0 && (
                <span className="text-[10px] text-gray-400">{dd.green}/{dd.total}</span>
              )}

              <svg className={`w-4 h-4 text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M19 9l-7 7-7-7" /></svg>
            </button>

            {isOpen && (
              <div className="mt-1 ml-2 mr-2 bg-white rounded-xl border border-gray-100 p-3 space-y-2">
                {/* Meals */}
                <p className="text-xs font-medium text-gray-500 mb-1">Refeições</p>
                {(dd.planned.length > 0 ? dd.planned : []).map((pm: any, idx: number) => {
                  const recorded = dd.dayMeals.find((m: any) => m.meal_name === pm.meal);
                  return (
                    <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg ${recorded?.flag ? flagBg[recorded.flag] : 'bg-gray-50'} border border-transparent`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${recorded?.flag ? flagDot[recorded.flag] : 'bg-gray-200'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{pm.meal}</p>
                        <p className="text-[10px] text-gray-500 truncate">{recorded?.feedback || pm.description}</p>
                      </div>
                      {recorded?.flag && <span className="text-[10px] shrink-0">{recorded.flag === 'green' ? '🟢' : recorded.flag === 'yellow' ? '🟡' : '🔴'}</span>}
                    </div>
                  );
                })}

                {/* Exercise */}
                {dd.plannedEx && (
                  <>
                    <p className="text-xs font-medium text-gray-500 mt-2 mb-1">Exercício</p>
                    <div className={`flex items-center gap-2 p-2 rounded-lg ${dd.dayEx?.done ? 'bg-green-50' : 'bg-blue-50'}`}>
                      <div className={`w-2 h-2 rounded-full ${dd.dayEx?.done ? 'bg-green-400' : 'bg-blue-300'}`} />
                      <span className="text-xs flex-1">{dd.plannedEx.type}{dd.plannedEx.description ? ` — ${dd.plannedEx.description}` : ''}</span>
                      <span className="text-[10px]">{dd.dayEx?.done ? '✓ Feito' : dd.plannedEx.type === 'descanso' ? '😴' : 'Pendente'}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
