'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import ExpandingInput from '@/components/ExpandingInput';

interface Message { role: 'user' | 'assistant'; content: string; }

export default function Onboarding() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [planData, setPlanData] = useState<any>(null);
  const [showGoals, setShowGoals] = useState(false);
  const [showPlanProposal, setShowPlanProposal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { initOnboarding(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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
      setShowGoals(true);
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
    
    // If meals_per_day changed, adjust meal_names
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

  async function acceptGoals() {
    setShowGoals(false);
    setShowPlanProposal(true);
  }

  async function acceptPlan() {
    setShowPlanProposal(false);
    setComplete(true);
    if (!planId || !planData) return;

    await supabase.from('plans').update({
      status: 'pending_review', duration_months: planData.duration_months, goals: planData.goals,
      meal_plan_base: planData.meal_plan_base, exercise_plan_base: planData.exercise_plan_base,
      scientific_rationale: planData.scientific_rationale, onboarding_conversation: messages,
    }).eq('id', planId);

    fetch('/api/diagnosis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation: messages, planData }) })
      .then(r => r.json()).then(d => { if (d.diagnosis) supabase.from('plans').update({ technical_diagnosis: d.diagnosis }).eq('id', planId); });

    const { data: { session } } = await supabase.auth.getSession();
    if (session) await supabase.from('alerts').insert({ patient_id: session.user.id, plan_id: planId, type: 'plan_ready', message: 'Novo plano pronto para revisão' });
  }

  const headerWithLogout = (
    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
      <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span></h1>
      <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} className="text-sm text-gray-400">Sair</button>
    </div>
  );

  // EDITABLE GOALS SCREEN
  if (showGoals && planData) {
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
            </div>
            <h2 className="text-xl font-medium mb-1">Suas metas</h2>
            <p className="text-sm text-gray-400">Toque em qualquer meta para ajustar</p>
            
            {/* Editable duration */}
            <div className="mt-3 inline-flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2">
              <span className="text-sm text-gray-500">Duração:</span>
              <select 
                value={planData.duration_months} 
                onChange={e => setPlanData({ ...planData, duration_months: Number(e.target.value) })}
                className="text-sm font-medium bg-transparent text-teal-700 focus:outline-none"
              >
                {[3,4,5,6,7,8,9,10,12].map(m => <option key={m} value={m}>{m} meses</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            {(planData.goals || []).map((g: any, i: number) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-4 cursor-pointer" onClick={() => setEditingGoal(editingGoal === i ? null : i)}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-400 flex items-center justify-center text-white text-sm font-medium shrink-0 mt-0.5">{i + 1}</div>
                  <div className="flex-1">
                    {editingGoal === i ? (
                      <div className="space-y-2" onClick={e => e.stopPropagation()}>
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase">Descrição</label>
                          <input value={g.description || g.type || ''} onChange={e => updateGoal(i, 'description', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase">Como medir</label>
                          <input value={g.measurement || ''} onChange={e => updateGoal(i, 'measurement', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase">Prazo</label>
                          <input value={g.timeframe || ''} onChange={e => updateGoal(i, 'timeframe', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase">Meta (valor alvo)</label>
                          <input value={g.target || ''} onChange={e => updateGoal(i, 'target', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400" />
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setEditingGoal(null); }} className="text-xs text-teal-600 font-medium mt-1">✓ Pronto</button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium mb-1">{g.description || g.type}</p>
                        <p className="text-xs text-gray-400">{g.measurement}</p>
                        <p className="text-xs text-teal-600 mt-1">{g.timeframe}</p>
                        <p className="text-[10px] text-gray-300 mt-1">toque para editar</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={acceptGoals} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium">Aceitar metas e ver plano</button>
          <button onClick={() => setShowGoals(false)} className="w-full py-3 text-gray-400 text-sm mt-2">Voltar para conversa</button>
        </div>
      </div>
    );
  }

  // EDITABLE PLAN PROPOSAL SCREEN
  if (showPlanProposal && planData) {
    const mp = planData.meal_plan_base || {};
    const ep = planData.exercise_plan_base || {};
    return (
      <div className="min-h-screen bg-white">{headerWithLogout}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#378ADD" strokeWidth="2" strokeLinecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <h2 className="text-xl font-medium mb-1">Seu plano</h2>
            <p className="text-sm text-gray-400">Toque nos valores para ajustar</p>
          </div>

          {/* Editable meal plan */}
          <div className="bg-teal-50 rounded-2xl p-4 mb-4">
            <p className="text-sm font-medium text-teal-800 mb-3">Plano alimentar</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <EditableCard label="kcal/dia" value={mp.calories} onChange={v => updateMealPlan('calories', Number(v))} />
              <EditableCard label="proteína (g)" value={mp.protein_g} onChange={v => updateMealPlan('protein_g', Number(v))} suffix="g" />
              <div className="bg-white rounded-xl p-2 text-center">
                <select value={mp.meals_per_day || 5} onChange={e => updateMealPlan('meals_per_day', Number(e.target.value))} className="text-base font-medium bg-transparent text-center w-full focus:outline-none">
                  {[3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <p className="text-[10px] text-gray-400">refeições</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EditableCard label="carboidratos (g)" value={mp.carbs_g} onChange={v => updateMealPlan('carbs_g', Number(v))} suffix="g" />
              <EditableCard label="gordura (g)" value={mp.fat_g} onChange={v => updateMealPlan('fat_g', Number(v))} suffix="g" />
            </div>
            {mp.free_meals_note && (
              <div className="mt-3 bg-white/60 rounded-xl p-3">
                <p className="text-xs text-teal-700">🍽️ {mp.free_meals_note}</p>
              </div>
            )}
            {mp.guidelines?.length > 0 && <div className="text-xs text-teal-700 space-y-1 mt-3">{mp.guidelines.map((g: string, i: number) => <p key={i}>• {g}</p>)}</div>}
          </div>

          {/* Editable exercise plan */}
          <div className="bg-blue-50 rounded-2xl p-4 mb-4">
            <p className="text-sm font-medium text-blue-800 mb-3">Plano de exercícios</p>
            <div className="bg-white rounded-xl p-3 mb-3 text-center">
              <select value={ep.weekly_frequency} onChange={e => updateExercisePlan('weekly_frequency', Number(e.target.value))} className="text-2xl font-medium text-blue-800 bg-transparent text-center focus:outline-none">
                {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}x</option>)}
              </select>
              <p className="text-xs text-gray-400">por semana</p>
            </div>
            {ep.activities?.map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-2 py-2"><div className="w-2 h-2 rounded-full bg-blue-400" /><span className="text-sm">{a.type}</span><span className="text-xs text-gray-400 ml-auto">{a.frequency}</span></div>
            ))}
          </div>

          {planData.scientific_rationale && (
            <div className="bg-purple-50 rounded-2xl p-4 mb-6">
              <p className="text-sm font-medium text-purple-800 mb-2">Por que esse plano?</p>
              <p className="text-xs text-purple-700 leading-relaxed whitespace-pre-wrap">{planData.scientific_rationale}</p>
            </div>
          )}

          <button onClick={acceptPlan} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium">Aceitar plano e enviar para a Nina</button>
          <button onClick={() => { setShowPlanProposal(false); setShowGoals(true); }} className="w-full py-3 text-gray-400 text-sm mt-2">Voltar para as metas</button>
        </div>
      </div>
    );
  }

  if (complete) {
    return (
      <div className="min-h-screen">{headerWithLogout}
        <div className="text-center py-8 px-6">
          <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-xl font-medium mb-2">Plano criado!</h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">Seu plano de {planData?.duration_months} meses foi enviado para a Nina revisar.</p>
          <div className="mt-6 bg-teal-50 rounded-xl p-4 text-left">
            <p className="text-sm font-medium text-teal-800 mb-2">Próximos passos:</p>
            <p className="text-xs text-teal-700 mb-1">1. A Nina vai analisar seu plano</p>
            <p className="text-xs text-teal-700 mb-1">2. Ela pode aprovar direto ou pedir uma consulta</p>
            <p className="text-xs text-teal-700 mb-1">3. Depois da aprovação, montamos seu cardápio semanal</p>
            <p className="text-xs text-teal-700">4. Você começa a registrar suas refeições!</p>
          </div>
          <div className="mt-4 bg-gray-50 rounded-xl p-4 text-left">
            <p className="text-sm font-medium text-gray-600 mb-2">Resumo:</p>
            <p className="text-xs text-gray-500">Duração: {planData?.duration_months} meses</p>
            <p className="text-xs text-gray-500">Metas: {planData?.goals?.length || 0}</p>
            <p className="text-xs text-gray-500">~{planData?.meal_plan_base?.calories} kcal/dia em {planData?.meal_plan_base?.meals_per_day || 5} refeições</p>
            <p className="text-xs text-gray-500">Exercício: {planData?.exercise_plan_base?.weekly_frequency}x/semana</p>
          </div>
          <button onClick={() => window.location.href = '/dashboard'} className="mt-6 px-6 py-3 bg-teal-400 text-white rounded-xl text-sm font-medium">Ir para o app</button>
        </div>
      </div>
    );
  }

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

// Inline editable card component
function EditableCard({ label, value, onChange, suffix }: { label: string; value: any; onChange: (v: string) => void; suffix?: string }) {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(String(value));

  if (editing) {
    return (
      <div className="bg-white rounded-xl p-2 text-center border-2 border-teal-300">
        <input
          type="number"
          value={tempVal}
          onChange={e => setTempVal(e.target.value)}
          onBlur={() => { onChange(tempVal); setEditing(false); }}
          onKeyDown={e => { if (e.key === 'Enter') { onChange(tempVal); setEditing(false); } }}
          autoFocus
          className="text-base font-medium w-full text-center bg-transparent focus:outline-none"
        />
        <p className="text-[10px] text-gray-400">{label}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-2 text-center cursor-pointer hover:border-teal-200 border border-transparent transition-colors" onClick={() => { setTempVal(String(value)); setEditing(true); }}>
      <p className="text-base font-medium">{value}{suffix || ''}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}
