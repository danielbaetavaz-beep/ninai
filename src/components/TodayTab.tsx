'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function TodayTab({ plan, weeklyPlan }: { plan: any; weeklyPlan: any }) {
  const [todayMeals, setTodayMeals] = useState<any[]>([]);
  const [todayExercise, setTodayExercise] = useState<any>(null);
  const [checkin, setCheckin] = useState<any>(null);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split('T')[0];
  const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const dayKey = dayNames[new Date().getDay()];
  const dayLabels: Record<string, string> = { domingo: 'Domingo', segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado' };

  useEffect(() => { loadToday(); }, []);

  async function loadToday() {
    const { data: meals } = await supabase.from('meals').select('*').eq('plan_id', plan.id).eq('date', today);
    const { data: exercise } = await supabase.from('exercises').select('*').eq('plan_id', plan.id).eq('date', today).limit(1);
    const { data: ci } = await supabase.from('daily_checkins').select('*').eq('plan_id', plan.id).eq('date', today).limit(1);

    const plannedMeals = weeklyPlan?.meal_plan_detailed?.[dayKey] || [];
    const mealList = plannedMeals.map((pm: any) => {
      const existing = meals?.find(m => m.meal_name === pm.meal);
      return existing || { meal_name: pm.meal, planned_description: pm.description, macros: pm.macros, date: today, plan_id: plan.id };
    });
    setTodayMeals(mealList);

    const plannedEx = weeklyPlan?.exercise_plan_detailed?.[dayKey];
    if (exercise && exercise.length > 0) {
      setTodayExercise(exercise[0]);
    } else if (plannedEx) {
      setTodayExercise({ planned_type: plannedEx.type, description: plannedEx.description, done: false, date: today });
    }

    setCheckin(ci && ci.length > 0 ? ci[0] : null);
  }

  async function handlePhoto(mealName: string, file: File) {
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];

      const res = await fetch('/api/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mealName,
          plannedDescription: todayMeals.find(m => m.meal_name === mealName)?.planned_description || '',
          mealPlanContext: plan.meal_plan_base,
        }),
      });
      const analysis = await res.json();

      const fileName = `${plan.id}/${today}/${mealName.replace(/\s/g, '_')}_${Date.now()}.jpg`;
      await supabase.storage.from('meal-photos').upload(fileName, file);
      const { data: urlData } = supabase.storage.from('meal-photos').getPublicUrl(fileName);

      await supabase.from('meals').upsert({
        plan_id: plan.id,
        weekly_plan_id: weeklyPlan?.id,
        date: today,
        meal_name: mealName,
        planned_description: todayMeals.find(m => m.meal_name === mealName)?.planned_description || '',
        photo_url: urlData.publicUrl,
        ai_analysis: analysis,
        flag: analysis.flag,
        feedback: analysis.feedback,
        macros: analysis.estimated_macros,
      }, { onConflict: 'plan_id,date,meal_name', ignoreDuplicates: false });

      setUploading(false);
      loadToday();
    };
    reader.readAsDataURL(file);
  }

  async function markExercise(done: boolean, actualType?: string) {
    await supabase.from('exercises').upsert({
      plan_id: plan.id,
      weekly_plan_id: weeklyPlan?.id,
      date: today,
      planned_type: todayExercise?.planned_type,
      actual_type: actualType || todayExercise?.planned_type,
      done,
      has_gym_access: weeklyPlan?.routine?.[dayKey]?.gym ?? true,
    }, { onConflict: 'plan_id,date', ignoreDuplicates: false });
    loadToday();
  }

  async function saveCheckin(field: string, value: any) {
    const data = { ...checkin, plan_id: plan.id, date: today, [field]: value };
    await supabase.from('daily_checkins').upsert(data, { onConflict: 'plan_id,date', ignoreDuplicates: false });
    setCheckin(data);
  }

  const registeredCount = todayMeals.filter(m => m.flag).length;
  const totalMacros = todayMeals.reduce((acc, m) => {
    if (m.macros) {
      acc.protein += m.macros.protein_g || 0;
      acc.carbs += m.macros.carbs_g || 0;
      acc.fat += m.macros.fat_g || 0;
      acc.calories += m.macros.calories || 0;
    }
    return acc;
  }, { protein: 0, carbs: 0, fat: 0, calories: 0 });

  const flagColor: Record<string, string> = { green: 'bg-green-400', yellow: 'bg-amber-400', red: 'bg-red-400' };
  const flagBg: Record<string, string> = { green: 'bg-green-50', yellow: 'bg-amber-50', red: 'bg-red-50' };
  const flagText: Record<string, string> = { green: 'text-green-800', yellow: 'text-amber-800', red: 'text-red-800' };
  const flagLabel: Record<string, string> = { green: 'Verde — perfeito!', yellow: 'Amarelo — quase lá!', red: 'Vermelho — fora do plano' };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-lg font-medium">Olá!</p>
          <p className="text-xs text-gray-400">{dayLabels[dayKey]}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="bg-teal-50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
          <span className="text-lg font-medium text-teal-800">{Math.round(registeredCount / Math.max(todayMeals.length, 1) * 100)}</span>
          <span className="text-xs text-teal-600">score</span>
        </div>
      </div>

      {/* Meals */}
      <div className="flex items-center justify-between mt-4 mb-2">
        <span className="text-sm font-medium">Cardápio de hoje</span>
        <span className="text-xs text-gray-400">{registeredCount} de {todayMeals.length}</span>
      </div>

      {todayMeals.map((meal, i) => (
        <div key={i} className="mb-2">
          <div onClick={() => setExpandedMeal(expandedMeal === meal.meal_name ? null : meal.meal_name)} className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl cursor-pointer">
            <div className={`w-2.5 h-2.5 rounded-full ${meal.flag ? flagColor[meal.flag] : 'bg-gray-200'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{meal.meal_name}</p>
              <p className="text-xs text-gray-400 truncate">{meal.planned_description}</p>
            </div>
            {meal.flag ? (
              <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#639922" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full border border-gray-200" />
            )}
          </div>

          {expandedMeal === meal.meal_name && (
            <div className={`p-3 rounded-xl mt-1 ${meal.flag ? flagBg[meal.flag] : 'bg-gray-50'}`}>
              {meal.flag ? (
                <div>
                  <p className={`text-sm font-medium ${flagText[meal.flag]}`}>{flagLabel[meal.flag]}</p>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{meal.feedback}</p>
                  {meal.photo_url && <img src={meal.photo_url} className="w-full h-32 object-cover rounded-lg mt-2" alt="" />}
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium mb-1">Registrar {meal.meal_name.toLowerCase()}</p>
                  <p className="text-xs text-gray-500 mb-3">Plano: {meal.planned_description}. Tire uma foto do que você comeu.</p>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                    if (e.target.files?.[0]) handlePhoto(meal.meal_name, e.target.files[0]);
                  }} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full py-3 bg-teal-400 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                    {uploading ? 'Analisando...' : 'Tirar foto do prato'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Macros */}
      <p className="text-sm font-medium mt-4 mb-2">Macros de hoje</p>
      {[
        { label: 'Proteína', current: Math.round(totalMacros.protein), target: plan.meal_plan_base?.protein_g || 150, color: 'bg-teal-400' },
        { label: 'Carbo', current: Math.round(totalMacros.carbs), target: plan.meal_plan_base?.carbs_g || 250, color: 'bg-amber-400' },
        { label: 'Gordura', current: Math.round(totalMacros.fat), target: plan.meal_plan_base?.fat_g || 70, color: 'bg-orange-400' },
        { label: 'Calorias', current: Math.round(totalMacros.calories), target: plan.meal_plan_base?.calories || 2000, color: 'bg-gray-400' },
      ].map(m => (
        <div key={m.label} className="flex items-center gap-1.5 mb-2">
          <span className="text-xs text-gray-400 w-12">{m.label}</span>
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${m.color} rounded-full`} style={{ width: `${Math.min((m.current / m.target) * 100, 100)}%` }} />
          </div>
          <span className="text-xs text-gray-400 w-16 text-right"><b className="text-gray-700">{m.current}</b>/{m.target}{m.label === 'Calorias' ? '' : 'g'}</span>
        </div>
      ))}

      {/* Exercise */}
      {todayExercise && (
        <>
          <p className="text-sm font-medium mt-4 mb-2">Exercício de hoje</p>
          <div className={`flex items-center gap-3 p-3 rounded-xl border border-gray-100 ${todayExercise.done ? 'bg-green-50' : ''}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${todayExercise.done ? 'bg-green-400' : 'bg-blue-50'}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={todayExercise.done ? '#fff' : '#378ADD'} strokeWidth="2" strokeLinecap="round"><path d="M6 5v14M18 5v14M6 12h12" /></svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{todayExercise.actual_type || todayExercise.planned_type}</p>
              <p className="text-xs text-gray-400">{todayExercise.done ? 'Concluído' : 'Previsto para hoje'}</p>
            </div>
            {!todayExercise.done && (
              <div className="flex gap-1.5">
                <button onClick={() => markExercise(true)} className="text-xs px-3 py-1.5 rounded-full bg-teal-400 text-white font-medium">Feito</button>
                <button onClick={() => {
                  const alt = prompt('O que você fez?');
                  if (alt) markExercise(true, alt);
                }} className="text-xs px-2 py-1.5 rounded-full border border-gray-200 text-blue-500">Outra</button>
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
    </div>
  );
}
