'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PlanTab({ plan }: { plan: any }) {
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [totalMeals, setTotalMeals] = useState(0);
  const [greenMeals, setGreenMeals] = useState(0);

  useEffect(() => { loadPlanData(); }, []);

  async function loadPlanData() {
    const { data: weeks } = await supabase.from('weekly_plans').select('*').eq('plan_id', plan.id).order('week_number');
    setWeeklyData(weeks || []);

    const { data: meals } = await supabase.from('meals').select('flag').eq('plan_id', plan.id);
    if (meals) {
      setTotalMeals(meals.length);
      setGreenMeals(meals.filter(m => m.flag === 'green').length);
    }
  }

  const goals = plan.goals || [];
  const duration = plan.duration_months || 6;
  const startDate = plan.start_date ? new Date(plan.start_date) : new Date(plan.approved_at || plan.created_at);
  const now = new Date();
  const monthsElapsed = Math.max(1, Math.round((now.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));
  const greenPct = totalMeals > 0 ? Math.round((greenMeals / totalMeals) * 100) : 0;

  const goalColors = ['bg-green-400', 'bg-blue-400', 'bg-orange-400', 'bg-purple-400', 'bg-teal-400'];

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-lg font-medium">Plano — ciclo 1</p>
        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">Mês {monthsElapsed} de {duration}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { v: greenPct + '%', l: 'Refeições verdes', d: `${greenMeals} de ${totalMeals}` },
          { v: weeklyData.length.toString(), l: 'Semanas completadas', d: `de ${duration * 4} previstas` },
          { v: totalMeals.toString(), l: 'Refeições registradas', d: 'no ciclo todo' },
          { v: `${duration}m`, l: 'Duração do plano', d: `${monthsElapsed} meses decorridos` },
        ].map(k => (
          <div key={k.l} className="bg-gray-50 rounded-xl p-3">
            <p className="text-xl font-medium">{k.v}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{k.l}</p>
            <p className="text-[10px] text-teal-600 mt-1">{k.d}</p>
          </div>
        ))}
      </div>

      {plan.scientific_rationale && (
        <>
          <p className="text-sm font-medium mb-2">Racional científico</p>
          <div className="bg-purple-50 rounded-xl p-3 mb-4">
            <p className="text-xs text-purple-800 leading-relaxed whitespace-pre-wrap">{plan.scientific_rationale}</p>
          </div>
        </>
      )}

      <p className="text-sm font-medium mb-2">Metas — progresso</p>
      {goals.map((g: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-3 border-b border-gray-50">
          <div className={`w-2 h-2 rounded-sm ${goalColors[i % goalColors.length]}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm">{g.description || g.type}</p>
            <p className="text-[10px] text-gray-400">{g.measurement} — {g.timeframe}</p>
          </div>
        </div>
      ))}

      {plan.meal_plan_base && (
        <>
          <p className="text-sm font-medium mt-4 mb-2">Plano alimentar base</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: `${plan.meal_plan_base.protein_g}g`, l: 'Proteína', pct: 95 },
              { v: `${plan.meal_plan_base.carbs_g}g`, l: 'Carbo', pct: 90 },
              { v: `${plan.meal_plan_base.fat_g}g`, l: 'Gordura', pct: 88 },
            ].map(m => (
              <div key={m.l} className="bg-gray-50 rounded-xl p-2 text-center">
                <p className="text-sm font-medium">{m.v}</p>
                <p className="text-[10px] text-gray-400">{m.l}/dia</p>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-xl p-2 text-center mt-2">
            <p className="text-sm font-medium">{plan.meal_plan_base.calories} kcal</p>
            <p className="text-[10px] text-gray-400">Meta diária</p>
          </div>
        </>
      )}
    </div>
  );
}
