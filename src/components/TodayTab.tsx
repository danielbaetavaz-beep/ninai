'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday } from '@/lib/dates';
import RecipeModal from '@/components/RecipeModal';

const COLORS = [
  { bg: '#0F6E56', light: '#E1F5EE', text: '#fff', darkText: '#085041' },
  { bg: '#1D9E75', light: '#E1F5EE', text: '#fff', darkText: '#0F6E56' },
  { bg: '#378ADD', light: '#E6F1FB', text: '#fff', darkText: '#0C447C' },
  { bg: '#7F77DD', light: '#EEEDFE', text: '#fff', darkText: '#3C3489' },
  { bg: '#D85A30', light: '#FAECE7', text: '#fff', darkText: '#712B13' },
];

export default function TodayTab({ plan }: { plan: any }) {
  const [todayMeals, setTodayMeals] = useState<any[]>([]);
  const [checkin, setCheckin] = useState<any>(null);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [showAlternatives, setShowAlternatives] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, Record<string, number>>>({});
  const [mealDescription, setMealDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmData, setConfirmData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showDescribe, setShowDescribe] = useState<string | null>(null);
  const [recipeModal, setRecipeModal] = useState<{ mealName: string; description: string; macros?: any } | null>(null);

  const today = getLocalToday();
  const monthlyPlan = plan?.monthly_plan;
  const hideMacros = plan?.meal_plan_base?.hide_macros === true;

  useEffect(() => { loadTodayMeals(); }, []);

  async function loadTodayMeals() {
    const { data: meals } = await supabase.from('meals').select('*').eq('plan_id', plan.id).eq('date', today);
    setTodayMeals(meals || []);
    const { data: ci } = await supabase.from('daily_checkins').select('*').eq('plan_id', plan.id).eq('date', today).limit(1);
    if (ci && ci.length > 0) setCheckin(ci[0]);
  }

  function getMealRecord(mealName: string) { return todayMeals.find(m => m.meal_name === mealName); }

  function selectAlternative(mealName: string, rowIdx: number, altIdx: number) {
    setSelections(prev => ({
      ...prev,
      [mealName]: { ...(prev[mealName] || {}), [rowIdx]: altIdx }
    }));
  }

  function getSelectedDescription(planMeal: any): string {
    const mealSel = selections[planMeal.meal_name] || {};
    return (planMeal.ingredient_rows || []).map((row: any, i: number) => {
      const sel = mealSel[i];
      if (sel !== undefined && sel >= 0 && row.alternatives?.[sel]) {
        return `${row.alternatives[sel].item} ${row.alternatives[sel].quantity}`;
      }
      return `${row.main.item} ${row.main.quantity}`;
    }).join(' + ');
  }

  async function quickRegister(mealName: string, flag: 'green' | 'yellow' | 'red', description?: string) {
    setSaving(true);
    const existing = getMealRecord(mealName);
    const planMeal = monthlyPlan?.meals?.find((m: any) => m.meal_name === mealName);
    const desc = description || getSelectedDescription(planMeal);

    const mealData = {
      plan_id: plan.id, date: today, meal_name: mealName,
      planned_description: getSelectedDescription(planMeal),
      actual_description: desc,
      flag, completed: true,
      feedback: flag === 'green' ? 'Seguiu o plano!' : flag === 'yellow' ? 'Parcialmente dentro do plano.' : 'Fora do plano.',
    };

    if (existing) await supabase.from('meals').update(mealData).eq('id', existing.id);
    else await supabase.from('meals').insert(mealData);

    setSaving(false); setExpandedMeal(null); setShowDescribe(null); setMealDescription('');
    loadTodayMeals();
  }

  async function analyzeMeal(mealName: string, description: string) {
    setAnalyzing(true);
    const planMeal = monthlyPlan?.meals?.find((m: any) => m.meal_name === mealName);
    const res = await fetch('/api/analyze-meal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mealName, description, plannedDescription: getSelectedDescription(planMeal), mealPlanBase: plan.meal_plan_base }),
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
    else await supabase.from('meals').insert({ ...data, planned_description: confirmData.description });
    setConfirmData(null); setSaving(false); setExpandedMeal(null); setShowDescribe(null); setMealDescription('');
    loadTodayMeals();
  }

  async function saveCheckin(field: string, value: any) {
    const data = { ...checkin, plan_id: plan.id, date: today, [field]: value };
    if (checkin?.id) await supabase.from('daily_checkins').update({ [field]: value }).eq('id', checkin.id);
    else { const { data: newC } = await supabase.from('daily_checkins').insert(data).select().single(); if (newC) { setCheckin(newC); return; } }
    setCheckin(data);
  }

  const registeredCount = todayMeals.filter(m => m.completed).length;
  const totalMeals = monthlyPlan?.meals?.length || 0;

  if (!monthlyPlan) return (
    <div className="p-6 text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">📋</span>
      </div>
      <p className="text-base font-medium text-gray-700 mb-1">Plano mensal não gerado</p>
      <p className="text-xs text-gray-400 max-w-xs mx-auto">Seu cardápio personalizado ainda não foi criado. Complete o onboarding para gerar.</p>
    </div>
  );

  return (
    <div className="px-4 pt-4 pb-8">
      {/* Confirm modal */}
      {confirmData && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setConfirmData(null)}>
          <div className="bg-white rounded-t-3xl w-full max-w-md p-5 pb-8" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <p className="text-base font-medium mb-3">{confirmData.mealName}</p>
            <div className="bg-gray-50 rounded-xl p-3 mb-3">
              <p className="text-xs text-gray-600 italic">&ldquo;{confirmData.description}&rdquo;</p>
            </div>
            <div className={`rounded-xl p-3 mb-3 ${confirmData.analysis.flag === 'green' ? 'bg-green-50' : confirmData.analysis.flag === 'yellow' ? 'bg-amber-50' : 'bg-red-50'}`}>
              <p className={`text-sm font-medium ${confirmData.analysis.flag === 'green' ? 'text-green-700' : confirmData.analysis.flag === 'yellow' ? 'text-amber-700' : 'text-red-600'}`}>
                {confirmData.analysis.flag === 'green' ? 'Dentro do plano!' : confirmData.analysis.flag === 'yellow' ? 'Parcialmente' : 'Fora do plano'}
              </p>
              <p className="text-xs text-gray-600 mt-1">{confirmData.analysis.feedback}</p>
            </div>
            {confirmData.analysis.estimated_macros && !hideMacros && (
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[{ l: 'Prot', v: confirmData.analysis.estimated_macros.protein_g }, { l: 'Carb', v: confirmData.analysis.estimated_macros.carbs_g }, { l: 'Gord', v: confirmData.analysis.estimated_macros.fat_g }, { l: 'Kcal', v: confirmData.analysis.estimated_macros.calories }].map(m => (
                  <div key={m.l} className="bg-gray-50 rounded-lg p-2 text-center"><p className="text-sm font-medium">{Math.round(m.v || 0)}</p><p className="text-[10px] text-gray-400">{m.l}</p></div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setConfirmData(null)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-500">Cancelar</button>
              <button onClick={confirmAnalysis} disabled={saving} className="flex-1 py-3 bg-teal-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xl font-medium tracking-tight">Hoje</p>
          <p className="text-xs text-gray-400 mt-0.5">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-teal-50 px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 rounded-full bg-teal-400" />
          <span className="text-xs font-medium text-teal-700">{registeredCount}/{totalMeals}</span>
        </div>
      </div>

      {/* Hydration */}
      {monthlyPlan.hydration && (
        <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-sky-50 rounded-2xl p-3.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C12 2 5 11 5 15.5C5 19.64 8.13 23 12 23C15.87 23 19 19.64 19 15.5C19 11 12 2 12 2Z" fill="#378ADD" opacity="0.6"/></svg>
          </div>
          <p className="text-xs text-blue-800 leading-relaxed">{monthlyPlan.hydration}</p>
        </div>
      )}

      {/* Meals */}
      {(monthlyPlan.meals || []).map((planMeal: any, mealIdx: number) => {
        const record = getMealRecord(planMeal.meal_name);
        const isCompleted = record?.completed;
        const isExpanded = expandedMeal === planMeal.meal_name;
        const isShowingAlts = showAlternatives === planMeal.meal_name;
        const isDescribing = showDescribe === planMeal.meal_name;
        const mealColor = COLORS[mealIdx % COLORS.length];
        const mealSelections = selections[planMeal.meal_name] || {};

        return (
          <div key={mealIdx} className="mb-3">
            <div className={`rounded-2xl overflow-hidden transition-all duration-200 ${isCompleted ? (record.flag === 'green' ? 'bg-green-50 ring-1 ring-green-200' : record.flag === 'yellow' ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-red-50 ring-1 ring-red-200') : isExpanded ? 'ring-1 ring-gray-200 bg-white' : 'bg-white ring-1 ring-gray-100'}`}>

              {/* Header */}
              <div onClick={() => { if (!confirmData) setExpandedMeal(isExpanded ? null : planMeal.meal_name); }}
                className="flex items-center gap-3 p-4 cursor-pointer active:bg-gray-50/50 transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: isCompleted ? (record.flag === 'green' ? '#C0DD97' : record.flag === 'yellow' ? '#FAC775' : '#F7C1C1') : mealColor.light }}>
                  {isCompleted ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={record.flag === 'green' ? '#3B6D11' : record.flag === 'yellow' ? '#854F0B' : '#791F1F'} strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <span className="text-sm font-medium" style={{ color: mealColor.darkText }}>{planMeal.time_suggestion || '—'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isCompleted ? (record.flag === 'green' ? 'text-green-800' : record.flag === 'yellow' ? 'text-amber-800' : 'text-red-800') : 'text-gray-800'}`}>{planMeal.meal_name}</p>
                  <p className={`text-xs truncate mt-0.5 ${isCompleted ? 'text-gray-500' : 'text-gray-400'}`}>
                    {isCompleted ? (record.flag === 'green' ? 'Seguiu o plano' : record.actual_description || 'Registrado') : (planMeal.ingredient_rows || []).map((r: any) => r.main.item).join(' · ')}
                  </p>
                </div>
                {!isCompleted && (
                  <svg className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M19 9l-7 7-7-7" /></svg>
                )}
              </div>

              {/* Expanded content */}
              {isExpanded && !isCompleted && (
                <div className="px-4 pb-4">
                  <div className="h-px bg-gray-100 -mx-4 mb-4" />

                  {/* Ingredient grid — main options */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {(planMeal.ingredient_rows || []).map((row: any, rowIdx: number) => {
                      const c = COLORS[rowIdx % COLORS.length];
                      const isSelected = mealSelections[rowIdx] === undefined;
                      return (
                        <div key={rowIdx} className="rounded-xl p-3 text-center transition-all" style={{ background: isSelected ? c.bg : c.light, color: isSelected ? c.text : c.darkText }}>
                          <p className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">{row.category}</p>
                          <p className="text-xs font-medium leading-tight">{row.main.item}</p>
                          <p className="text-[10px] opacity-70 mt-0.5">{row.main.quantity}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Macros */}
                  {planMeal.macros && !hideMacros && (
                    <div className="flex justify-center gap-4 mb-3">
                      {[{ l: 'P', v: planMeal.macros.protein_g, u: 'g' }, { l: 'C', v: planMeal.macros.carbs_g, u: 'g' }, { l: 'G', v: planMeal.macros.fat_g, u: 'g' }, { l: '', v: planMeal.macros.calories, u: 'kcal' }].map((m, i) => (
                        <span key={i} className="text-[10px] text-gray-400">{m.l}{m.l ? ':' : ''}{m.v}{m.u}</span>
                      ))}
                    </div>
                  )}

                  {/* Alternatives toggle */}
                  <button onClick={(e) => { e.stopPropagation(); setShowAlternatives(isShowingAlts ? null : planMeal.meal_name); }}
                    className="w-full py-2.5 mb-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                    style={{ background: isShowingAlts ? '#E1F5EE' : '#f8f8f6', color: isShowingAlts ? '#0F6E56' : '#888' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                    {isShowingAlts ? 'Ocultar alternativas' : 'Ver alternativas'}
                  </button>

                  {/* Alternatives by ingredient row */}
                  {isShowingAlts && (
                    <div className="mb-3 space-y-3">
                      {(planMeal.ingredient_rows || []).map((row: any, rowIdx: number) => {
                        if (!row.alternatives?.length) return null;
                        const c = COLORS[rowIdx % COLORS.length];
                        const currentSel = mealSelections[rowIdx];
                        return (
                          <div key={rowIdx}>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5 font-medium">{row.category}</p>
                            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                              {/* Main option */}
                              <button onClick={(e) => { e.stopPropagation(); setSelections(prev => { const copy: Record<string, Record<string, number>> = JSON.parse(JSON.stringify(prev)); if (!copy[planMeal.meal_name]) copy[planMeal.meal_name] = {}; delete copy[planMeal.meal_name][String(rowIdx)]; return copy; }); }}
                                className="shrink-0 rounded-lg px-3 py-2 text-left transition-all"
                                style={{ background: currentSel === undefined ? c.bg : 'white', color: currentSel === undefined ? 'white' : '#666', border: currentSel === undefined ? 'none' : '1px solid #e5e5e5', minWidth: '100px' }}>
                                <p className="text-[10px] font-medium">{row.main.item}</p>
                                <p className="text-[9px] opacity-70">{row.main.quantity}</p>
                                {currentSel === undefined && <p className="text-[8px] mt-0.5 opacity-60">selecionado</p>}
                              </button>
                              {/* Alternatives */}
                              {row.alternatives.map((alt: any, altIdx: number) => (
                                <button key={altIdx} onClick={(e) => { e.stopPropagation(); selectAlternative(planMeal.meal_name, rowIdx, altIdx); }}
                                  className="shrink-0 rounded-lg px-3 py-2 text-left transition-all"
                                  style={{ background: currentSel === altIdx ? c.bg : 'white', color: currentSel === altIdx ? 'white' : '#666', border: currentSel === altIdx ? 'none' : '1px solid #e5e5e5', minWidth: '100px' }}>
                                  <p className="text-[10px] font-medium">{alt.item}</p>
                                  <p className="text-[9px] opacity-70">{alt.quantity}</p>
                                  {currentSel === altIdx && <p className="text-[8px] mt-0.5 opacity-60">selecionado</p>}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Suggestions */}
                      {planMeal.suggestions?.length > 0 && (
                        <div className="bg-amber-50/60 rounded-xl p-3 mt-2">
                          <p className="text-[10px] uppercase tracking-wider text-amber-700 font-medium mb-1.5">Sugestões de combinação</p>
                          {planMeal.suggestions.map((s: string, i: number) => (
                            <p key={i} className="text-[11px] text-amber-800 leading-relaxed">• {s}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recipe button */}
                  <button onClick={(e) => { e.stopPropagation(); setRecipeModal({ mealName: planMeal.meal_name, description: getSelectedDescription(planMeal), macros: planMeal.macros }); }}
                    className="w-full py-2.5 mb-4 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 bg-white ring-1 ring-teal-200 text-teal-700 active:scale-[0.98] transition-transform">
                    👨‍🍳 Ver receita e modo de preparo
                  </button>

                  {/* Register buttons */}
                  <p className="text-[10px] text-gray-400 text-center mb-2">Como foi essa refeição?</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={(e) => { e.stopPropagation(); quickRegister(planMeal.meal_name, 'green'); }} disabled={saving}
                      className="py-3.5 rounded-xl text-center active:scale-95 transition-transform bg-gradient-to-b from-green-100 to-green-50 ring-1 ring-green-200">
                      <p className="text-base mb-0.5">✅</p>
                      <p className="text-[10px] font-medium text-green-800">Segui o plano</p>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); quickRegister(planMeal.meal_name, 'yellow'); }} disabled={saving}
                      className="py-3.5 rounded-xl text-center active:scale-95 transition-transform bg-gradient-to-b from-amber-100 to-amber-50 ring-1 ring-amber-200">
                      <p className="text-base mb-0.5">⚠️</p>
                      <p className="text-[10px] font-medium text-amber-800">Mais ou menos</p>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setShowDescribe(isDescribing ? null : planMeal.meal_name); }} disabled={saving}
                      className="py-3.5 rounded-xl text-center active:scale-95 transition-transform bg-gradient-to-b from-gray-100 to-gray-50 ring-1 ring-gray-200">
                      <p className="text-base mb-0.5">✏️</p>
                      <p className="text-[10px] font-medium text-gray-600">Comi diferente</p>
                    </button>
                  </div>

                  {/* Describe */}
                  {isDescribing && (
                    <div className="mt-3" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <textarea value={mealDescription} onChange={e => setMealDescription(e.target.value)} placeholder="Descreva o que você comeu..."
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none" rows={2} autoFocus />
                      <button onClick={() => { if (mealDescription.trim()) analyzeMeal(planMeal.meal_name, mealDescription); }}
                        disabled={!mealDescription.trim() || analyzing}
                        className="w-full mt-2 py-3 bg-teal-500 text-white rounded-xl text-xs font-medium disabled:opacity-40 active:scale-[0.98] transition-transform">
                        {analyzing ? 'Analisando com IA...' : 'Analisar refeição'}
                      </button>
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
        <div className="mt-2 mb-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 ring-1 ring-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="3"/><path d="M6.5 8h11M12 8v13M7 12l-2 3M17 12l2 3"/></svg>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">Exercício de hoje</p>
                {(() => {
                  const dayName = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
                  const todayEx = monthlyPlan.exercise_plan.weekly_schedule?.find((e: any) => dayName.toLowerCase().includes(e.day?.toLowerCase()));
                  return todayEx ? (
                    <><p className="text-xs text-blue-700 mt-0.5">{todayEx.activity}</p><p className="text-[10px] text-blue-500 mt-0.5">{todayEx.duration}</p></>
                  ) : <p className="text-xs text-blue-600 mt-0.5">Dia de descanso</p>;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkin */}
      <div className="mb-4">
        <p className="text-sm font-medium mb-3">Como está seu dia?</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Água (L)', field: 'water_liters', options: [{ v: 0.5, l: '0.5' }, { v: 1, l: '1' }, { v: 1.5, l: '1.5' }, { v: 2, l: '2' }, { v: 2.5, l: '2.5' }, { v: 3, l: '3+' }] },
            { label: 'Sono (h)', field: 'sleep_hours', options: [{ v: 4, l: '4' }, { v: 5, l: '5' }, { v: 6, l: '6' }, { v: 7, l: '7' }, { v: 8, l: '8+' }] },
            { label: 'Energia', field: 'energy_level', options: [{ v: 1, l: '😴' }, { v: 2, l: '😐' }, { v: 3, l: '🙂' }, { v: 4, l: '😄' }, { v: 5, l: '🔥' }] },
            { label: 'Digestão', field: 'digestion', options: [{ v: 'ruim', l: '😣' }, { v: 'regular', l: '😐' }, { v: 'boa', l: '😊' }] },
          ].map(item => (
            <div key={item.field} className="bg-gray-50 rounded-xl p-2.5 text-center ring-1 ring-gray-100">
              <select value={checkin?.[item.field] || ''} onChange={e => saveCheckin(item.field, item.field === 'digestion' ? e.target.value : Number(e.target.value))} className="text-sm font-medium bg-transparent text-center w-full appearance-none">
                <option value="">--</option>
                {item.options.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <p className="text-[9px] text-gray-400 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {monthlyPlan.general_notes && (
        <div className="bg-gray-50 rounded-xl p-3 mb-4 ring-1 ring-gray-100">
          <p className="text-[10px] font-medium text-gray-500 mb-1">Observações da nutricionista</p>
          <p className="text-xs text-gray-600 leading-relaxed">{monthlyPlan.general_notes}</p>
        </div>
      )}

      {/* Recipe Modal */}
      {recipeModal && <RecipeModal mealName={recipeModal.mealName} description={recipeModal.description} macros={recipeModal.macros} onClose={() => setRecipeModal(null)} />}
    </div>
  );
}
