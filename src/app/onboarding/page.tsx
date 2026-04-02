'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday, toLocalDateStr } from '@/lib/dates';

type Step = 'name' | 'goals_gender' | 'body_data' | 'restrictions' | 'extra' | 'generating' | 'goals_review' | 'plan_review' | 'weekly' | 'finish';

export default function Onboarding() {
  const [step, setStep] = useState<Step>('name');
  const [planId, setPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Data
  const [name, setName] = useState('');
  const [objectives, setObjectives] = useState<string[]>([]);
  const [otherObjective, setOtherObjective] = useState('');
  const [showOtherObj, setShowOtherObj] = useState(false);
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [otherRestriction, setOtherRestriction] = useState('');
  const [showOtherRes, setShowOtherRes] = useState(false);
  const [hasGym, setHasGym] = useState('');
  const [extraInfo, setExtraInfo] = useState('');
  const [showExtraInput, setShowExtraInput] = useState(false);

  // Plan
  const [planData, setPlanData] = useState<any>(null);
  const [editingGoal, setEditingGoal] = useState<number | null>(null);

  // Weekly schedule — 7 days, 3 meals each
  const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const [weeklyMeals, setWeeklyMeals] = useState(
    dayNames.map(() => ({ breakfast: 'casa' as string, lunch: 'casa' as string, dinner: 'casa' as string }))
  );

  // Schedule for API — next 10 days based on weekly pattern
  const [schedule, setSchedule] = useState<any[]>([]);

  useEffect(() => { initPlan(); }, []);

  async function initPlan() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!prof) {
      await supabase.from('profiles').insert({ id: session.user.id, email: session.user.email, role: 'patient' });
    } else if (prof.name) setName(prof.name);

    const { data: existing } = await supabase.from('plans').select('*').eq('patient_id', session.user.id).eq('status', 'onboarding').order('created_at', { ascending: false }).limit(1);
    if (existing && existing.length > 0) { setPlanId(existing[0].id); return; }
    const { data: newPlan } = await supabase.from('plans').insert({ patient_id: session.user.id, status: 'onboarding' }).select().single();
    if (newPlan) setPlanId(newPlan.id);
  }

  function toggleObjective(obj: string) {
    setObjectives(prev => prev.includes(obj) ? prev.filter(o => o !== obj) : [...prev, obj]);
  }
  function toggleRestriction(r: string) {
    if (r === 'Nenhuma') { setRestrictions([]); return; }
    setRestrictions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }
  function toggleWeeklyMeal(dayIdx: number, meal: 'breakfast' | 'lunch' | 'dinner') {
    setWeeklyMeals(prev => {
      const updated = [...prev];
      updated[dayIdx] = { ...updated[dayIdx], [meal]: updated[dayIdx][meal] === 'casa' ? 'fora' : 'casa' };
      return updated;
    });
  }

  function buildScheduleFromWeekly(): any[] {
    const days: any[] = [];
    const jsLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    for (let i = 0; i < 10; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const dayOfWeek = d.getDay(); // 0=dom, 1=seg...
      const weeklyIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // map to our 0=seg..6=dom
      const wm = weeklyMeals[weeklyIdx];
      days.push({
        date: toLocalDateStr(d),
        dayLabel: jsLabels[d.getDay()],
        morning: wm.breakfast,
        afternoon: wm.lunch,
        evening: wm.dinner,
        has_gym: hasGym === 'Sim',
      });
    }
    return days;
  }

  async function generateGoals() {
    if (!planId) return;
    setStep('generating');
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (session) await supabase.from('profiles').update({ name }).eq('id', session.user.id);

    const allObjectives = [...objectives, ...(otherObjective ? [otherObjective] : [])];
    const allRestrictions = [...restrictions, ...(otherRestriction ? [otherRestriction] : [])];

    const summary = `Nome: ${name}. Objetivos: ${allObjectives.join(', ')}. Sexo: ${gender}. Idade: ${age}. Peso: ${weight}kg. Altura: ${height}cm. Atividade: ${activityLevel}. Restrições: ${allRestrictions.join(', ') || 'nenhuma'}. Academia: ${hasGym}. Info extra: ${extraInfo || 'nenhuma'}`;

    await supabase.from('plans').update({ onboarding_conversation: [{ role: 'user', content: summary }] }).eq('id', planId);

    try {
      const res = await fetch('/api/generate-onboarding-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientData: summary }),
      });
      const data = await res.json();

      if (data.planData && data.planData.goals?.length > 0) {
        setPlanData(data.planData);
        setStep('goals_review');
        setLoading(false);
        return;
      }
    } catch {}

    // Smart fallback
    const w = Number(weight); const h = Number(height); const a = Number(age);
    const tmb = gender === 'Masculino' ? 88.36 + (13.4 * w) + (4.8 * h) - (5.7 * a) : 447.6 + (9.2 * w) + (3.1 * h) - (4.3 * a);
    const actMult = activityLevel.includes('5') ? 1.725 : activityLevel.includes('3') ? 1.55 : activityLevel.includes('1') ? 1.375 : 1.2;
    const tdee = Math.round(tmb * actMult);
    const wantsLose = allObjectives.some(o => o.toLowerCase().includes('emagre'));
    const wantsGain = allObjectives.some(o => o.toLowerCase().includes('massa'));
    const targetCal = wantsLose ? tdee - 400 : wantsGain ? tdee + 300 : tdee;
    const proteinG = wantsGain ? Math.round(w * 2) : Math.round(w * 1.6);
    const fatG = Math.round(targetCal * 0.25 / 9);
    const carbsG = Math.round((targetCal - proteinG * 4 - fatG * 9) / 4);
    const loseKg = wantsLose ? Math.round(w * 0.08) : 0;

    const fallbackGoals = [];
    if (wantsLose) fallbackGoals.push({ description: `Perder ${loseKg}kg de gordura`, measurement: `Pesagem semanal, meta de -0.5kg/semana`, timeframe: '3 meses' });
    else if (wantsGain) fallbackGoals.push({ description: `Ganhar ${Math.round(w * 0.05)}kg de massa magra`, measurement: 'Pesagem + medidas quinzenais', timeframe: '4 meses' });
    else fallbackGoals.push({ description: allObjectives[0] || 'Melhorar alimentação', measurement: 'Acompanhamento semanal', timeframe: '3 meses' });

    fallbackGoals.push({ description: `Atingir ${proteinG}g de proteína por dia`, measurement: 'Registro diário no app', timeframe: '1 mês' });
    fallbackGoals.push({ description: 'Manter aderência de 80% ao plano', measurement: 'Percentual de refeições verdes na semana', timeframe: 'Contínuo' });

    setPlanData({
      duration_months: 6,
      goals: fallbackGoals,
      meal_plan_base: { calories: targetCal, protein_g: proteinG, carbs_g: carbsG, fat_g: fatG, meals_per_day: 5, meal_names: ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar'] },
      exercise_plan_base: { weekly_frequency: activityLevel.includes('5') ? 5 : activityLevel.includes('3') ? 4 : activityLevel.includes('1') ? 2 : 1, activities: [{ type: hasGym === 'Sim' ? 'Musculação' : 'Exercício funcional', frequency: activityLevel }] },
      scientific_rationale: `TMB estimada: ${Math.round(tmb)}kcal. TDEE: ${tdee}kcal. ${wantsLose ? `Déficit de 400kcal/dia para perda gradual.` : wantsGain ? `Superávit de 300kcal/dia para ganho de massa.` : `Manutenção calórica.`} Proteína em ${(proteinG / w).toFixed(1)}g/kg para ${wantsGain ? 'síntese muscular' : 'preservação de massa magra'}.`,
    });
    setStep('goals_review');
    setLoading(false);
  }

  function updateGoal(index: number, field: string, value: string) {
    const u = { ...planData }; u.goals = [...u.goals]; u.goals[index] = { ...u.goals[index], [field]: value }; setPlanData(u);
  }
  function updateMealPlan(field: string, value: any) {
    const u = { ...planData }; u.meal_plan_base = { ...u.meal_plan_base, [field]: value };
    if (field === 'meals_per_day') { const n = Number(value); u.meal_plan_base.meal_names = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'].slice(0, n); }
    setPlanData(u);
  }
  function updateExercisePlan(field: string, value: any) {
    const u = { ...planData }; u.exercise_plan_base = { ...u.exercise_plan_base, [field]: value }; setPlanData(u);
  }

  async function generateMonthlyPlan(): Promise<any> {
    const allRestrictions = [...restrictions, ...(otherRestriction ? [otherRestriction] : [])];
    const res = await fetch('/api/generate-monthly-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mealPlanBase: planData.meal_plan_base, exercisePlanBase: planData.exercise_plan_base, goals: planData.goals, restrictions: allRestrictions.join(', ') || 'nenhuma' }),
    });
    const data = await res.json();
    return data.monthlyPlan;
  }

  async function submitToNina() {
    if (!planId || !planData) return; setLoading(true);
    const sched = buildScheduleFromWeekly();
    const monthlyPlan = await generateMonthlyPlan();
    await supabase.from('plans').update({ status: 'pending_review', duration_months: planData.duration_months, goals: planData.goals, meal_plan_base: planData.meal_plan_base, exercise_plan_base: planData.exercise_plan_base, scientific_rationale: planData.scientific_rationale, initial_schedule: sched, monthly_plan: monthlyPlan }).eq('id', planId);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await supabase.from('alerts').insert({ patient_id: session.user.id, plan_id: planId, type: 'plan_ready', message: 'Novo plano pronto para revisão' });
    setStep('finish'); setLoading(false);
  }

  async function submitAutoGenerate() {
    if (!planId || !planData) return; setLoading(true);
    const sched = buildScheduleFromWeekly();
    const monthlyPlan = await generateMonthlyPlan();
    await supabase.from('plans').update({ status: 'approved', approved_at: new Date().toISOString(), start_date: getLocalToday(), duration_months: planData.duration_months, goals: planData.goals, meal_plan_base: planData.meal_plan_base, exercise_plan_base: planData.exercise_plan_base, scientific_rationale: planData.scientific_rationale, initial_schedule: sched, monthly_plan: monthlyPlan }).eq('id', planId);
    for (const day of sched) await supabase.from('daily_schedule').upsert({ plan_id: planId, date: day.date, morning: day.morning, afternoon: day.afternoon, evening: day.evening, has_gym: day.has_gym }, { onConflict: 'plan_id,date' });
    setStep('finish'); setLoading(false);
  }

  // Progress
  const stepOrder: Step[] = ['name', 'goals_gender', 'body_data', 'restrictions', 'extra', 'generating', 'goals_review', 'plan_review', 'weekly', 'finish'];
  const currentIdx = stepOrder.indexOf(step);
  const progress = Math.min(100, Math.round((currentIdx / (stepOrder.length - 1)) * 100));

  const header = (
    <div className="p-4 flex items-center justify-between">
      <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span></h1>
      <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} className="text-sm text-gray-400">Sair</button>
    </div>
  );

  const progressBar = (
    <div className="h-1 bg-gray-100">
      <div className="h-1 bg-teal-400 transition-all duration-500" style={{ width: `${progress}%` }} />
    </div>
  );

  // ============ NAME ============
  if (step === 'name') return (
    <div className="min-h-screen bg-white flex flex-col">
      {header}{progressBar}
      <div className="flex-1 flex flex-col justify-center p-6">
        <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
          <span className="text-xl font-medium text-teal-600">n</span>
        </div>
        <h2 className="text-xl font-medium text-center mb-1">Bem-vindo à ninAI!</h2>
        <p className="text-sm text-gray-400 text-center mb-8">Vamos criar seu plano em poucos passos</p>
        <p className="text-sm text-gray-600 mb-2">Qual é o seu nome?</p>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-lg focus:outline-none focus:border-teal-400" autoFocus />
      </div>
      <div className="p-6 pt-0">
        <button onClick={() => name.trim() && setStep('goals_gender')} disabled={!name.trim()} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-30">Continuar</button>
      </div>
    </div>
  );

  // ============ GOALS + GENDER ============
  if (step === 'goals_gender') {
    const objOptions = ['Emagrecer', 'Ganhar massa muscular', 'Comer melhor', 'Mais energia e disposição', 'Melhorar saúde metabólica', 'Controlar ansiedade/compulsão'];
    const canContinue = (objectives.length > 0 || otherObjective) && gender;
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {header}{progressBar}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-gray-600 mb-3">Quais são seus objetivos? <span className="text-gray-400">(marque quantos quiser)</span></p>
          <div className="space-y-2 mb-6">
            {objOptions.map(obj => (
              <button key={obj} onClick={() => toggleObjective(obj)} className={`w-full py-3 px-4 rounded-xl text-sm font-medium text-left transition-all ${objectives.includes(obj) ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-700'}`}>
                {objectives.includes(obj) ? '✓ ' : ''}{obj}
              </button>
            ))}
            {!showOtherObj ? (
              <button onClick={() => setShowOtherObj(true)} className="w-full py-3 px-4 rounded-xl text-sm text-gray-400 border border-dashed border-gray-200">+ Outro</button>
            ) : (
              <input type="text" value={otherObjective} onChange={e => setOtherObjective(e.target.value)} placeholder="Descreva..." className="w-full px-4 py-3 border border-teal-300 rounded-xl text-sm focus:outline-none" autoFocus />
            )}
          </div>

          <p className="text-sm text-gray-600 mb-3">Sexo</p>
          <div className="grid grid-cols-2 gap-3">
            {['Feminino', 'Masculino'].map(g => (
              <button key={g} onClick={() => setGender(g)} className={`py-3.5 rounded-xl text-sm font-medium transition-all ${gender === g ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600'}`}>{g}</button>
            ))}
          </div>
        </div>
        <div className="p-6 pt-0 space-y-2">
          <button onClick={() => canContinue && setStep('body_data')} disabled={!canContinue} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-30">Continuar</button>
          <button onClick={() => setStep('name')} className="w-full py-2 text-gray-400 text-sm">Voltar</button>
        </div>
      </div>
    );
  }

  // ============ BODY DATA + ACTIVITY ============
  if (step === 'body_data') {
    const actOptions = ['Sedentário', '1-2x por semana', '3-4x por semana', '5+ por semana'];
    const canContinue = age && weight && height && activityLevel;
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {header}{progressBar}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-gray-600 mb-4">Seus dados</p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div>
              <p className="text-xs text-gray-400 mb-1">Idade</p>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="32" className="w-full px-3 py-3 border border-gray-200 rounded-xl text-center text-lg focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Peso (kg)</p>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="78" className="w-full px-3 py-3 border border-gray-200 rounded-xl text-center text-lg focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Altura (cm)</p>
              <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="165" className="w-full px-3 py-3 border border-gray-200 rounded-xl text-center text-lg focus:outline-none focus:border-teal-400" />
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-3">Exercício físico</p>
          <div className="space-y-2">
            {actOptions.map(opt => (
              <button key={opt} onClick={() => setActivityLevel(opt)} className={`w-full py-3 px-4 rounded-xl text-sm font-medium text-left transition-all ${activityLevel === opt ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600'}`}>
                {activityLevel === opt ? '● ' : '○ '}{opt}
              </button>
            ))}
          </div>
        </div>
        <div className="p-6 pt-0 space-y-2">
          <button onClick={() => canContinue && setStep('restrictions')} disabled={!canContinue} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-30">Continuar</button>
          <button onClick={() => setStep('goals_gender')} className="w-full py-2 text-gray-400 text-sm">Voltar</button>
        </div>
      </div>
    );
  }

  // ============ RESTRICTIONS + GYM ============
  if (step === 'restrictions') {
    const resOptions = ['Lactose', 'Glúten', 'Vegetariano', 'Vegano', 'Nenhuma'];
    const canContinue = (restrictions.length > 0 || restrictions.length === 0) && hasGym;
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {header}{progressBar}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-gray-600 mb-3">Alguma restrição alimentar?</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {resOptions.map(opt => (
              <button key={opt} onClick={() => toggleRestriction(opt)} className={`py-3 px-3 rounded-xl text-sm font-medium transition-all ${opt === 'Nenhuma' ? (restrictions.length === 0 ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600') : (restrictions.includes(opt) ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600')}`}>
                {opt}
              </button>
            ))}
          </div>
          {!showOtherRes ? (
            <button onClick={() => setShowOtherRes(true)} className="w-full py-2 mb-6 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">+ Outra</button>
          ) : (
            <input type="text" value={otherRestriction} onChange={e => setOtherRestriction(e.target.value)} placeholder="Qual?" className="w-full px-3 py-2 mb-6 border border-teal-300 rounded-xl text-sm focus:outline-none" autoFocus />
          )}

          <p className="text-sm text-gray-600 mb-3">Tem acesso à academia?</p>
          <div className="grid grid-cols-2 gap-3">
            {['Sim', 'Não'].map(opt => (
              <button key={opt} onClick={() => setHasGym(opt)} className={`py-3.5 rounded-xl text-sm font-medium transition-all ${hasGym === opt ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600'}`}>{opt}</button>
            ))}
          </div>
        </div>
        <div className="p-6 pt-0 space-y-2">
          <button onClick={() => canContinue && setStep('extra')} disabled={!canContinue} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-30">Continuar</button>
          <button onClick={() => setStep('body_data')} className="w-full py-2 text-gray-400 text-sm">Voltar</button>
        </div>
      </div>
    );
  }

  // ============ EXTRA INFO ============
  if (step === 'extra') return (
    <div className="min-h-screen bg-white flex flex-col">
      {header}{progressBar}
      <div className="flex-1 flex flex-col justify-center p-6">
        <h2 className="text-lg font-medium mb-2">Mais alguma coisa?</h2>
        <p className="text-sm text-gray-400 mb-6">Problemas de saúde, medicamentos, alergias, preferências...</p>

        {!showExtraInput ? (
          <div className="space-y-3">
            <button onClick={() => setShowExtraInput(true)} className="w-full py-4 bg-gray-50 text-gray-700 rounded-2xl text-sm font-medium">Sim, quero informar</button>
            <button onClick={() => { setExtraInfo(''); generateGoals(); }} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium">Não, gerar meu plano!</button>
          </div>
        ) : (
          <div>
            <textarea value={extraInfo} onChange={e => setExtraInfo(e.target.value)} placeholder="Conte o que achar importante..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 resize-none" rows={4} autoFocus />
            <button onClick={() => extraInfo.trim() && generateGoals()} disabled={!extraInfo.trim()} className="w-full mt-4 py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-30">Gerar meu plano!</button>
          </div>
        )}
      </div>
      <div className="p-6 pt-0">
        <button onClick={() => setStep('restrictions')} className="w-full py-2 text-gray-400 text-sm">Voltar</button>
      </div>
    </div>
  );

  // ============ GENERATING ============
  if (step === 'generating') return (
    <div className="min-h-screen bg-white flex flex-col">
      {header}{progressBar}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mb-4">
          <div className="w-8 h-8 border-3 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm text-gray-600 font-medium">Criando seu plano personalizado...</p>
        <p className="text-xs text-gray-400 mt-1">Isso pode levar alguns segundos</p>
      </div>
    </div>
  );

  // ============ GOALS REVIEW ============
  if (step === 'goals_review' && planData) return (
    <div className="min-h-screen bg-white flex flex-col">
      {header}{progressBar}
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-lg font-medium mb-1">Suas metas</h2>
        <p className="text-xs text-gray-400 mb-4">Toque para editar</p>

        {(planData.goals || []).map((g: any, i: number) => (
          <div key={i} className="mb-2" onClick={() => setEditingGoal(editingGoal === i ? null : i)}>
            {editingGoal === i ? (
              <div className="bg-gray-50 rounded-xl p-3 space-y-2" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <input value={g.description} onChange={e => updateGoal(i, 'description', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2" />
                <input value={g.measurement} onChange={e => updateGoal(i, 'measurement', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2" placeholder="Como medir" />
                <input value={g.timeframe} onChange={e => updateGoal(i, 'timeframe', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2" placeholder="Prazo" />
                <button onClick={() => setEditingGoal(null)} className="text-xs text-teal-600 font-medium">✓ OK</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-teal-50 rounded-xl cursor-pointer">
                <div className="w-2 h-2 rounded-full bg-teal-400" />
                <div className="flex-1"><p className="text-sm font-medium text-teal-800">{g.description}</p><p className="text-xs text-teal-600">{g.measurement} — {g.timeframe}</p></div>
                <span className="text-xs text-teal-300">✎</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-6 pt-0 space-y-2">
        <button onClick={() => setStep('plan_review')} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium">Continuar</button>
        <button onClick={() => setStep('extra')} className="w-full py-2 text-gray-400 text-sm">Voltar</button>
      </div>
    </div>
  );

  // ============ PLAN REVIEW ============
  if (step === 'plan_review' && planData) {
    const mp = planData.meal_plan_base || {};
    const ep = planData.exercise_plan_base || {};
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {header}{progressBar}
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-lg font-medium mb-4">Seu plano</h2>

          <div className="bg-teal-50 rounded-2xl p-4 mb-4">
            <p className="text-sm font-medium text-teal-800 mb-3">Alimentação</p>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-[10px] text-teal-600 mb-1">Calorias</p><input type="number" value={mp.calories || ''} onChange={e => updateMealPlan('calories', Number(e.target.value))} className="w-full text-sm border rounded-lg px-2 py-1.5 bg-white" /></div>
              <div><p className="text-[10px] text-teal-600 mb-1">Refeições/dia</p><select value={mp.meals_per_day || 5} onChange={e => updateMealPlan('meals_per_day', Number(e.target.value))} className="w-full text-sm border rounded-lg px-2 py-1.5 bg-white">{[3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
              <div><p className="text-[10px] text-teal-600 mb-1">Proteína(g)</p><input type="number" value={mp.protein_g || ''} onChange={e => updateMealPlan('protein_g', Number(e.target.value))} className="w-full text-sm border rounded-lg px-2 py-1.5 bg-white" /></div>
              <div><p className="text-[10px] text-teal-600 mb-1">Carbo(g)</p><input type="number" value={mp.carbs_g || ''} onChange={e => updateMealPlan('carbs_g', Number(e.target.value))} className="w-full text-sm border rounded-lg px-2 py-1.5 bg-white" /></div>
              <div><p className="text-[10px] text-teal-600 mb-1">Gordura(g)</p><input type="number" value={mp.fat_g || ''} onChange={e => updateMealPlan('fat_g', Number(e.target.value))} className="w-full text-sm border rounded-lg px-2 py-1.5 bg-white" /></div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-4 mb-4">
            <p className="text-sm font-medium text-blue-800 mb-2">Exercícios</p>
            <select value={ep.weekly_frequency} onChange={e => updateExercisePlan('weekly_frequency', Number(e.target.value))} className="text-sm bg-white border rounded-lg px-2 py-1.5">
              {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}x por semana</option>)}
            </select>
          </div>

          {planData.scientific_rationale && (
            <div className="bg-purple-50 rounded-2xl p-4">
              <p className="text-sm font-medium text-purple-800 mb-1">Por que esse plano?</p>
              <p className="text-xs text-purple-700 leading-relaxed">{planData.scientific_rationale}</p>
            </div>
          )}
        </div>
        <div className="p-6 pt-0 space-y-2">
          <button onClick={() => setStep('weekly')} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium">Continuar</button>
          <button onClick={() => setStep('goals_review')} className="w-full py-2 text-gray-400 text-sm">Voltar</button>
        </div>
      </div>
    );
  }

  // ============ WEEKLY SCHEDULE ============
  if (step === 'weekly') return (
    <div className="min-h-screen bg-white flex flex-col">
      {header}{progressBar}
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-lg font-medium mb-1">Sua semana típica</h2>
        <p className="text-xs text-gray-400 mb-4">Onde você faz cada refeição? Toque para mudar.</p>

        <div className="space-y-2">
          {dayNames.map((day, i) => (
            <div key={day} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-medium text-gray-700 mb-2">{day}</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'breakfast' as const, label: '☕ Café', icon: '☕' },
                  { key: 'lunch' as const, label: '🍽 Almoço', icon: '🍽' },
                  { key: 'dinner' as const, label: '🌙 Jantar', icon: '🌙' },
                ] as const).map(meal => {
                  const val = weeklyMeals[i][meal.key];
                  return (
                    <button key={meal.key} onClick={() => toggleWeeklyMeal(i, meal.key)}
                      className={`py-2 rounded-lg text-[10px] font-medium transition-all ${val === 'casa' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                      {meal.label}<br/>{val === 'casa' ? 'Casa' : 'Fora'}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-6 pt-2 space-y-3">
        <p className="text-xs font-medium text-center text-gray-500">Como quer prosseguir?</p>
        <button onClick={submitAutoGenerate} disabled={loading} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-50">
          {loading ? 'Gerando...' : '⚡ Gerar plano agora com a ninAI'}
        </button>
        <div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-200" /><span className="text-xs text-gray-400">ou</span><div className="flex-1 h-px bg-gray-200" /></div>
        <button onClick={submitToNina} disabled={loading} className="w-full py-4 border-2 border-teal-300 text-teal-700 rounded-2xl text-sm font-medium disabled:opacity-50">
          {loading ? 'Enviando...' : '👩‍⚕️ Enviar para a Nina aprovar'}
        </button>
        <button onClick={() => setStep('plan_review')} className="w-full py-2 text-gray-400 text-sm">Voltar</button>
      </div>
    </div>
  );

  // ============ FINISH ============
  if (step === 'finish') return (
    <div className="min-h-screen bg-white flex flex-col">
      {header}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
          <span className="text-3xl">🎉</span>
        </div>
        <h2 className="text-xl font-medium mb-2">Tudo pronto!</h2>
        <p className="text-sm text-gray-500 max-w-xs">Seu plano está configurado. Vamos começar sua jornada!</p>
        <button onClick={() => window.location.href = '/dashboard'} className="mt-6 px-8 py-3 bg-teal-400 text-white rounded-xl text-sm font-medium">Começar!</button>
      </div>
    </div>
  );

  return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-gray-400">Carregando...</p></div>;
}
