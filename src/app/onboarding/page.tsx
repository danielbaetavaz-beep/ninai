'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday, toLocalDateStr } from '@/lib/dates';
import ExpandingInput from '@/components/ExpandingInput';

interface Message { role: 'user' | 'assistant'; content: string; }

export default function Onboarding() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [step, setStep] = useState<'chat' | 'goals' | 'plan' | 'schedule' | 'complete_nina' | 'complete_auto'>('chat');
  const [planData, setPlanData] = useState<any>(null);
  const [editingGoal, setEditingGoal] = useState<number | null>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { initOnboarding(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Build 10 days from today
  function buildInitialSchedule() {
    const days: any[] = [];
    const dayLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    for (let i = 0; i < 10; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = toLocalDateStr(d);
      days.push({
        date: dateStr,
        dayLabel: dayLabels[d.getDay()],
        morning: 'casa',
        afternoon: 'casa',
        evening: 'casa',
        has_gym: false,
      });
    }
    return days;
  }

  async function initOnboarding() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }

    const params = new URLSearchParams(window.location.search);
    let pid = params.get('plan');

    if (pid) {
      setPlanId(pid);
      const { data: plan } = await supabase.from('plans').select('*').eq('id', pid).single();
      if (plan && plan.onboarding_conversation?.length > 0) {
        setMessages(plan.onboarding_conversation);
        return;
      }
    }

    if (!pid) {
      const { data: newPlan } = await supabase.from('plans').insert({ patient_id: session.user.id, status: 'onboarding' }).select().single();
      pid = newPlan?.id;
      setPlanId(pid!);
    }

    setLoading(true);
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Olá, quero criar meu plano.' }], mode: 'onboarding' }) });
    const data = await res.json();
    const initialMessages: Message[] = [{ role: 'assistant', content: data.text }];
    setMessages(initialMessages);
    await supabase.from('plans').update({ onboarding_conversation: initialMessages }).eq('id', pid);
    setLoading(false);
  }

  async function send() {
    if (!input.trim() || loading || !planId) return;
    const userMsg: Message = { role: 'user', content: input };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: newMsgs, mode: 'onboarding' }) });
    const data = await res.json();
    if (data.error) { setLoading(false); return; }

    const aiMsg: Message = { role: 'assistant', content: data.text };
    const allMsgs = [...newMsgs, aiMsg];
    setMessages(allMsgs);
    await supabase.from('plans').update({ onboarding_conversation: allMsgs }).eq('id', planId);

    if (data.isComplete && data.planData) {
      setPlanData(data.planData);
      setStep('goals');
    }
    setLoading(false);
  }

  function updateGoal(index: number, field: string, value: string) {
    const updated = { ...planData };
    updated.goals = [...updated.goals];
    updated.goals[index] = { ...updated.goals[index], [field]: value };
    setPlanData(updated);
  }

  function updateMealPlan(field: string, value: any) {
    const updated = { ...planData };
    updated.meal_plan_base = { ...updated.meal_plan_base, [field]: value };
    if (field === 'meals_per_day') {
      const num = Number(value);
      const allMealNames = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'];
      updated.meal_plan_base.meal_names = allMealNames.slice(0, num);
    }
    setPlanData(updated);
  }

  function updateExercisePlan(field: string, value: any) {
    const updated = { ...planData };
    updated.exercise_plan_base = { ...updated.exercise_plan_base, [field]: value };
    setPlanData(updated);
  }

  function toggleSchedule(index: number, field: string) {
    setSchedule(prev => {
      const updated = [...prev];
      if (field === 'has_gym') {
        updated[index] = { ...updated[index], has_gym: !updated[index].has_gym };
      } else {
        updated[index] = { ...updated[index], [field]: updated[index][field] === 'casa' ? 'fora' : 'casa' };
      }
      return updated;
    });
  }

  async function submitToNina() {
    if (!planId || !planData) return;
    setLoading(true);

    await supabase.from('plans').update({
      status: 'pending_review',
      duration_months: planData.duration_months,
      goals: planData.goals,
      meal_plan_base: planData.meal_plan_base,
      exercise_plan_base: planData.exercise_plan_base,
      scientific_rationale: planData.scientific_rationale,
      onboarding_conversation: messages,
      initial_schedule: schedule,
    }).eq('id', planId);

    // Generate diagnosis in background
    fetch('/api/diagnosis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation: messages, planData }) })
      .then(r => r.json()).then(d => { if (d.diagnosis) supabase.from('plans').update({ technical_diagnosis: d.diagnosis }).eq('id', planId); });

    // Generate detailed plan for Nina to review
    const res = await fetch('/api/generate-daily-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: schedule, mealPlanBase: planData.meal_plan_base, exercisePlanBase: planData.exercise_plan_base, goals: planData.goals }),
    });
    const detailedPlan = await res.json();
    await supabase.from('plans').update({ detailed_plan: detailedPlan }).eq('id', planId);

    // Alert Nina
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await supabase.from('alerts').insert({ patient_id: session.user.id, plan_id: planId, type: 'plan_ready', message: 'Novo plano pronto para revisão (com cardápio de 10 dias)' });

    setStep('complete_nina');
    setLoading(false);
  }

  async function submitAutoGenerate() {
    if (!planId || !planData) return;
    setLoading(true);

    // Generate detailed plan
    const res = await fetch('/api/generate-daily-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: schedule, mealPlanBase: planData.meal_plan_base, exercisePlanBase: planData.exercise_plan_base, goals: planData.goals }),
    });
    const detailedPlan = await res.json();

    // Save plan as approved directly
    await supabase.from('plans').update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      start_date: getLocalToday(),
      duration_months: planData.duration_months,
      goals: planData.goals,
      meal_plan_base: planData.meal_plan_base,
      exercise_plan_base: planData.exercise_plan_base,
      scientific_rationale: planData.scientific_rationale,
      onboarding_conversation: messages,
      initial_schedule: schedule,
      detailed_plan: detailedPlan,
    }).eq('id', planId);

    // Save daily_schedule and daily_plans
    for (const day of schedule) {
      await supabase.from('daily_schedule').upsert({
        plan_id: planId, date: day.date,
        morning: day.morning, afternoon: day.afternoon, evening: day.evening, has_gym: day.has_gym,
      }, { onConflict: 'plan_id,date' });
    }

    if (detailedPlan.days) {
      for (const day of detailedPlan.days) {
        await supabase.from('daily_plans').upsert({
          plan_id: planId, date: day.date, meals: day.meals, exercise: day.exercise, status: 'active',
        }, { onConflict: 'plan_id,date' });
      }
    }

    // Generate diagnosis in background
    fetch('/api/diagnosis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation: messages, planData }) })
      .then(r => r.json()).then(d => { if (d.diagnosis) supabase.from('plans').update({ technical_diagnosis: d.diagnosis }).eq('id', planId); });

    setStep('complete_auto');
    setLoading(false);
  }

  const headerWithLogout = (
    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
      <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span></h1>
      <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} className="text-sm text-gray-400">Sair</button>
    </div>
  );

  // STEP: GOALS (editable)
  if (step === 'goals' && planData) {
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-medium mb-1">Suas metas</h2>
            <p className="text-sm text-gray-400">Toque para ajustar</p>
            <div className="mt-3 inline-flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2">
              <span className="text-sm text-gray-500">Duração:</span>
              <select value={planData.duration_months} onChange={e => setPlanData({ ...planData, duration_months: Number(e.target.value) })} className="text-sm font-medium bg-transparent text-teal-700 focus:outline-none">
                {[3,4,5,6,7,8,9,10,12].map(m => <option key={m} value={m}>{m} meses</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-3 mb-6">
            {(planData.goals || []).map((g: any, i: number) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-4 cursor-pointer" onClick={() => setEditingGoal(editingGoal === i ? null : i)}>
                {editingGoal === i ? (
                  <div className="space-y-2" onClick={e => e.stopPropagation()}>
                    <input value={g.description || ''} onChange={e => updateGoal(i, 'description', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" placeholder="Descrição" />
                    <input value={g.measurement || ''} onChange={e => updateGoal(i, 'measurement', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" placeholder="Como medir" />
                    <input value={g.timeframe || ''} onChange={e => updateGoal(i, 'timeframe', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" placeholder="Prazo" />
                    <button onClick={() => setEditingGoal(null)} className="text-xs text-teal-600 font-medium">✓ Pronto</button>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-teal-400 flex items-center justify-center text-white text-sm font-medium shrink-0">{i + 1}</div>
                    <div>
                      <p className="text-sm font-medium">{g.description || g.type}</p>
                      <p className="text-xs text-gray-400">{g.measurement} — {g.timeframe}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => setStep('plan')} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium">Próximo: ver plano</button>
          <button onClick={() => setStep('chat')} className="w-full py-3 text-gray-400 text-sm mt-2">Voltar para conversa</button>
        </div>
      </div>
    );
  }

  // STEP: PLAN (editable macros, exercise)
  if (step === 'plan' && planData) {
    const mp = planData.meal_plan_base || {};
    const ep = planData.exercise_plan_base || {};
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="p-6">
          <h2 className="text-xl font-medium mb-1 text-center">Seu plano base</h2>
          <p className="text-sm text-gray-400 text-center mb-6">Toque nos valores para ajustar</p>

          <div className="bg-teal-50 rounded-2xl p-4 mb-4">
            <p className="text-sm font-medium text-teal-800 mb-3">Alimentação</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <EditableCard label="kcal/dia" value={mp.calories} onChange={v => updateMealPlan('calories', Number(v))} />
              <EditableCard label="proteína (g)" value={mp.protein_g} onChange={v => updateMealPlan('protein_g', Number(v))} />
              <div className="bg-white rounded-xl p-2 text-center">
                <select value={mp.meals_per_day || 5} onChange={e => updateMealPlan('meals_per_day', Number(e.target.value))} className="text-base font-medium bg-transparent text-center w-full focus:outline-none">
                  {[3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <p className="text-[10px] text-gray-400">refeições</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EditableCard label="carboidratos (g)" value={mp.carbs_g} onChange={v => updateMealPlan('carbs_g', Number(v))} />
              <EditableCard label="gordura (g)" value={mp.fat_g} onChange={v => updateMealPlan('fat_g', Number(v))} />
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-4 mb-4">
            <p className="text-sm font-medium text-blue-800 mb-3">Exercícios</p>
            <select value={ep.weekly_frequency} onChange={e => updateExercisePlan('weekly_frequency', Number(e.target.value))} className="text-lg font-medium text-blue-800 bg-transparent focus:outline-none mb-2">
              {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}x por semana</option>)}
            </select>
            {ep.activities?.map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-2 py-1"><div className="w-2 h-2 rounded-full bg-blue-400" /><span className="text-sm">{a.type} — {a.frequency}</span></div>
            ))}
          </div>

          {planData.scientific_rationale && (
            <div className="bg-purple-50 rounded-2xl p-4 mb-6">
              <p className="text-sm font-medium text-purple-800 mb-2">Por que esse plano?</p>
              <p className="text-xs text-purple-700 leading-relaxed whitespace-pre-wrap">{planData.scientific_rationale}</p>
            </div>
          )}

          <button onClick={() => { setSchedule(buildInitialSchedule()); setStep('schedule'); }} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium">Próximo: programar seus dias</button>
          <button onClick={() => setStep('goals')} className="w-full py-3 text-gray-400 text-sm mt-2">Voltar para metas</button>
        </div>
      </div>
    );
  }

  // STEP: SCHEDULE (10 days)
  if (step === 'schedule') {
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="p-6">
          <h2 className="text-xl font-medium mb-1 text-center">Programe seus próximos 10 dias</h2>
          <p className="text-sm text-gray-400 text-center mb-4">Para cada dia, diga se estará em casa ou fora e se tem academia</p>

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

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">ou</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <button onClick={submitToNina} disabled={loading} className="w-full py-4 border-2 border-teal-300 text-teal-700 rounded-2xl text-sm font-medium disabled:opacity-50">
              {loading ? 'Enviando...' : '👩‍⚕️ Enviar para a Nina aprovar'}
            </button>
            <p className="text-xs text-gray-400 text-center -mt-1">A Nina revisa e ajusta antes de liberar</p>
          </div>

          <button onClick={() => setStep('plan')} className="w-full py-3 text-gray-400 text-sm">Voltar para o plano</button>
        </div>
      </div>
    );
  }

  // STEP: COMPLETE — sent to Nina
  if (step === 'complete_nina') {
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="text-center py-8 px-6">
          <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-xl font-medium mb-2">Plano enviado!</h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">Seu plano com cardápio de 10 dias foi enviado para a Nina revisar e aprovar.</p>
          <div className="mt-6 bg-teal-50 rounded-xl p-4 text-left">
            <p className="text-sm font-medium text-teal-800 mb-2">Próximos passos:</p>
            <p className="text-xs text-teal-700 mb-1">1. A Nina vai analisar metas, plano e cardápio</p>
            <p className="text-xs text-teal-700 mb-1">2. Ela pode ajustar o que precisar e aprovar</p>
            <p className="text-xs text-teal-700">3. Após a aprovação, seu plano estará pronto!</p>
          </div>
          <button onClick={() => window.location.href = '/dashboard'} className="mt-6 px-6 py-3 bg-teal-400 text-white rounded-xl text-sm font-medium">Ir para o app</button>
        </div>
      </div>
    );
  }

  // STEP: COMPLETE — auto-generated
  if (step === 'complete_auto') {
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="text-center py-8 px-6">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="text-xl font-medium mb-2">Plano pronto!</h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">Seu plano com cardápio de 10 dias foi gerado e já está ativo. Você pode começar a registrar suas refeições agora!</p>
          <div className="mt-6 bg-green-50 rounded-xl p-4 text-left">
            <p className="text-sm font-medium text-green-800 mb-2">Tudo pronto:</p>
            <p className="text-xs text-green-700 mb-1">✓ {planData?.goals?.length || 0} metas definidas</p>
            <p className="text-xs text-green-700 mb-1">✓ ~{planData?.meal_plan_base?.calories} kcal/dia em {planData?.meal_plan_base?.meals_per_day || 5} refeições</p>
            <p className="text-xs text-green-700 mb-1">✓ Exercício {planData?.exercise_plan_base?.weekly_frequency}x/semana</p>
            <p className="text-xs text-green-700">✓ Cardápio de 10 dias gerado</p>
          </div>
          <button onClick={() => window.location.href = '/dashboard'} className="mt-6 px-6 py-3 bg-teal-400 text-white rounded-xl text-sm font-medium">Começar!</button>
        </div>
      </div>
    );
  }

  // STEP: CHAT (default)
  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span><span className="text-gray-400 text-sm font-normal ml-2">Criando seu plano</span></h1>
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} className="text-sm text-gray-400">Sair</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'assistant' ? 'bg-teal-50 text-teal-900 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl' : 'bg-gray-100 text-gray-800 rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl'}`}>{m.content}</div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-teal-50 text-teal-600 px-4 py-3 rounded-2xl rounded-tl-sm text-sm">Pensando...</div></div>}
        <div ref={bottomRef} />
      </div>
      <ExpandingInput value={input} onChange={setInput} onSend={send} disabled={loading} />
    </div>
  );
}

function EditableCard({ label, value, onChange }: { label: string; value: any; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(String(value));
  if (editing) {
    return (
      <div className="bg-white rounded-xl p-2 text-center border-2 border-teal-300">
        <input type="number" value={tempVal} onChange={e => setTempVal(e.target.value)} onBlur={() => { onChange(tempVal); setEditing(false); }} onKeyDown={e => { if (e.key === 'Enter') { onChange(tempVal); setEditing(false); } }} autoFocus className="text-base font-medium w-full text-center bg-transparent focus:outline-none" />
        <p className="text-[10px] text-gray-400">{label}</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl p-2 text-center cursor-pointer hover:border-teal-200 border border-transparent" onClick={() => { setTempVal(String(value)); setEditing(true); }}>
      <p className="text-base font-medium">{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}
