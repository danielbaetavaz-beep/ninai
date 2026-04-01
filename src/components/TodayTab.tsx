'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday } from '@/lib/dates';

export default function TodayTab({ plan, todayPlan }: { plan: any; todayPlan: any }) {
  const [todayMeals, setTodayMeals] = useState<any[]>([]);
  const [todayExercise, setTodayExercise] = useState<any>(null);
  const [checkin, setCheckin] = useState<any>(null);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mealDescription, setMealDescription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmData, setConfirmData] = useState<any>(null);
  const [showOtherExercise, setShowOtherExercise] = useState(false);
  const [otherExerciseText, setOtherExerciseText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCloseDay, setShowCloseDay] = useState(false);
  const [closingDay, setClosingDay] = useState(false);
  const [showDescribe, setShowDescribe] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const today = getLocalToday();
  const dayLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const todayDate = new Date();
  const dayLabel = dayLabels[todayDate.getDay()];

  useEffect(() => { loadToday(); }, []);

  async function loadToday() {
    const { data: meals } = await supabase.from('meals').select('*').eq('plan_id', plan.id).eq('date', today);
    const { data: exercise } = await supabase.from('exercises').select('*').eq('plan_id', plan.id).eq('date', today).limit(1);
    const { data: ci } = await supabase.from('daily_checkins').select('*').eq('plan_id', plan.id).eq('date', today).limit(1);

    const plannedMeals = todayPlan?.meals || [];
    const mealList = plannedMeals.map((pm: any) => {
      const existing = meals?.find(m => m.meal_name === pm.meal);
      return existing || { meal_name: pm.meal, planned_description: pm.description, macros: null, date: today, plan_id: plan.id, location: pm.location };
    });
    setTodayMeals(mealList);

    const plannedEx = todayPlan?.exercise;
    if (exercise && exercise.length > 0) {
      setTodayExercise(exercise[0]);
    } else if (plannedEx) {
      setTodayExercise({ planned_type: plannedEx.type, description: plannedEx.description, done: false, date: today });
    } else {
      setTodayExercise(null);
    }

    setCheckin(ci && ci.length > 0 ? ci[0] : null);
  }

  async function saveMeal(mealName: string, data: any) {
    const { data: existing } = await supabase.from('meals').select('id').eq('plan_id', plan.id).eq('date', today).eq('meal_name', mealName).limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('meals').update(data).eq('id', existing[0].id);
    } else {
      await supabase.from('meals').insert({ plan_id: plan.id, date: today, meal_name: mealName, ...data });
    }
  }

  async function handlePhotoUpload(mealName: string, file: File) {
    setUploading(true);
    const fileName = `${plan.id}/${today}/${mealName.replace(/\s/g, '_')}_${Date.now()}.jpg`;
    await supabase.storage.from('meal-photos').upload(fileName, file);
    const { data: urlData } = supabase.storage.from('meal-photos').getPublicUrl(fileName);
    await saveMeal(mealName, { planned_description: todayMeals.find(m => m.meal_name === mealName)?.planned_description || '', photo_url: urlData.publicUrl });
    setUploading(false);
    await loadToday();
  }

  async function analyzeMealDescription(mealName: string) {
    if (!mealDescription.trim()) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-meal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: mealDescription, mealName, plannedDescription: todayMeals.find(m => m.meal_name === mealName)?.planned_description || '', mealPlanContext: plan.meal_plan_base }) });
      const analysis = await res.json();
      setConfirmData({ mealName, analysis, description: mealDescription });
    } catch { alert('Erro ao analisar.'); }
    setAnalyzing(false);
  }

  async function confirmMealAnalysis() {
    if (!confirmData || saving) return;
    setSaving(true);
    const { mealName, analysis, description } = confirmData;
    const existing = todayMeals.find(m => m.meal_name === mealName);
    await saveMeal(mealName, { planned_description: existing?.planned_description || '', photo_url: existing?.photo_url || null, actual_description: description, ai_analysis: analysis, flag: analysis.flag, feedback: analysis.feedback, macros: analysis.estimated_macros, completed: true });
    setConfirmData(null); setMealDescription(''); setExpandedMeal(null); setSaving(false);
    await loadToday();
  }

  async function skipMeal(mealName: string) {
    await saveMeal(mealName, { planned_description: todayMeals.find(m => m.meal_name === mealName)?.planned_description || '', completed: false, flag: 'red', feedback: 'Refeição não realizada', macros: { protein_g: 0, carbs_g: 0, fat_g: 0, calories: 0 } });
    setExpandedMeal(null);
    await loadToday();
  }

  // Quick register with one tap
  async function quickRegister(meal: any, flag: 'green' | 'yellow' | 'red') {
    const planned = meal.planned_description || '';
    const plannedMacros = todayPlan?.meals?.find((m: any) => m.meal === meal.meal_name)?.macros || {};
    
    if (flag === 'green') {
      // 100% of planned macros
      await saveMeal(meal.meal_name, {
        planned_description: planned,
        actual_description: planned,
        flag: 'green',
        feedback: 'Refeição realizada como planejado',
        macros: plannedMacros,
        completed: true,
      });
    } else if (flag === 'yellow') {
      // 50% of planned macros
      await saveMeal(meal.meal_name, {
        planned_description: planned,
        actual_description: 'Parcialmente realizada',
        flag: 'yellow',
        feedback: 'Refeição parcialmente realizada',
        macros: {
          protein_g: Math.round((plannedMacros.protein_g || 0) * 0.5),
          carbs_g: Math.round((plannedMacros.carbs_g || 0) * 0.5),
          fat_g: Math.round((plannedMacros.fat_g || 0) * 0.5),
          calories: Math.round((plannedMacros.calories || 0) * 0.5),
        },
        completed: true,
      });
    } else {
      // Red = not done, 0 macros
      await saveMeal(meal.meal_name, {
        planned_description: planned,
        completed: false,
        flag: 'red',
        feedback: 'Refeição não realizada',
        macros: { protein_g: 0, carbs_g: 0, fat_g: 0, calories: 0 },
      });
    }
    setExpandedMeal(null);
    setShowDescribe(null);
    await loadToday();
  }

  function toggleMealRecording() {
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Navegador não suporta reconhecimento de voz.'); return; }
    const recognition = new SR();
    recognition.lang = 'pt-BR'; recognition.interimResults = true; recognition.continuous = true;
    let final = mealDescription;
    recognition.onresult = (e: any) => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) final += (final ? ' ' : '') + e.results[i][0].transcript; else interim = e.results[i][0].transcript; } setMealDescription(final + (interim ? ' ' + interim : '')); };
    recognition.onend = () => setIsRecording(false); recognition.onerror = () => setIsRecording(false);
    recognitionRef.current = recognition; recognition.start(); setIsRecording(true);
  }

  async function markExercise(done: boolean, actualType?: string) {
    const { data: existing } = await supabase.from('exercises').select('id').eq('plan_id', plan.id).eq('date', today).limit(1);
    const data = { planned_type: todayExercise?.planned_type, actual_type: actualType || todayExercise?.planned_type, done, has_gym_access: true };
    if (existing && existing.length > 0) { await supabase.from('exercises').update(data).eq('id', existing[0].id); }
    else { await supabase.from('exercises').insert({ plan_id: plan.id, date: today, ...data }); }
    setShowOtherExercise(false); setOtherExerciseText('');
    await loadToday();
  }

  async function saveCheckin(field: string, value: any) {
    const { data: existing } = await supabase.from('daily_checkins').select('id').eq('plan_id', plan.id).eq('date', today).limit(1);
    if (existing && existing.length > 0) { await supabase.from('daily_checkins').update({ [field]: value }).eq('id', existing[0].id); setCheckin((p: any) => ({ ...p, [field]: value })); }
    else { const { data: ins } = await supabase.from('daily_checkins').insert({ plan_id: plan.id, date: today, [field]: value }).select().single(); setCheckin(ins); }
  }

  async function closeDay() {
    setClosingDay(true);
    const pending = todayMeals.filter(m => !m.flag && m.completed !== false);
    for (const meal of pending) { await saveMeal(meal.meal_name, { planned_description: meal.planned_description || '', completed: false, flag: 'red', feedback: 'Dia encerrado', macros: { protein_g: 0, carbs_g: 0, fat_g: 0, calories: 0 } }); }
    if (todayExercise && !todayExercise.done && !todayExercise.id) { await supabase.from('exercises').insert({ plan_id: plan.id, date: today, planned_type: todayExercise.planned_type, done: false }); }
    const { data: ex } = await supabase.from('daily_checkins').select('id').eq('plan_id', plan.id).eq('date', today).limit(1);
    if (ex && ex.length > 0) await supabase.from('daily_checkins').update({ day_closed: true }).eq('id', ex[0].id);
    else await supabase.from('daily_checkins').insert({ plan_id: plan.id, date: today, day_closed: true });
    setShowCloseDay(false); setClosingDay(false);
    await loadToday();
  }

  const completedMeals = todayMeals.filter(m => m.completed === true || (m.flag && m.completed !== false));
  const pendingMeals = todayMeals.filter(m => !m.flag && m.completed !== false && m.completed !== true);
  const registeredCount = completedMeals.length;
  const totalMacros = completedMeals.reduce((acc, m) => { if (m.macros) { acc.protein += m.macros.protein_g || 0; acc.carbs += m.macros.carbs_g || 0; acc.fat += m.macros.fat_g || 0; acc.calories += m.macros.calories || 0; } return acc; }, { protein: 0, carbs: 0, fat: 0, calories: 0 });
  const dayScore = todayMeals.length > 0 ? Math.round(registeredCount / todayMeals.length * 100) : 0;

  const flagColor: Record<string, string> = { green: 'bg-green-400', yellow: 'bg-amber-400', red: 'bg-red-400' };
  const flagBg: Record<string, string> = { green: 'bg-green-50', yellow: 'bg-amber-50', red: 'bg-red-50' };
  const flagText: Record<string, string> = { green: 'text-green-800', yellow: 'text-amber-800', red: 'text-red-800' };
  const flagLabel: Record<string, string> = { green: 'Verde — perfeito!', yellow: 'Amarelo — quase lá!', red: 'Vermelho — fora do plano' };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-lg font-medium">Olá!</p>
          <p className="text-xs text-gray-400">{dayLabel}, {todayDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="bg-teal-50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
          <span className="text-lg font-medium text-teal-800">{dayScore}</span>
          <span className="text-xs text-teal-600">score</span>
        </div>
      </div>

      {/* Close day modal */}
      {showCloseDay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCloseDay(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-medium mb-4 text-center">Encerrar o dia?</h3>
            {pendingMeals.length > 0 && <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3 mb-3">{pendingMeals.length} refeição(ões) sem registro serão marcadas como não realizadas</p>}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-3"><span className="text-sm text-gray-600">Score</span><span className="text-sm font-medium text-teal-700">{dayScore}%</span></div>
            <div className="flex gap-2">
              <button onClick={closeDay} disabled={closingDay} className="flex-1 py-3 bg-teal-400 text-white rounded-xl text-sm font-medium disabled:opacity-50">{closingDay ? 'Encerrando...' : 'Encerrar'}</button>
              <button onClick={() => setShowCloseDay(false)} className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-sm">Voltar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.stopPropagation()}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-medium mb-3">Confirmar {confirmData.mealName}</h3>
            <p className="text-sm bg-gray-50 rounded-xl p-3 mb-3 italic">&ldquo;{confirmData.description}&rdquo;</p>
            <div className="mb-3">{(confirmData.analysis.identified_foods || []).map((f: string, i: number) => <span key={i} className="inline-block text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded-full mr-1 mb-1">{f}</span>)}</div>
            <div className={`rounded-xl p-3 mb-3 ${flagBg[confirmData.analysis.flag] || 'bg-gray-50'}`}>
              <p className={`text-sm font-medium ${flagText[confirmData.analysis.flag] || ''}`}>{flagLabel[confirmData.analysis.flag] || ''}</p>
              <p className="text-xs text-gray-600 mt-1">{confirmData.analysis.feedback}</p>
            </div>
            <div className="grid grid-cols-4 gap-1 mb-4">
              {[{ l: 'Prot', v: confirmData.analysis.estimated_macros?.protein_g || 0 }, { l: 'Carb', v: confirmData.analysis.estimated_macros?.carbs_g || 0 }, { l: 'Gord', v: confirmData.analysis.estimated_macros?.fat_g || 0 }, { l: 'Kcal', v: confirmData.analysis.estimated_macros?.calories || 0 }].map(m => (
                <div key={m.l} className="bg-gray-50 rounded-lg p-2 text-center"><p className="text-sm font-medium">{Math.round(m.v)}</p><p className="text-[10px] text-gray-400">{m.l}</p></div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={confirmMealAnalysis} disabled={saving} className="flex-1 py-3 bg-teal-400 text-white rounded-xl text-sm font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Confirmar'}</button>
              <button onClick={() => setConfirmData(null)} className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-sm">Corrigir</button>
            </div>
          </div>
        </div>
      )}

      {/* Meals */}
      <div className="flex items-center justify-between mt-2 mb-2">
        <span className="text-sm font-medium">Cardápio de hoje</span>
        <span className="text-xs text-gray-400">{registeredCount} de {todayMeals.length}</span>
      </div>

      {todayMeals.map((meal, i) => {
        const isCompleted = meal.completed === true || (meal.flag && meal.completed !== false);
        const isSkipped = meal.completed === false;
        return (
          <div key={i} className="mb-2">
            <div onClick={() => { if (!confirmData) { setExpandedMeal(expandedMeal === meal.meal_name ? null : meal.meal_name); setMealDescription(''); setShowDescribe(null); } }} className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl cursor-pointer">
              <div className={`w-2.5 h-2.5 rounded-full ${meal.flag ? flagColor[meal.flag] : 'bg-gray-200'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{meal.meal_name}</p>
                <p className="text-xs text-gray-400 truncate">{meal.actual_description || meal.planned_description}</p>
              </div>
              {isCompleted ? <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#639922" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg></div>
              : isSkipped ? <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg></div>
              : <div className="w-6 h-6 rounded-full border border-gray-200" />}
            </div>
            {expandedMeal === meal.meal_name && !confirmData && !isCompleted && !isSkipped && (
              <div className="p-3 rounded-xl mt-1 bg-gray-50">
                <p className="text-xs text-gray-500 mb-3">📋 {meal.planned_description}</p>

                {/* Quick action buttons */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button onClick={() => quickRegister(meal, 'green')} className="py-3 bg-green-100 text-green-800 rounded-xl text-xs font-medium active:bg-green-200 touch-manipulation">
                    <span className="block text-lg mb-0.5">✅</span>
                    Fiz como planejado
                  </button>
                  <button onClick={() => quickRegister(meal, 'yellow')} className="py-3 bg-amber-100 text-amber-800 rounded-xl text-xs font-medium active:bg-amber-200 touch-manipulation">
                    <span className="block text-lg mb-0.5">🟡</span>
                    Quase lá
                  </button>
                  <button onClick={() => quickRegister(meal, 'red')} className="py-3 bg-red-100 text-red-800 rounded-xl text-xs font-medium active:bg-red-200 touch-manipulation">
                    <span className="block text-lg mb-0.5">❌</span>
                    Não fiz
                  </button>
                </div>

                {/* Optional: describe what you actually ate */}
                {!showDescribe && (
                  <button onClick={() => setShowDescribe(meal.meal_name)} className="w-full py-2 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                    Ou descrever o que comi...
                  </button>
                )}

                {showDescribe === meal.meal_name && (
                  <div className="mt-2">
                    <div className="flex gap-2 mb-2">
                      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { if (e.target.files?.[0]) handlePhotoUpload(meal.meal_name, e.target.files[0]); }} />
                      <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-[10px] text-gray-500 disabled:opacity-50">
                        📷 {uploading ? '...' : meal.photo_url ? '✓' : 'Foto'}
                      </button>
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                      <button onClick={toggleMealRecording} className={`p-2 rounded-full shrink-0 ${isRecording ? 'bg-red-400 text-white animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
                        {isRecording ? '⏹' : '🎤'}
                      </button>
                      <textarea value={mealDescription} onChange={e => setMealDescription(e.target.value)} placeholder="O que você comeu?" className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 resize-none" rows={2} />
                    </div>
                    <button onClick={() => analyzeMealDescription(meal.meal_name)} disabled={!mealDescription.trim() || analyzing} className="w-full py-2.5 bg-teal-400 text-white rounded-xl text-xs font-medium disabled:opacity-50">
                      {analyzing ? 'Analisando...' : 'Analisar e registrar'}
                    </button>
                  </div>
                )}
              </div>
            )}
            {expandedMeal === meal.meal_name && (isCompleted || isSkipped) && (
              <div className={`p-3 rounded-xl mt-1 ${isCompleted ? (flagBg[meal.flag] || 'bg-green-50') : 'bg-red-50'}`}>
                <p className={`text-sm font-medium ${isCompleted ? (flagText[meal.flag] || '') : 'text-red-700'}`}>{isCompleted ? (flagLabel[meal.flag] || '') : 'Não realizada'}</p>
                {meal.feedback && <p className="text-xs text-gray-600 mt-1">{meal.feedback}</p>}
                {meal.photo_url && <img src={meal.photo_url} className="w-full h-32 object-cover rounded-lg mt-2" alt="" />}
                {isCompleted && meal.planned_description && (
                  <button onClick={async (e) => {
                    e.stopPropagation();
                    await supabase.from('favorite_meals').insert({
                      plan_id: plan.id,
                      meal_name: meal.meal_name,
                      description: meal.actual_description || meal.planned_description,
                      macros: meal.macros || {},
                      source_date: today,
                    });
                    alert('Refeição favoritada! ⭐');
                  }} className="mt-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg font-medium">
                    ⭐ Favoritar esta refeição
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Macros */}
      <p className="text-sm font-medium mt-4 mb-2">Macros de hoje</p>
      {[{ label: 'Proteína', current: Math.round(totalMacros.protein), target: plan.meal_plan_base?.protein_g || 150, color: 'bg-teal-400' }, { label: 'Carbo', current: Math.round(totalMacros.carbs), target: plan.meal_plan_base?.carbs_g || 250, color: 'bg-amber-400' }, { label: 'Gordura', current: Math.round(totalMacros.fat), target: plan.meal_plan_base?.fat_g || 70, color: 'bg-orange-400' }, { label: 'Calorias', current: Math.round(totalMacros.calories), target: plan.meal_plan_base?.calories || 2000, color: 'bg-gray-400' }].map(m => (
        <div key={m.label} className="flex items-center gap-1.5 mb-2">
          <span className="text-xs text-gray-400 w-12">{m.label}</span>
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${m.color} rounded-full transition-all duration-500`} style={{ width: `${Math.min((m.current / m.target) * 100, 100)}%` }} /></div>
          <span className="text-xs text-gray-400 w-16 text-right"><b className="text-gray-700">{m.current}</b>/{m.target}{m.label === 'Calorias' ? '' : 'g'}</span>
        </div>
      ))}

      {/* Exercise */}
      {todayExercise && (
        <>
          <p className="text-sm font-medium mt-4 mb-2">Exercício</p>
          <div className={`p-3 rounded-xl border border-gray-100 ${todayExercise.done ? 'bg-green-50' : ''}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${todayExercise.done ? 'bg-green-400' : 'bg-blue-50'}`}>💪</div>
              <div className="flex-1"><p className="text-sm font-medium">{todayExercise.actual_type || todayExercise.planned_type}</p><p className="text-xs text-gray-400">{todayExercise.done ? 'Concluído' : todayExercise.description || 'Previsto'}</p></div>
              {!todayExercise.done && (
                <div className="flex gap-1.5">
                  <button onClick={() => markExercise(true)} className="text-xs px-3 py-1.5 rounded-full bg-teal-400 text-white font-medium">Feito</button>
                  <button onClick={() => setShowOtherExercise(!showOtherExercise)} className="text-xs px-2 py-1.5 rounded-full border border-gray-200 text-blue-500">Outra</button>
                </div>
              )}
            </div>
            {showOtherExercise && !todayExercise.done && (
              <div className="mt-3 flex gap-2">
                <input type="text" value={otherExerciseText} onChange={e => setOtherExerciseText(e.target.value)} placeholder="O que fez?" className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm" onKeyDown={e => { if (e.key === 'Enter' && otherExerciseText.trim()) markExercise(true, otherExerciseText); }} autoFocus />
                <button onClick={() => { if (otherExerciseText.trim()) markExercise(true, otherExerciseText); }} disabled={!otherExerciseText.trim()} className="px-4 py-2 bg-teal-400 text-white rounded-xl text-sm font-medium disabled:opacity-50">OK</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Check-in */}
      <p className="text-sm font-medium mt-4 mb-2">Check-in rápido</p>
      <div className="grid grid-cols-4 gap-2">
        {[{ field: 'sleep_hours', label: 'Sono', options: [4,5,6,7,8,9,10].map(h => ({ v: h, l: `${h}h` })) },
          { field: 'energy_level', label: 'Energia', options: [1,2,3,4,5,6,7,8,9,10].map(l => ({ v: l, l: `${l}/10` })) },
          { field: 'digestion', label: 'Digestão', options: [{ v: 'boa', l: 'Boa' }, { v: 'regular', l: 'Regular' }, { v: 'ruim', l: 'Ruim' }] },
          { field: 'water_glasses', label: 'Água', options: [1,2,3,4,5,6,7,8,9,10,11,12].map(g => ({ v: g, l: String(g) })) },
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

      {/* Close day button */}
      {todayMeals.length > 0 && !checkin?.day_closed && (
        <button onClick={() => setShowCloseDay(true)} className="w-full mt-6 py-4 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500 font-medium hover:border-teal-300 hover:text-teal-600 transition-colors">Encerrar o dia</button>
      )}
    </div>
  );
}
