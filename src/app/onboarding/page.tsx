'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday, toLocalDateStr } from '@/lib/dates';

export default function Onboarding() {
  const [step, setStep] = useState<'welcome' | 'objectives' | 'profile' | 'data' | 'extra' | 'generating' | 'goals' | 'plan' | 'schedule' | 'complete_nina' | 'complete_auto'>('welcome');
  const [planId, setPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step data
  const [name, setName] = useState('');
  const [objectives, setObjectives] = useState<string[]>([]);
  const [otherObjective, setOtherObjective] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [otherRestriction, setOtherRestriction] = useState('');
  const [eatingOut, setEatingOut] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [extraInfo, setExtraInfo] = useState('');

  // Plan data
  const [planData, setPlanData] = useState<any>(null);
  const [editingGoal, setEditingGoal] = useState<number | null>(null);
  const [schedule, setSchedule] = useState<any[]>([]);

  useEffect(() => { initPlan(); }, []);

  function buildInitialSchedule() {
    const days: any[] = [];
    const dayLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    for (let i = 0; i < 10; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      days.push({ date: toLocalDateStr(d), dayLabel: dayLabels[d.getDay()], morning: 'casa', afternoon: 'casa', evening: 'casa', has_gym: false });
    }
    return days;
  }

  async function initPlan() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }

    // Check if profile has name already
    const { data: prof } = await supabase.from('profiles').select('name').eq('id', session.user.id).single();
    if (prof?.name) setName(prof.name);

    const { data: newPlan } = await supabase.from('plans').insert({ patient_id: session.user.id, status: 'onboarding' }).select().single();
    if (newPlan) setPlanId(newPlan.id);
  }

  function toggleObjective(obj: string) {
    setObjectives(prev => prev.includes(obj) ? prev.filter(o => o !== obj) : [...prev, obj]);
  }

  function toggleRestriction(r: string) {
    setRestrictions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  async function generateGoals() {
    if (!planId) return;
    setStep('generating');
    setLoading(true);

    // Save name to profile
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('profiles').update({ name }).eq('id', session.user.id);
    }

    // Build context from all answers
    const allObjectives = [...objectives, ...(otherObjective ? [otherObjective] : [])];
    const allRestrictions = [...restrictions, ...(otherRestriction ? [otherRestriction] : [])];

    const context = {
      name, objectives: allObjectives, activityLevel, restrictions: allRestrictions,
      eatingOut, weight: Number(weight), height: Number(height), age: Number(age), gender,
      extraInfo: extraInfo || 'Nenhuma informação adicional',
    };

    // Save onboarding data
    const conversationSummary = [
      { role: 'user' as const, content: `Nome: ${name}. Objetivos: ${allObjectives.join(', ')}. Atividade: ${activityLevel}. Restrições: ${allRestrictions.join(', ') || 'nenhuma'}. Come fora: ${eatingOut}. Peso: ${weight}kg. Altura: ${height}cm. Idade: ${age}. Sexo: ${gender}. Info extra: ${extraInfo || 'nenhuma'}` },
    ];

    await supabase.from('plans').update({ onboarding_conversation: conversationSummary }).eq('id', planId);

    // Call AI to generate plan
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `Gere um plano nutricional completo para este paciente. Retorne o JSON com goals, meal_plan_base, exercise_plan_base, scientific_rationale e duration_months.

DADOS DO PACIENTE:
Nome: ${name}
Objetivos: ${allObjectives.join(', ')}
Nível de atividade: ${activityLevel}
Restrições alimentares: ${allRestrictions.join(', ') || 'nenhuma'}
Frequência que come fora: ${eatingOut}
Peso: ${weight}kg
Altura: ${height}cm
Idade: ${age} anos
Sexo: ${gender}
Informações adicionais: ${extraInfo || 'nenhuma'}` }],
        mode: 'onboarding',
      }),
    });
    const data = await res.json();

    if (data.planData) {
      setPlanData(data.planData);
      setStep('goals');
    } else {
      // Fallback
      setPlanData({
        duration_months: 6,
        goals: [{ description: allObjectives[0] || 'Melhorar alimentação', measurement: 'Acompanhamento semanal', timeframe: '6 meses' }],
        meal_plan_base: { calories: 1800, protein_g: 130, carbs_g: 200, fat_g: 55, meals_per_day: 5, meal_names: ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar'] },
        exercise_plan_base: { weekly_frequency: 3, activities: [{ type: 'Musculação', frequency: '3x/semana' }] },
        scientific_rationale: 'Plano baseado nas informações fornecidas.',
      });
      setStep('goals');
    }
    setLoading(false);
  }

  function updateGoal(index: number, field: string, value: string) {
    const updated = { ...planData }; updated.goals = [...updated.goals]; updated.goals[index] = { ...updated.goals[index], [field]: value }; setPlanData(updated);
  }
  function updateMealPlan(field: string, value: any) {
    const updated = { ...planData }; updated.meal_plan_base = { ...updated.meal_plan_base, [field]: value };
    if (field === 'meals_per_day') { const num = Number(value); const allMealNames = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia']; updated.meal_plan_base.meal_names = allMealNames.slice(0, num); }
    setPlanData(updated);
  }
  function updateExercisePlan(field: string, value: any) {
    const updated = { ...planData }; updated.exercise_plan_base = { ...updated.exercise_plan_base, [field]: value }; setPlanData(updated);
  }
  function toggleSchedule(index: number, field: string) {
    setSchedule(prev => { const updated = [...prev]; if (field === 'has_gym') updated[index] = { ...updated[index], has_gym: !updated[index].has_gym }; else updated[index] = { ...updated[index], [field]: updated[index][field] === 'casa' ? 'fora' : 'casa' }; return updated; });
  }

  async function submitToNina() {
    if (!planId || !planData) return; setLoading(true);
    await supabase.from('plans').update({ status: 'pending_review', duration_months: planData.duration_months, goals: planData.goals, meal_plan_base: planData.meal_plan_base, exercise_plan_base: planData.exercise_plan_base, scientific_rationale: planData.scientific_rationale, initial_schedule: schedule }).eq('id', planId);
    fetch('/api/diagnosis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planData }) }).then(r => r.json()).then(d => { if (d.diagnosis) supabase.from('plans').update({ technical_diagnosis: d.diagnosis }).eq('id', planId); });
    const res = await fetch('/api/generate-daily-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: schedule, mealPlanBase: planData.meal_plan_base, exercisePlanBase: planData.exercise_plan_base, goals: planData.goals }) });
    const detailedPlan = await res.json();
    await supabase.from('plans').update({ detailed_plan: detailedPlan }).eq('id', planId);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await supabase.from('alerts').insert({ patient_id: session.user.id, plan_id: planId, type: 'plan_ready', message: 'Novo plano pronto para revisão' });
    setStep('complete_nina'); setLoading(false);
  }

  async function submitAutoGenerate() {
    if (!planId || !planData) return; setLoading(true);
    const res = await fetch('/api/generate-daily-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: schedule, mealPlanBase: planData.meal_plan_base, exercisePlanBase: planData.exercise_plan_base, goals: planData.goals }) });
    const detailedPlan = await res.json();
    await supabase.from('plans').update({ status: 'approved', approved_at: new Date().toISOString(), start_date: getLocalToday(), duration_months: planData.duration_months, goals: planData.goals, meal_plan_base: planData.meal_plan_base, exercise_plan_base: planData.exercise_plan_base, scientific_rationale: planData.scientific_rationale, initial_schedule: schedule, detailed_plan: detailedPlan }).eq('id', planId);
    for (const day of schedule) await supabase.from('daily_schedule').upsert({ plan_id: planId, date: day.date, morning: day.morning, afternoon: day.afternoon, evening: day.evening, has_gym: day.has_gym }, { onConflict: 'plan_id,date' });
    if (detailedPlan.days) for (const day of detailedPlan.days) await supabase.from('daily_plans').upsert({ plan_id: planId, date: day.date, meals: day.meals, exercise: day.exercise, status: 'active' }, { onConflict: 'plan_id,date' });
    fetch('/api/diagnosis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planData }) }).then(r => r.json()).then(d => { if (d.diagnosis) supabase.from('plans').update({ technical_diagnosis: d.diagnosis }).eq('id', planId); });
    setStep('complete_auto'); setLoading(false);
  }

  const headerWithLogout = (
    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
      <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span></h1>
      <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} className="text-sm text-gray-400">Sair</button>
    </div>
  );

  // ============ STEP: WELCOME ============
  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-medium text-teal-600">n</span>
          </div>
          <h2 className="text-xl font-medium mb-2">Bem-vindo à ninAI!</h2>
          <p className="text-sm text-gray-500 mb-6">Vamos criar seu plano nutricional em 3 passos simples:</p>

          <div className="space-y-3 text-left max-w-xs mx-auto mb-8">
            <div className="flex items-center gap-3 bg-teal-50 rounded-xl p-3">
              <div className="w-8 h-8 rounded-full bg-teal-400 flex items-center justify-center text-white text-sm font-medium">1</div>
              <p className="text-sm text-teal-800">Conhecer você</p>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-sm font-medium">2</div>
              <p className="text-sm text-gray-600">Definir suas metas</p>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-sm font-medium">3</div>
              <p className="text-sm text-gray-600">Montar seu plano</p>
            </div>
          </div>

          <div className="max-w-xs mx-auto">
            <p className="text-sm text-gray-500 mb-2">Qual é o seu nome?</p>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-lg focus:outline-none focus:border-teal-400" autoFocus />
            <button onClick={() => name.trim() && setStep('objectives')} disabled={!name.trim()} className="w-full mt-4 py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-50">Continuar</button>
          </div>
        </div>
      </div>
    );
  }

  // ============ STEP: OBJECTIVES ============
  if (step === 'objectives') {
    const objOptions = ['Emagrecer', 'Ganhar massa muscular', 'Comer melhor', 'Mais energia e disposição', 'Melhorar saúde metabólica', 'Controlar ansiedade/compulsão'];
    const [showOther, setShowOther] = useState(false);
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="p-6">
          <p className="text-xs text-teal-500 mb-1">Passo 1 de 3 — Conhecer você</p>
          <h2 className="text-xl font-medium mb-1">Olá, {name}!</h2>
          <p className="text-sm text-gray-500 mb-4">Quais são seus objetivos? (pode marcar vários)</p>

          <div className="space-y-2 mb-4">
            {objOptions.map(obj => (
              <button key={obj} onClick={() => toggleObjective(obj)} className={`w-full py-3 px-4 rounded-xl text-sm font-medium text-left transition-all ${objectives.includes(obj) ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-700 border border-gray-200'}`}>
                {objectives.includes(obj) ? '✓ ' : ''}{obj}
              </button>
            ))}
            {!showOther ? (
              <button onClick={() => setShowOther(true)} className="w-full py-3 px-4 rounded-xl text-sm text-gray-400 border border-dashed border-gray-200">+ Outro objetivo</button>
            ) : (
              <input type="text" value={otherObjective} onChange={e => setOtherObjective(e.target.value)} placeholder="Descreva seu objetivo..." className="w-full px-4 py-3 border border-teal-300 rounded-xl text-sm focus:outline-none" autoFocus />
            )}
          </div>

          <button onClick={() => (objectives.length > 0 || otherObjective) && setStep('profile')} disabled={objectives.length === 0 && !otherObjective} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-50">Continuar</button>
          <button onClick={() => setStep('welcome')} className="w-full py-3 text-gray-400 text-sm mt-2">Voltar</button>
        </div>
      </div>
    );
  }

  // ============ STEP: PROFILE ============
  if (step === 'profile') {
    const [showOtherR, setShowOtherR] = useState(false);
    const activityOptions = ['Sedentário', '1-2x por semana', '3-4x por semana', '5+ por semana'];
    const restrictionOptions = ['Intolerância a lactose', 'Intolerância a glúten', 'Vegetariano', 'Vegano', 'Nenhuma'];
    const eatingOutOptions = ['Raramente', 'Às vezes (1-2x/sem)', 'Frequentemente (3+/sem)'];

    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="p-6">
          <p className="text-xs text-teal-500 mb-1">Passo 1 de 3 — Conhecer você</p>
          <h2 className="text-lg font-medium mb-4">Sobre sua rotina</h2>

          <p className="text-sm text-gray-600 mb-2">Atividade física</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {activityOptions.map(opt => (
              <button key={opt} onClick={() => setActivityLevel(opt)} className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-all ${activityLevel === opt ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>{opt}</button>
            ))}
          </div>

          <p className="text-sm text-gray-600 mb-2">Restrições alimentares</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {restrictionOptions.map(opt => (
              <button key={opt} onClick={() => { if (opt === 'Nenhuma') { setRestrictions([]); } else toggleRestriction(opt); }} className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-all ${opt === 'Nenhuma' ? (restrictions.length === 0 ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600 border border-gray-200') : (restrictions.includes(opt) ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600 border border-gray-200')}`}>{opt}</button>
            ))}
          </div>
          {!showOtherR ? (
            <button onClick={() => setShowOtherR(true)} className="w-full py-2 mb-4 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">+ Outra restrição</button>
          ) : (
            <input type="text" value={otherRestriction} onChange={e => setOtherRestriction(e.target.value)} placeholder="Qual restrição?" className="w-full px-3 py-2 mb-4 border border-teal-300 rounded-xl text-sm focus:outline-none" autoFocus />
          )}

          <p className="text-sm text-gray-600 mb-2">Refeições fora de casa</p>
          <div className="space-y-2 mb-6">
            {eatingOutOptions.map(opt => (
              <button key={opt} onClick={() => setEatingOut(opt)} className={`w-full py-2.5 px-4 rounded-xl text-xs font-medium text-left transition-all ${eatingOut === opt ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>{opt}</button>
            ))}
          </div>

          <button onClick={() => activityLevel && eatingOut && setStep('data')} disabled={!activityLevel || !eatingOut} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-50">Continuar</button>
          <button onClick={() => setStep('objectives')} className="w-full py-3 text-gray-400 text-sm mt-2">Voltar</button>
        </div>
      </div>
    );
  }

  // ============ STEP: DATA ============
  if (step === 'data') {
    const genderOptions = ['Feminino', 'Masculino'];
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="p-6">
          <p className="text-xs text-teal-500 mb-1">Passo 1 de 3 — Conhecer você</p>
          <h2 className="text-lg font-medium mb-4">Seus dados</h2>

          <div className="space-y-4 mb-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Sexo</p>
              <div className="grid grid-cols-2 gap-2">
                {genderOptions.map(g => (
                  <button key={g} onClick={() => setGender(g)} className={`py-3 rounded-xl text-sm font-medium ${gender === g ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>{g}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Idade</p>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Ex: 32" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Peso (kg)</p>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Ex: 78" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Altura (cm)</p>
              <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="Ex: 165" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg focus:outline-none focus:border-teal-400" />
            </div>
          </div>

          <button onClick={() => weight && height && age && gender && setStep('extra')} disabled={!weight || !height || !age || !gender} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-50">Continuar</button>
          <button onClick={() => setStep('profile')} className="w-full py-3 text-gray-400 text-sm mt-2">Voltar</button>
        </div>
      </div>
    );
  }

  // ============ STEP: EXTRA INFO ============
  if (step === 'extra') {
    const [showInput, setShowInput] = useState(false);
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="p-6">
          <p className="text-xs text-teal-500 mb-1">Passo 1 de 3 — Conhecer você</p>
          <h2 className="text-lg font-medium mb-2">Mais alguma coisa?</h2>
          <p className="text-sm text-gray-500 mb-6">Tem alguma informação importante que eu preciso saber? (problemas de saúde, medicamentos, alergias, preferências...)</p>

          {!showInput ? (
            <div className="space-y-3">
              <button onClick={() => setShowInput(true)} className="w-full py-4 bg-gray-50 border border-gray-200 text-gray-700 rounded-2xl text-sm font-medium">Sim, quero informar algo</button>
              <button onClick={() => { setExtraInfo(''); generateGoals(); }} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium">Não, está tudo! Gerar meu plano</button>
            </div>
          ) : (
            <div>
              <textarea value={extraInfo} onChange={e => setExtraInfo(e.target.value)} placeholder="Conte o que achar importante..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 resize-none" rows={4} autoFocus />
              <button onClick={() => extraInfo.trim() && generateGoals()} disabled={!extraInfo.trim()} className="w-full mt-4 py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-50">Gerar meu plano</button>
            </div>
          )}
          <button onClick={() => setStep('data')} className="w-full py-3 text-gray-400 text-sm mt-2">Voltar</button>
        </div>
      </div>
    );
  }

  // ============ STEP: GENERATING ============
  if (step === 'generating') {
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-3 border-teal-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-gray-500">Criando seu plano personalizado...</p>
          <p className="text-xs text-gray-400 mt-1">Isso pode levar alguns segundos</p>
        </div>
      </div>
    );
  }

  // ============ STEP: GOALS ============
  if (step === 'goals' && planData) {
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="p-6">
          <p className="text-xs text-teal-500 mb-1">Passo 2 de 3 — Suas metas</p>
          <h2 className="text-lg font-medium mb-1">Suas metas</h2>
          <p className="text-xs text-gray-400 mb-4">Toque para editar. Quando estiver bom, continue.</p>

          {(planData.goals || []).map((g: any, i: number) => (
            <div key={i} className="mb-2 cursor-pointer" onClick={() => setEditingGoal(editingGoal === i ? null : i)}>
              {editingGoal === i ? (
                <div className="bg-gray-50 rounded-xl p-3 space-y-2" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <input value={g.description || ''} onChange={e => updateGoal(i, 'description', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2" placeholder="Objetivo" />
                  <input value={g.measurement || ''} onChange={e => updateGoal(i, 'measurement', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2" placeholder="Como medir" />
                  <input value={g.timeframe || ''} onChange={e => updateGoal(i, 'timeframe', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2" placeholder="Prazo" />
                  <button onClick={() => setEditingGoal(null)} className="text-xs text-teal-600">✓ OK</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-teal-50 rounded-xl">
                  <div className="w-2 h-2 rounded-full bg-teal-400" />
                  <div className="flex-1"><p className="text-sm font-medium text-teal-800">{g.description}</p><p className="text-xs text-teal-600">{g.measurement} — {g.timeframe}</p></div>
                  <span className="text-xs text-teal-300">✎</span>
                </div>
              )}
            </div>
          ))}

          <button onClick={() => { setSchedule(buildInitialSchedule()); setStep('plan'); }} className="w-full mt-4 py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium">Próximo: ver o plano</button>
          <button onClick={() => setStep('extra')} className="w-full py-3 text-gray-400 text-sm mt-2">Voltar</button>
        </div>
      </div>
    );
  }

  // ============ STEP: PLAN ============
  if (step === 'plan' && planData) {
    const mp = planData.meal_plan_base || {};
    const ep = planData.exercise_plan_base || {};
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="p-6">
          <p className="text-xs text-teal-500 mb-1">Passo 3 de 3 — Seu plano</p>
          <h2 className="text-lg font-medium mb-4">Seu plano</h2>

          <div className="bg-teal-50 rounded-2xl p-4 mb-4">
            <p className="text-sm font-medium text-teal-800 mb-2">Alimentação</p>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] text-teal-600">Calorias</label><input type="number" value={mp.calories || ''} onChange={e => updateMealPlan('calories', Number(e.target.value))} className="w-full text-sm border rounded-lg px-2 py-1 bg-white" /></div>
              <div><label className="text-[10px] text-teal-600">Refeições/dia</label><select value={mp.meals_per_day || 5} onChange={e => updateMealPlan('meals_per_day', Number(e.target.value))} className="w-full text-sm border rounded-lg px-2 py-1 bg-white">{[3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
              <div><label className="text-[10px] text-teal-600">Proteína(g)</label><input type="number" value={mp.protein_g || ''} onChange={e => updateMealPlan('protein_g', Number(e.target.value))} className="w-full text-sm border rounded-lg px-2 py-1 bg-white" /></div>
              <div><label className="text-[10px] text-teal-600">Carbo(g)</label><input type="number" value={mp.carbs_g || ''} onChange={e => updateMealPlan('carbs_g', Number(e.target.value))} className="w-full text-sm border rounded-lg px-2 py-1 bg-white" /></div>
              <div><label className="text-[10px] text-teal-600">Gordura(g)</label><input type="number" value={mp.fat_g || ''} onChange={e => updateMealPlan('fat_g', Number(e.target.value))} className="w-full text-sm border rounded-lg px-2 py-1 bg-white" /></div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-4 mb-4">
            <p className="text-sm font-medium text-blue-800 mb-2">Exercícios</p>
            <select value={ep.weekly_frequency} onChange={e => updateExercisePlan('weekly_frequency', Number(e.target.value))} className="text-sm bg-white border rounded-lg px-2 py-1">
              {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}x por semana</option>)}
            </select>
          </div>

          {planData.scientific_rationale && (
            <div className="bg-purple-50 rounded-2xl p-4 mb-6">
              <p className="text-sm font-medium text-purple-800 mb-1">Por que esse plano?</p>
              <p className="text-xs text-purple-700 leading-relaxed">{planData.scientific_rationale}</p>
            </div>
          )}

          <button onClick={() => setStep('schedule')} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium">Próximo: programar seus dias</button>
          <button onClick={() => setStep('goals')} className="w-full py-3 text-gray-400 text-sm mt-2">Voltar</button>
        </div>
      </div>
    );
  }

  // ============ STEP: SCHEDULE ============
  if (step === 'schedule') {
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="p-6">
          <p className="text-xs text-teal-500 mb-1">Passo 3 de 3 — Seu plano</p>
          <h2 className="text-lg font-medium mb-1">Programe seus próximos 10 dias</h2>
          <p className="text-xs text-gray-400 mb-4">Para cada dia, diga se estará em casa ou fora e se tem academia</p>

          <div className="space-y-2 mb-6">
            {schedule.map((day, i) => {
              const dateObj = new Date(day.date + 'T12:00:00');
              const dateLabel = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
              const isToday = day.date === getLocalToday();
              return (
                <div key={i} className={`rounded-xl p-3 ${isToday ? 'bg-teal-50 border border-teal-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{day.dayLabel}</span>
                      <span className="text-xs text-gray-400">{dateLabel}</span>
                      {isToday && <span className="text-xs text-teal-500">hoje</span>}
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                      <input type="checkbox" checked={day.has_gym} onChange={() => toggleSchedule(i, 'has_gym')} className="rounded" />
                      Academia
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['morning', 'afternoon', 'evening'] as const).map(period => {
                      const labels = { morning: 'Manhã', afternoon: 'Tarde', evening: 'Noite' };
                      const val = day[period];
                      return (
                        <button key={period} onClick={() => toggleSchedule(i, period)}
                          className={`text-xs py-1.5 rounded-lg font-medium ${val === 'casa' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                          {labels[period]}: {val === 'casa' ? 'Casa' : 'Fora'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 mb-4">
            <p className="text-sm font-medium text-center text-gray-600">Como quer prosseguir?</p>
            <button onClick={submitAutoGenerate} disabled={loading} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-50">
              {loading ? 'Gerando seu plano...' : '⚡ Gerar plano agora com a ninAI'}
            </button>
            <p className="text-xs text-gray-400 text-center -mt-1">Seu cardápio fica pronto na hora</p>
            <div className="flex items-center gap-3 my-2"><div className="flex-1 h-px bg-gray-200" /><span className="text-xs text-gray-400">ou</span><div className="flex-1 h-px bg-gray-200" /></div>
            <button onClick={submitToNina} disabled={loading} className="w-full py-4 border-2 border-teal-300 text-teal-700 rounded-2xl text-sm font-medium disabled:opacity-50">
              {loading ? 'Enviando...' : '👩‍⚕️ Enviar para a Nina aprovar'}
            </button>
            <p className="text-xs text-gray-400 text-center -mt-1">A Nina revisa e ajusta antes de liberar</p>
          </div>

          <button onClick={() => setStep('plan')} className="w-full py-3 text-gray-400 text-sm">Voltar</button>
        </div>
      </div>
    );
  }

  // ============ COMPLETE: NINA ============
  if (step === 'complete_nina') {
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="text-center py-8 px-6">
          <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-xl font-medium mb-2">Plano enviado!</h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">Seu plano foi enviado para a Nina revisar e aprovar.</p>
          <button onClick={() => window.location.href = '/dashboard'} className="mt-6 px-6 py-3 bg-teal-400 text-white rounded-xl text-sm font-medium">Ir para o app</button>
        </div>
      </div>
    );
  }

  // ============ COMPLETE: AUTO ============
  if (step === 'complete_auto') {
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="text-center py-8 px-6">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="text-xl font-medium mb-2">Plano pronto!</h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">Seu plano foi gerado e já está ativo. Você pode começar agora!</p>
          <button onClick={() => window.location.href = '/dashboard'} className="mt-6 px-6 py-3 bg-teal-400 text-white rounded-xl text-sm font-medium">Começar!</button>
        </div>
      </div>
    );
  }

  // Loading fallback
  return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-gray-400">Carregando...</p></div>;
}
