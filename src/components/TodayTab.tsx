'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday, getDayKey as getDayKeyUtil, getNextDay as getNextDayUtil, toLocalDateStr } from '@/lib/dates';

export default function TodayTab({ plan, weeklyPlan }: { plan: any; weeklyPlan: any }) {
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
  const [dayClosed, setDayClosed] = useState(false);
  const [viewingDate, setViewingDate] = useState<string>(getLocalToday());
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const realToday = getLocalToday();
  const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const dayLabels: Record<string, string> = { domingo: 'Domingo', segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado' };

  // Get day key for a given date string
  function getDayKey(dateStr: string) {
    return getDayKeyUtil(dateStr);
  }

  // Get next day date string
  function getNextDay(dateStr: string) {
    return getNextDayUtil(dateStr);
  }

  // Check if a date is within the weekly plan range
  function isDateInWeek(dateStr: string) {
    if (!weeklyPlan?.day_dates) return false;
    const dates = Object.values(weeklyPlan.day_dates) as string[];
    return dates.includes(dateStr);
  }

  const today = viewingDate;
  const dayKey = getDayKey(today);
  const isViewingToday = today === realToday;
  const isViewingFuture = today > realToday;

  useEffect(() => { checkAndLoadDay(); }, []);

  async function checkAndLoadDay() {
    // Check if today is already closed, if so show next day
    const { data: ci } = await supabase.from('daily_checkins').select('*').eq('plan_id', plan.id).eq('date', realToday).limit(1);
    if (ci && ci.length > 0 && ci[0].day_closed) {
      const nextDay = getNextDay(realToday);
      if (isDateInWeek(nextDay)) {
        setViewingDate(nextDay);
        setDayClosed(true);
        loadDay(nextDay);
      } else {
        // Next day is outside the week — stay on today showing closed state
        setDayClosed(true);
        loadDay(realToday);
      }
    } else {
      loadDay(realToday);
    }
  }

  async function loadDay(dateStr: string) {
    const dk = getDayKey(dateStr);
    const { data: meals } = await supabase.from('meals').select('*').eq('plan_id', plan.id).eq('date', dateStr);
    const { data: exercise } = await supabase.from('exercises').select('*').eq('plan_id', plan.id).eq('date', dateStr).limit(1);
    const { data: ci } = await supabase.from('daily_checkins').select('*').eq('plan_id', plan.id).eq('date', dateStr).limit(1);

    const plannedMeals = weeklyPlan?.meal_plan_detailed?.[dk] || [];
    const mealList = plannedMeals.map((pm: any) => {
      const existing = meals?.find(m => m.meal_name === pm.meal);
      return existing || { meal_name: pm.meal, planned_description: pm.description, macros: null, date: dateStr, plan_id: plan.id, location: pm.location };
    });
    setTodayMeals(mealList);

    const plannedEx = weeklyPlan?.exercise_plan_detailed?.[dk];
    if (exercise && exercise.length > 0) {
      setTodayExercise(exercise[0]);
    } else if (plannedEx) {
      setTodayExercise({ planned_type: plannedEx.type, description: plannedEx.description, done: false, date: dateStr });
    } else {
      setTodayExercise(null);
    }

    setCheckin(ci && ci.length > 0 ? ci[0] : null);
  }

  async function loadToday() {
    await loadDay(today);
  }

  // Save or update a meal record
  async function saveMeal(mealName: string, data: any) {
    const { data: existing } = await supabase
      .from('meals')
      .select('id')
      .eq('plan_id', plan.id)
      .eq('date', today)
      .eq('meal_name', mealName)
      .limit(1);

    if (existing && existing.length > 0) {
      const { error } = await supabase.from('meals').update(data).eq('id', existing[0].id);
      if (error) console.error('Error updating meal:', error);
    } else {
      const { error } = await supabase.from('meals').insert({
        plan_id: plan.id,
        weekly_plan_id: weeklyPlan?.id,
        date: today,
        meal_name: mealName,
        ...data,
      });
      if (error) console.error('Error inserting meal:', error);
    }
  }

  // Photo upload — just for record
  async function handlePhotoUpload(mealName: string, file: File) {
    setUploading(true);
    const fileName = `${plan.id}/${today}/${mealName.replace(/\s/g, '_')}_${Date.now()}.jpg`;
    await supabase.storage.from('meal-photos').upload(fileName, file);
    const { data: urlData } = supabase.storage.from('meal-photos').getPublicUrl(fileName);
    const planned = todayMeals.find(m => m.meal_name === mealName);
    await saveMeal(mealName, { planned_description: planned?.planned_description || '', photo_url: urlData.publicUrl });
    setUploading(false);
    await loadToday();
  }

  // Send meal description for AI analysis
  async function analyzeMealDescription(mealName: string) {
    if (!mealDescription.trim()) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: mealDescription,
          mealName,
          plannedDescription: todayMeals.find(m => m.meal_name === mealName)?.planned_description || '',
          mealPlanContext: plan.meal_plan_base,
        }),
      });
      const analysis = await res.json();
      setConfirmData({ mealName, analysis, description: mealDescription });
    } catch (err) {
      console.error('Analysis error:', err);
      alert('Erro ao analisar. Tente novamente.');
    }
    setAnalyzing(false);
  }

  // Confirm the AI analysis and save
  async function confirmMealAnalysis() {
    if (!confirmData || saving) return;
    setSaving(true);
    const { mealName, analysis, description } = confirmData;
    const existing = todayMeals.find(m => m.meal_name === mealName);
    await saveMeal(mealName, {
      planned_description: existing?.planned_description || '',
      photo_url: existing?.photo_url || null,
      actual_description: description,
      ai_analysis: analysis,
      flag: analysis.flag,
      feedback: analysis.feedback,
      macros: analysis.estimated_macros,
      completed: true,
    });
    setConfirmData(null);
    setMealDescription('');
    setExpandedMeal(null);
    setSaving(false);
    await loadToday();
  }

  // Mark meal as not done
  async function skipMeal(mealName: string) {
    const planned = todayMeals.find(m => m.meal_name === mealName);
    await saveMeal(mealName, {
      planned_description: planned?.planned_description || '',
      completed: false,
      flag: 'red',
      feedback: 'Refeição não realizada',
      macros: { protein_g: 0, carbs_g: 0, fat_g: 0, calories: 0 },
    });
    setExpandedMeal(null);
    await loadToday();
  }

  // Audio recording for meal description
  function toggleMealRecording() {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Navegador não suporta reconhecimento de voz.'); return; }
    const recognition = new SR();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = true;
    let final = mealDescription;
    recognition.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += (final ? ' ' : '') + e.results[i][0].transcript;
        else interim = e.results[i][0].transcript;
      }
      setMealDescription(final + (interim ? ' ' + interim : ''));
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }

  // Save or update exercise
  async function markExercise(done: boolean, actualType?: string) {
    const { data: existing } = await supabase.from('exercises').select('id').eq('plan_id', plan.id).eq('date', today).limit(1);
    const exerciseData = {
      planned_type: todayExercise?.planned_type,
      actual_type: actualType || todayExercise?.planned_type,
      done,
      has_gym_access: weeklyPlan?.routine?.[dayKey]?.gym ?? true,
    };
    if (existing && existing.length > 0) {
      await supabase.from('exercises').update(exerciseData).eq('id', existing[0].id);
    } else {
      await supabase.from('exercises').insert({ plan_id: plan.id, weekly_plan_id: weeklyPlan?.id, date: today, ...exerciseData });
    }
    setShowOtherExercise(false);
    setOtherExerciseText('');
    await loadToday();
  }

  async function saveCheckin(field: string, value: any) {
    const { data: existing } = await supabase.from('daily_checkins').select('id').eq('plan_id', plan.id).eq('date', today).limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('daily_checkins').update({ [field]: value }).eq('id', existing[0].id);
      setCheckin((prev: any) => ({ ...prev, [field]: value }));
    } else {
      const newCheckin = { plan_id: plan.id, date: today, [field]: value };
      const { data: inserted } = await supabase.from('daily_checkins').insert(newCheckin).select().single();
      setCheckin(inserted);
    }
  }

  // ========== CLOSE DAY LOGIC ==========

  const completedMeals = todayMeals.filter(m => m.completed === true || (m.flag && m.completed !== false));
  const skippedMeals = todayMeals.filter(m => m.completed === false);
  const pendingMeals = todayMeals.filter(m => !m.flag && m.completed !== false && m.completed !== true);
  const registeredCount = completedMeals.length;

  const totalMacros = completedMeals.reduce((acc, m) => {
    if (m.macros) {
      acc.protein += m.macros.protein_g || 0;
      acc.carbs += m.macros.carbs_g || 0;
      acc.fat += m.macros.fat_g || 0;
      acc.calories += m.macros.calories || 0;
    }
    return acc;
  }, { protein: 0, carbs: 0, fat: 0, calories: 0 });

  const dayScore = todayMeals.length > 0 ? Math.round(registeredCount / todayMeals.length * 100) : 0;

  async function closeDay() {
    setClosingDay(true);

    // Mark all pending meals as skipped
    for (const meal of pendingMeals) {
      await saveMeal(meal.meal_name, {
        planned_description: meal.planned_description || '',
        completed: false,
        flag: 'red',
        feedback: 'Refeição não registrada — dia encerrado',
        macros: { protein_g: 0, carbs_g: 0, fat_g: 0, calories: 0 },
      });
    }

    // Mark exercise as not done if pending
    if (todayExercise && !todayExercise.done && !todayExercise.id) {
      await supabase.from('exercises').insert({
        plan_id: plan.id,
        weekly_plan_id: weeklyPlan?.id,
        date: today,
        planned_type: todayExercise.planned_type,
        done: false,
      });
    }

    // Save day_closed in checkin
    const { data: existing } = await supabase.from('daily_checkins').select('id').eq('plan_id', plan.id).eq('date', today).limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('daily_checkins').update({ day_closed: true }).eq('id', existing[0].id);
    } else {
      await supabase.from('daily_checkins').insert({ plan_id: plan.id, date: today, day_closed: true });
    }

    // Move to next day
    const nextDay = getNextDay(today);
    if (isDateInWeek(nextDay)) {
      setViewingDate(nextDay);
      setDayClosed(false);
      setShowCloseDay(false);
      setClosingDay(false);
      await loadDay(nextDay);
    } else {
      // End of week
      setDayClosed(true);
      setShowCloseDay(false);
      setClosingDay(false);
      await loadDay(today);
    }
  }

  // ========== UI ==========

  const flagColor: Record<string, string> = { green: 'bg-green-400', yellow: 'bg-amber-400', red: 'bg-red-400' };
  const flagBg: Record<string, string> = { green: 'bg-green-50', yellow: 'bg-amber-50', red: 'bg-red-50' };
  const flagText: Record<string, string> = { green: 'text-green-800', yellow: 'text-amber-800', red: 'text-red-800' };
  const flagLabel: Record<string, string> = { green: 'Verde — perfeito!', yellow: 'Amarelo — quase lá!', red: 'Vermelho — fora do plano' };

  const viewDate = new Date(today + 'T12:00:00');
  const viewDayLabel = dayLabels[dayKey];
  const viewDateFormatted = viewDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-lg font-medium">{isViewingToday ? 'Olá!' : isViewingFuture ? 'Amanhã' : viewDayLabel}</p>
          <p className="text-xs text-gray-400">{viewDayLabel}, {viewDateFormatted}</p>
          {!isViewingToday && (
            <button onClick={() => { setViewingDate(realToday); loadDay(realToday); setDayClosed(false); }} className="text-[10px] text-teal-500 mt-0.5">← voltar para hoje</button>
          )}
        </div>
        <div className="bg-teal-50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
          <span className="text-lg font-medium text-teal-800">{dayScore}</span>
          <span className="text-xs text-teal-600">score</span>
        </div>
      </div>

      {/* Day closed banner */}
      {dayClosed && isViewingToday && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-4 text-center">
          <p className="text-sm text-teal-800 font-medium">Dia encerrado! ✓</p>
          <p className="text-xs text-teal-600 mt-1">Bom descanso. Amanhã tem mais.</p>
        </div>
      )}

      {/* End of week notice */}
      {dayClosed && !isViewingToday && today > realToday && !isDateInWeek(getNextDay(today)) && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-4 text-center">
          <p className="text-sm text-purple-800 font-medium">Fim da semana!</p>
          <p className="text-xs text-purple-600 mt-1">No domingo será gerado o planejamento da próxima semana.</p>
        </div>
      )}

      {/* CLOSE DAY MODAL */}
      {showCloseDay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCloseDay(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-medium mb-4 text-center">Encerrar o dia?</h3>
            
            {/* Summary */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                <span className="text-sm text-gray-600">Refeições registradas</span>
                <span className="text-sm font-medium">{registeredCount} de {todayMeals.length}</span>
              </div>
              {completedMeals.length > 0 && (
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-xs text-green-700 font-medium mb-1">Realizadas ({completedMeals.length})</p>
                  {completedMeals.map((m, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${flagColor[m.flag] || 'bg-green-400'}`} />
                      <span className="text-xs text-green-800">{m.meal_name}</span>
                    </div>
                  ))}
                </div>
              )}
              {skippedMeals.length > 0 && (
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-xs text-red-700 font-medium mb-1">Não realizadas ({skippedMeals.length})</p>
                  {skippedMeals.map((m, i) => (
                    <span key={i} className="text-xs text-red-600">{m.meal_name}{i < skippedMeals.length - 1 ? ', ' : ''}</span>
                  ))}
                </div>
              )}
              {pendingMeals.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-3">
                  <p className="text-xs text-amber-700 font-medium mb-1">Sem registro ({pendingMeals.length}) — serão marcadas como não realizadas</p>
                  {pendingMeals.map((m, i) => (
                    <span key={i} className="text-xs text-amber-600">{m.meal_name}{i < pendingMeals.length - 1 ? ', ' : ''}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                <span className="text-sm text-gray-600">Exercício</span>
                <span className="text-sm font-medium">{todayExercise?.done ? '✓ Feito' : todayExercise ? 'Não feito' : 'Descanso'}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                <span className="text-sm text-gray-600">Score do dia</span>
                <span className="text-sm font-medium text-teal-700">{dayScore}%</span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-medium mb-1">Macros consumidos</p>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>P: {Math.round(totalMacros.protein)}g</span>
                  <span>C: {Math.round(totalMacros.carbs)}g</span>
                  <span>G: {Math.round(totalMacros.fat)}g</span>
                  <span>{Math.round(totalMacros.calories)} kcal</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={closeDay} disabled={closingDay} className="flex-1 py-3 bg-teal-400 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {closingDay ? 'Encerrando...' : 'Encerrar dia'}
              </button>
              <button onClick={() => setShowCloseDay(false)} className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-sm">Voltar</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.stopPropagation()}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-medium mb-3">Confirmar {confirmData.mealName}</h3>
            <p className="text-sm text-gray-600 mb-2">Você descreveu:</p>
            <p className="text-sm bg-gray-50 rounded-xl p-3 mb-3 italic">&ldquo;{confirmData.description}&rdquo;</p>
            <p className="text-sm text-gray-600 mb-2">Eu entendi que você comeu:</p>
            <div className="space-y-1 mb-3">
              {(confirmData.analysis.identified_foods || []).map((f: string, i: number) => (
                <span key={i} className="inline-block text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded-full mr-1 mb-1">{f}</span>
              ))}
            </div>
            <div className={`rounded-xl p-3 mb-3 ${flagBg[confirmData.analysis.flag] || 'bg-gray-50'}`}>
              <p className={`text-sm font-medium ${flagText[confirmData.analysis.flag] || ''}`}>{flagLabel[confirmData.analysis.flag] || confirmData.analysis.flag}</p>
              <p className="text-xs text-gray-600 mt-1">{confirmData.analysis.feedback}</p>
            </div>
            <div className="grid grid-cols-4 gap-1 mb-4">
              {[
                { l: 'Prot', v: confirmData.analysis.estimated_macros?.protein_g || 0 },
                { l: 'Carb', v: confirmData.analysis.estimated_macros?.carbs_g || 0 },
                { l: 'Gord', v: confirmData.analysis.estimated_macros?.fat_g || 0 },
                { l: 'Kcal', v: confirmData.analysis.estimated_macros?.calories || 0 },
              ].map(m => (
                <div key={m.l} className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-sm font-medium">{Math.round(m.v)}</p>
                  <p className="text-[10px] text-gray-400">{m.l}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={confirmMealAnalysis} disabled={saving} className="flex-1 py-3 bg-teal-400 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Salvando...' : 'Confirmar'}
              </button>
              <button onClick={() => { setConfirmData(null); }} className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-sm">Corrigir</button>
            </div>
          </div>
        </div>
      )}

      {/* Meals */}
      <div className="flex items-center justify-between mt-4 mb-2">
        <span className="text-sm font-medium">Cardápio de {isViewingToday ? 'hoje' : viewDayLabel.toLowerCase()}</span>
        <span className="text-xs text-gray-400">{registeredCount} de {todayMeals.length}</span>
      </div>

      {todayMeals.map((meal, i) => {
        const isCompleted = meal.completed === true || (meal.flag && meal.completed !== false);
        const isSkipped = meal.completed === false;
        const canEdit = !isViewingFuture && !(checkin?.day_closed);
        
        return (
          <div key={i} className="mb-2">
            <div onClick={() => { if (!confirmData && canEdit) { setExpandedMeal(expandedMeal === meal.meal_name ? null : meal.meal_name); setMealDescription(''); } }} className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl cursor-pointer">
              <div className={`w-2.5 h-2.5 rounded-full ${meal.flag ? flagColor[meal.flag] : 'bg-gray-200'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium">{meal.meal_name}</p>
                  {meal.location === 'livre' && <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">livre</span>}
                </div>
                <p className="text-xs text-gray-400 truncate">{meal.actual_description || meal.planned_description}</p>
              </div>
              {isCompleted ? (
                <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#639922" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
                </div>
              ) : isSkipped ? (
                <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border border-gray-200" />
              )}
            </div>

            {expandedMeal === meal.meal_name && !confirmData && canEdit && (
              <div className={`p-3 rounded-xl mt-1 ${isCompleted ? (flagBg[meal.flag] || 'bg-green-50') : 'bg-gray-50'}`}>
                {isCompleted ? (
                  <div>
                    <p className={`text-sm font-medium ${flagText[meal.flag] || ''}`}>{flagLabel[meal.flag] || ''}</p>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">{meal.feedback}</p>
                    {meal.actual_description && <p className="text-xs text-gray-500 mt-1 italic">Descrito: &ldquo;{meal.actual_description}&rdquo;</p>}
                    {meal.photo_url && <img src={meal.photo_url} className="w-full h-32 object-cover rounded-lg mt-2" alt="" />}
                  </div>
                ) : isSkipped ? (
                  <div>
                    <p className="text-sm font-medium text-red-700">Refeição não realizada</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium mb-1">Registrar {meal.meal_name.toLowerCase()}</p>
                    <p className="text-xs text-gray-500 mb-3">Plano: {meal.planned_description}</p>
                    
                    {/* Photo — just for record */}
                    <div className="flex gap-2 mb-3">
                      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                        if (e.target.files?.[0]) handlePhotoUpload(meal.meal_name, e.target.files[0]);
                      }} />
                      <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 disabled:opacity-50">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        {uploading ? 'Salvando...' : meal.photo_url ? '✓ Foto salva' : 'Tirar foto'}
                      </button>
                      {meal.photo_url && <img src={meal.photo_url} className="w-10 h-10 rounded-lg object-cover" alt="" />}
                    </div>

                    {/* Description input (text or audio) */}
                    <div className="flex items-end gap-2 mb-3">
                      <button
                        onClick={toggleMealRecording}
                        className={`p-2 rounded-full shrink-0 ${isRecording ? 'bg-red-400 text-white animate-pulse' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {isRecording ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          </svg>
                        )}
                      </button>
                      <textarea
                        value={mealDescription}
                        onChange={e => setMealDescription(e.target.value)}
                        placeholder="Descreva o que comeu..."
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 resize-none"
                        rows={2}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => analyzeMealDescription(meal.meal_name)} 
                        disabled={!mealDescription.trim() || analyzing}
                        className="flex-1 py-3 bg-teal-400 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                      >
                        {analyzing ? 'Analisando...' : 'Realizada ✓'}
                      </button>
                      <button 
                        onClick={() => skipMeal(meal.meal_name)}
                        className="px-4 py-3 border border-red-200 text-red-500 rounded-xl text-sm"
                      >
                        Não fiz
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Macros — start at zero, accumulate from completed meals */}
      <p className="text-sm font-medium mt-4 mb-2">Macros {isViewingToday ? 'de hoje' : ''}</p>
      {[
        { label: 'Proteína', current: Math.round(totalMacros.protein), target: plan.meal_plan_base?.protein_g || 150, color: 'bg-teal-400' },
        { label: 'Carbo', current: Math.round(totalMacros.carbs), target: plan.meal_plan_base?.carbs_g || 250, color: 'bg-amber-400' },
        { label: 'Gordura', current: Math.round(totalMacros.fat), target: plan.meal_plan_base?.fat_g || 70, color: 'bg-orange-400' },
        { label: 'Calorias', current: Math.round(totalMacros.calories), target: plan.meal_plan_base?.calories || 2000, color: 'bg-gray-400' },
      ].map(m => (
        <div key={m.label} className="flex items-center gap-1.5 mb-2">
          <span className="text-xs text-gray-400 w-12">{m.label}</span>
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${m.color} rounded-full transition-all duration-500`} style={{ width: `${Math.min((m.current / m.target) * 100, 100)}%` }} />
          </div>
          <span className="text-xs text-gray-400 w-16 text-right"><b className="text-gray-700">{m.current}</b>/{m.target}{m.label === 'Calorias' ? '' : 'g'}</span>
        </div>
      ))}

      {/* Exercise */}
      {todayExercise && (
        <>
          <p className="text-sm font-medium mt-4 mb-2">Exercício</p>
          <div className={`p-3 rounded-xl border border-gray-100 ${todayExercise.done ? 'bg-green-50' : ''}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${todayExercise.done ? 'bg-green-400' : 'bg-blue-50'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={todayExercise.done ? '#fff' : '#378ADD'} strokeWidth="2" strokeLinecap="round"><path d="M6 5v14M18 5v14M6 12h12" /></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{todayExercise.actual_type || todayExercise.planned_type}</p>
                <p className="text-xs text-gray-400">{todayExercise.done ? 'Concluído' : todayExercise.description || 'Previsto'}</p>
              </div>
              {!todayExercise.done && !isViewingFuture && (
                <div className="flex gap-1.5">
                  <button onClick={() => markExercise(true)} className="text-xs px-3 py-1.5 rounded-full bg-teal-400 text-white font-medium">Feito</button>
                  <button onClick={() => setShowOtherExercise(!showOtherExercise)} className="text-xs px-2 py-1.5 rounded-full border border-gray-200 text-blue-500">Outra</button>
                </div>
              )}
            </div>
            {showOtherExercise && !todayExercise.done && (
              <div className="mt-3 flex gap-2">
                <input type="text" value={otherExerciseText} onChange={e => setOtherExerciseText(e.target.value)} placeholder="O que você fez? Ex: corrida, yoga..." className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" onKeyDown={e => { if (e.key === 'Enter' && otherExerciseText.trim()) markExercise(true, otherExerciseText); }} autoFocus />
                <button onClick={() => { if (otherExerciseText.trim()) markExercise(true, otherExerciseText); }} disabled={!otherExerciseText.trim()} className="px-4 py-2 bg-teal-400 text-white rounded-xl text-sm font-medium disabled:opacity-50">OK</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Check-in */}
      <p className="text-sm font-medium mt-4 mb-2">Check-in rápido</p>
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-gray-50 rounded-xl p-2 text-center">
          <select value={checkin?.sleep_hours || ''} onChange={e => saveCheckin('sleep_hours', Number(e.target.value))} className="text-sm font-medium bg-transparent text-center w-full">
            <option value="">--</option>
            {[4,5,6,7,8,9,10].map(h => <option key={h} value={h}>{h}h</option>)}
          </select>
          <p className="text-[10px] text-gray-400">Sono</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2 text-center">
          <select value={checkin?.energy_level || ''} onChange={e => saveCheckin('energy_level', Number(e.target.value))} className="text-sm font-medium bg-transparent text-center w-full">
            <option value="">--</option>
            {[1,2,3,4,5,6,7,8,9,10].map(l => <option key={l} value={l}>{l}/10</option>)}
          </select>
          <p className="text-[10px] text-gray-400">Energia</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2 text-center">
          <select value={checkin?.digestion || ''} onChange={e => saveCheckin('digestion', e.target.value)} className="text-sm font-medium bg-transparent text-center w-full">
            <option value="">--</option>
            <option value="boa">Boa</option>
            <option value="regular">Regular</option>
            <option value="ruim">Ruim</option>
          </select>
          <p className="text-[10px] text-gray-400">Digestão</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2 text-center">
          <select value={checkin?.water_glasses || ''} onChange={e => saveCheckin('water_glasses', Number(e.target.value))} className="text-sm font-medium bg-transparent text-center w-full">
            <option value="">--</option>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <p className="text-[10px] text-gray-400">Água (copos)</p>
        </div>
      </div>

      {/* CLOSE DAY BUTTON */}
      {!isViewingFuture && !checkin?.day_closed && todayMeals.length > 0 && (
        <button 
          onClick={() => setShowCloseDay(true)}
          className="w-full mt-6 py-4 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500 font-medium hover:border-teal-300 hover:text-teal-600 transition-colors"
        >
          Encerrar o dia
        </button>
      )}
    </div>
  );
}
