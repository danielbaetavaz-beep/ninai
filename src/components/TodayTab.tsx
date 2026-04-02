'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday } from '@/lib/dates';
import RecipeModal from '@/components/RecipeModal';

export default function TodayTab({ plan }: { plan: any }) {
  const [todayMeals, setTodayMeals] = useState<any[]>([]);
  const [checkin, setCheckin] = useState<any>(null);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [showAlternatives, setShowAlternatives] = useState<string | null>(null);
  const [mealDescription, setMealDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmData, setConfirmData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showCloseDay, setShowCloseDay] = useState(false);
  const [closingDay, setClosingDay] = useState(false);
  const [showDescribe, setShowDescribe] = useState<string | null>(null);
  const [recipeModal, setRecipeModal] = useState<{ mealName: string; description: string; macros?: any } | null>(null);

  const today = getLocalToday();
  const monthlyPlan = plan?.monthly_plan;

  const flagColor: Record<string, string> = { green: 'bg-green-400', yellow: 'bg-amber-400', red: 'bg-red-400' };
  const flagBg: Record<string, string> = { green: 'bg-green-50', yellow: 'bg-amber-50', red: 'bg-red-50' };
  const flagLabel: Record<string, string> = { green: 'Dentro do plano!', yellow: 'Parcialmente', red: 'Fora do plano' };
  const flagText: Record<string, string> = { green: 'text-green-700', yellow: 'text-amber-700', red: 'text-red-700' };

  useEffect(() => { loadTodayMeals(); }, []);

  async function loadTodayMeals() {
    const { data: meals } = await supabase.from('meals').select('*').eq('plan_id', plan.id).eq('date', today);
    setTodayMeals(meals || []);
    const { data: ci } = await supabase.from('daily_checkins').select('*').eq('plan_id', plan.id).eq('date', today).limit(1);
    if (ci && ci.length > 0) setCheckin(ci[0]);
  }

  function getMealRecord(mealName: string) {
    return todayMeals.find(m => m.meal_name === mealName);
  }

  async function quickRegister(mealName: string, flag: 'green' | 'yellow' | 'red', description?: string) {
    setSaving(true);
    const existing = getMealRecord(mealName);
    const planMeal = monthlyPlan?.meals?.find((m: any) => m.meal_name === mealName);

    if (existing) {
      await supabase.from('meals').update({ flag, completed: true, actual_description: description || (flag === 'green' ? planMeal?.main_option?.description : 'Registrado'), feedback: flag === 'green' ? 'Seguiu o plano!' : flag === 'yellow' ? 'Parcialmente dentro do plano.' : 'Fora do plano.' }).eq('id', existing.id);
    } else {
      await supabase.from('meals').insert({ plan_id: plan.id, date: today, meal_name: mealName, planned_description: planMeal?.main_option?.description, actual_description: description || (flag === 'green' ? planMeal?.main_option?.description : 'Registrado'), flag, completed: true, feedback: flag === 'green' ? 'Seguiu o plano!' : flag === 'yellow' ? 'Parcialmente dentro do plano.' : 'Fora do plano.' });
    }
    setSaving(false);
    setExpandedMeal(null);
    setShowDescribe(null);
    setMealDescription('');
    loadTodayMeals();
  }

  async function analyzeMeal(mealName: string, description: string) {
    setAnalyzing(true);
    const planMeal = monthlyPlan?.meals?.find((m: any) => m.meal_name === mealName);
    const res = await fetch('/api/analyze-meal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mealName, description, plannedDescription: planMeal?.main_option?.description, mealPlanBase: plan.meal_plan_base }),
    });
    const analysis = await res.json();
    setConfirmData({ mealName, description, analysis });
    setAnalyzing(false);
  }

  async function confirmAnalysis() {
    if (!confirmData) return;
    setSaving(true);
    const existing = getMealRecord(confirmData.mealName);
    const data = { plan_id: plan.id, date: today, meal_name: confirmData.mealName, actual_description: confirmData.description, flag: confirmData.analysis.flag, completed: true, feedback: confirmData.analysis.feedback, macros: confirmData.analysis.estimated_macros, ai_analysis: confirmData.analysis };

    if (existing) await supabase.from('meals').update(data).eq('id', existing.id);
    else await supabase.from('meals').insert({ ...data, planned_description: monthlyPlan?.meals?.find((m: any) => m.meal_name === confirmData.mealName)?.main_option?.description });

    setConfirmData(null); setSaving(false); setExpandedMeal(null); setShowDescribe(null); setMealDescription('');
    loadTodayMeals();
  }

  async function saveCheckin(field: string, value: any) {
    const data = { ...checkin, plan_id: plan.id, date: today, [field]: value };
    if (checkin?.id) { await supabase.from('daily_checkins').update({ [field]: value }).eq('id', checkin.id); }
    else { const { data: newC } = await supabase.from('daily_checkins').insert(data).select().single(); if (newC) setCheckin(newC); return; }
    setCheckin(data);
  }

  async function closeDay() {
    setClosingDay(true);
    await saveCheckin('day_closed', true);
    setClosingDay(false); setShowCloseDay(false);
  }

  const registeredCount = todayMeals.filter(m => m.completed).length;
  const totalMeals = monthlyPlan?.meals?.length || 0;

  if (!monthlyPlan) {
    return (
      <div className="p-4 text-center py-12">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3"><span className="text-2xl">📋</span></div>
        <p className="text-sm text-gray-600 font-medium mb-1">Plano mensal não gerado</p>
        <p className="text-xs text-gray-400">Vá em Agenda → Gerar plano mensal para criar seu cardápio.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Confirm analysis modal */}
      {confirmData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmData(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <h3 className="text-base font-medium mb-3">Confirmar {confirmData.mealName}</h3>
            <p className="text-sm bg-gray-50 rounded-xl p-3 mb-3 italic">&ldquo;{confirmData.description}&rdquo;</p>
            <div className={`rounded-xl p-3 mb-3 ${flagBg[confirmData.analysis.flag] || 'bg-gray-50'}`}>
              <p className={`text-sm font-medium ${flagText[confirmData.analysis.flag] || ''}`}>{flagLabel[confirmData.analysis.flag] || ''}</p>
              <p className="text-xs text-gray-600 mt-1">{confirmData.analysis.feedback}</p>
            </div>
            {confirmData.analysis.estimated_macros && (
              <div className="grid grid-cols-4 gap-1 mb-4">
                {[{ l: 'Prot', v: confirmData.analysis.estimated_macros.protein_g }, { l: 'Carb', v: confirmData.analysis.estimated_macros.carbs_g }, { l: 'Gord', v: confirmData.analysis.estimated_macros.fat_g }, { l: 'Kcal', v: confirmData.analysis.estimated_macros.calories }].map(m => (
                  <div key={m.l} className="bg-gray-50 rounded-lg p-2 text-center"><p className="text-sm font-medium">{Math.round(m.v || 0)}</p><p className="text-[10px] text-gray-400">{m.l}</p></div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setConfirmData(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500">Cancelar</button>
              <button onClick={confirmAnalysis} disabled={saving} className="flex-1 py-2.5 bg-teal-400 text-white rounded-xl text-sm font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-lg font-medium">Hoje</p>
          <p className="text-xs text-gray-400">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <span className="text-xs text-gray-400">{registeredCount}/{totalMeals} refeições</span>
      </div>

      {/* Hydration tip */}
      {monthlyPlan.hydration && (
        <div className="bg-blue-50 rounded-xl p-3 mb-4 flex items-center gap-2">
          <span className="text-lg">💧</span>
          <p className="text-xs text-blue-700">{monthlyPlan.hydration}</p>
        </div>
      )}

      {/* Meals */}
      {(monthlyPlan.meals || []).map((planMeal: any, i: number) => {
        const record = getMealRecord(planMeal.meal_name);
        const isCompleted = record?.completed;
        const isExpanded = expandedMeal === planMeal.meal_name;
        const showingAlts = showAlternatives === planMeal.meal_name;
        const isDescribing = showDescribe === planMeal.meal_name;

        return (
          <div key={i} className="mb-3">
            {/* Meal card */}
            <div onClick={() => { if (!confirmData) setExpandedMeal(isExpanded ? null : planMeal.meal_name); }}
              className={`rounded-2xl overflow-hidden border transition-all ${isCompleted ? `${flagBg[record.flag]} border-${record.flag === 'green' ? 'green' : record.flag === 'yellow' ? 'amber' : 'red'}-200` : 'border-gray-100 bg-white'}`}>

              {/* Meal header */}
              <div className="p-3 flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${isCompleted ? flagColor[record.flag] : 'bg-gray-200'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{planMeal.meal_name}</p>
                    {planMeal.time_suggestion && <span className="text-[10px] text-gray-400">{planMeal.time_suggestion}</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{isCompleted ? (record.actual_description || record.planned_description) : planMeal.main_option?.description}</p>
                </div>
                {isCompleted ? (
                  <div className={`w-7 h-7 rounded-full ${flagBg[record.flag]} flex items-center justify-center`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={record.flag === 'green' ? '#639922' : record.flag === 'yellow' ? '#d97706' : '#dc2626'} strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
                  </div>
                ) : (
                  <svg className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M19 9l-7 7-7-7" /></svg>
                )}
              </div>

              {/* Expanded content */}
              {isExpanded && !isCompleted && (
                <div className="px-3 pb-3 border-t border-gray-50">
                  {/* Main option detail */}
                  <div className="bg-gray-50 rounded-xl p-3 mt-3 mb-2">
                    <p className="text-[10px] text-gray-500 font-medium mb-1">OPÇÃO PRINCIPAL</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{planMeal.main_option?.description}</p>
                    {planMeal.main_option?.ingredients && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {planMeal.main_option.ingredients.map((ing: string, j: number) => (
                          <span key={j} className="text-[10px] bg-white px-2 py-0.5 rounded-full text-gray-600">{ing}</span>
                        ))}
                      </div>
                    )}
                    {planMeal.main_option?.macros && (
                      <div className="flex gap-3 mt-2 text-[10px] text-gray-400">
                        <span>P: {planMeal.main_option.macros.protein_g}g</span>
                        <span>C: {planMeal.main_option.macros.carbs_g}g</span>
                        <span>G: {planMeal.main_option.macros.fat_g}g</span>
                        <span>{planMeal.main_option.macros.calories} kcal</span>
                      </div>
                    )}
                  </div>

                  {/* Alternatives toggle */}
                  <button onClick={(e) => { e.stopPropagation(); setShowAlternatives(showingAlts ? null : planMeal.meal_name); }}
                    className="w-full py-2 mb-3 text-xs text-teal-600 font-medium flex items-center justify-center gap-1">
                    🔄 {showingAlts ? 'Ocultar alternativas' : 'Ver alternativas'}
                  </button>

                  {/* Alternatives list */}
                  {showingAlts && planMeal.alternatives && (
                    <div className="space-y-2 mb-3">
                      {planMeal.alternatives.map((alt: any, j: number) => (
                        <div key={j} className="bg-teal-50/50 rounded-xl p-2.5 border border-teal-100">
                          <p className="text-[10px] text-teal-600 font-medium mb-0.5">Alternativa {j + 1}</p>
                          <p className="text-xs text-gray-700">{alt.description}</p>
                          {alt.ingredients && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {alt.ingredients.map((ing: string, k: number) => (
                                <span key={k} className="text-[9px] bg-white px-1.5 py-0.5 rounded-full text-gray-500">{ing}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recipe button */}
                  <button onClick={(e) => { e.stopPropagation(); setRecipeModal({ mealName: planMeal.meal_name, description: planMeal.main_option?.description, macros: planMeal.main_option?.macros }); }}
                    className="w-full py-2 mb-3 bg-white border border-teal-200 text-teal-700 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5">
                    👨‍🍳 Ver receita e modo de preparo
                  </button>

                  {/* Quick register buttons */}
                  <p className="text-[10px] text-gray-400 mb-2 text-center">Como foi essa refeição?</p>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <button onClick={(e) => { e.stopPropagation(); quickRegister(planMeal.meal_name, 'green'); }} disabled={saving}
                      className="py-3 rounded-xl bg-green-100 text-green-800 text-xs font-medium active:scale-95">
                      ✅ Segui<br/>o plano
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); quickRegister(planMeal.meal_name, 'yellow'); }} disabled={saving}
                      className="py-3 rounded-xl bg-amber-100 text-amber-800 text-xs font-medium active:scale-95">
                      ⚠️ Mais ou<br/>menos
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setShowDescribe(isDescribing ? null : planMeal.meal_name); }} disabled={saving}
                      className="py-3 rounded-xl bg-gray-100 text-gray-700 text-xs font-medium active:scale-95">
                      ✏️ Comi<br/>diferente
                    </button>
                  </div>

                  {/* Describe what was eaten */}
                  {isDescribing && (
                    <div className="mt-2" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <textarea value={mealDescription} onChange={e => setMealDescription(e.target.value)} placeholder="Descreva o que você comeu..."
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 resize-none" rows={2} autoFocus />
                      <button onClick={() => { if (mealDescription.trim()) analyzeMeal(planMeal.meal_name, mealDescription); }}
                        disabled={!mealDescription.trim() || analyzing}
                        className="w-full mt-2 py-2.5 bg-teal-400 text-white rounded-xl text-xs font-medium disabled:opacity-50">
                        {analyzing ? 'Analisando...' : 'Analisar refeição'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Completed feedback */}
              {isExpanded && isCompleted && (
                <div className="px-3 pb-3 border-t border-gray-50">
                  <p className="text-xs text-gray-600 mt-2">{record.actual_description}</p>
                  {record.feedback && <p className="text-[10px] text-gray-500 italic mt-1">{record.feedback}</p>}
                  {record.macros && (
                    <div className="flex gap-3 mt-2 text-[10px] text-gray-400">
                      <span>P: {record.macros.protein_g}g</span><span>C: {record.macros.carbs_g}g</span><span>G: {record.macros.fat_g}g</span><span>{record.macros.calories}kcal</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Exercise */}
      {monthlyPlan.exercise_plan && (
        <div className="bg-blue-50 rounded-2xl p-4 mb-4">
          <p className="text-sm font-medium text-blue-800 mb-1">Exercício de hoje</p>
          {(() => {
            const dayName = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
            const todayExercise = monthlyPlan.exercise_plan.weekly_schedule?.find((e: any) =>
              dayName.toLowerCase().includes(e.day?.toLowerCase())
            );
            return todayExercise ? (
              <div>
                <p className="text-xs text-blue-700">{todayExercise.activity}</p>
                <p className="text-[10px] text-blue-500 mt-0.5">{todayExercise.duration}</p>
              </div>
            ) : (
              <p className="text-xs text-blue-600">Dia de descanso ou atividade leve</p>
            );
          })()}
        </div>
      )}

      {/* Daily checkin */}
      <p className="text-sm font-medium mb-2 mt-4">Como está seu dia?</p>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Água (L)', field: 'water_liters', options: [{ v: 0.5, l: '0.5' }, { v: 1, l: '1' }, { v: 1.5, l: '1.5' }, { v: 2, l: '2' }, { v: 2.5, l: '2.5' }, { v: 3, l: '3+' }] },
          { label: 'Sono (h)', field: 'sleep_hours', options: [{ v: 4, l: '4' }, { v: 5, l: '5' }, { v: 6, l: '6' }, { v: 7, l: '7' }, { v: 8, l: '8+' }] },
          { label: 'Energia', field: 'energy_level', options: [{ v: 1, l: '😴' }, { v: 2, l: '😐' }, { v: 3, l: '🙂' }, { v: 4, l: '😄' }, { v: 5, l: '🔥' }] },
          { label: 'Digestão', field: 'digestion', options: [{ v: 'ruim', l: '😣' }, { v: 'regular', l: '😐' }, { v: 'boa', l: '😊' }] },
        ].map(item => (
          <div key={item.field} className="bg-gray-50 rounded-xl p-2 text-center">
            <select value={checkin?.[item.field] || ''} onChange={e => saveCheckin(item.field, item.field === 'digestion' ? e.target.value : Number(e.target.value))} className="text-sm font-medium bg-transparent text-center w-full">
              <option value="">--</option>
              {item.options.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <p className="text-[10px] text-gray-400">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Close day */}
      {totalMeals > 0 && registeredCount > 0 && !checkin?.day_closed && (
        <button onClick={() => setShowCloseDay(true)} className="w-full mt-2 py-4 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500 font-medium">Encerrar o dia</button>
      )}

      {showCloseDay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCloseDay(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <p className="text-base font-medium mb-2">Encerrar o dia?</p>
            <p className="text-xs text-gray-500 mb-4">{registeredCount}/{totalMeals} refeições registradas</p>
            <div className="flex gap-2">
              <button onClick={() => setShowCloseDay(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500">Cancelar</button>
              <button onClick={closeDay} disabled={closingDay} className="flex-1 py-2.5 bg-teal-400 text-white rounded-xl text-sm font-medium">{closingDay ? 'Fechando...' : 'Encerrar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Modal */}
      {recipeModal && <RecipeModal mealName={recipeModal.mealName} description={recipeModal.description} macros={recipeModal.macros} onClose={() => setRecipeModal(null)} />}
    </div>
  );
}
