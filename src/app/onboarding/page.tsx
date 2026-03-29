'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Onboarding() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [planData, setPlanData] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initOnboarding();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function initOnboarding() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }

    const params = new URLSearchParams(window.location.search);
    let pid = params.get('plan');

    if (pid) {
      const { data: plan } = await supabase.from('plans').select('*').eq('id', pid).single();
      if (plan && plan.onboarding_conversation?.length > 0) {
        setPlanId(pid);
        setMessages(plan.onboarding_conversation);
        return;
      }
    }

    if (!pid) {
      const { data: newPlan } = await supabase.from('plans').insert({
        patient_id: session.user.id,
        status: 'onboarding',
      }).select().single();
      pid = newPlan?.id;
      setPlanId(pid!);
    }

    setLoading(true);
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Olá, quero criar meu plano.' }], mode: 'onboarding' }),
    });
    const data = await res.json();
    const initialMessages: Message[] = [{ role: 'assistant', content: data.text }];
    setMessages(initialMessages);
    await saveChatState(pid!, initialMessages);
    setLoading(false);
  }

  async function saveChatState(pid: string, msgs: Message[]) {
    await supabase.from('plans').update({ onboarding_conversation: msgs }).eq('id', pid);
  }

  async function send() {
    if (!input.trim() || loading || !planId) return;
    const userMsg: Message = { role: 'user', content: input };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMsgs, mode: 'onboarding' }),
    });
    const data = await res.json();

    if (data.error) {
      setLoading(false);
      return;
    }

    const aiMsg: Message = { role: 'assistant', content: data.text };
    const allMsgs = [...newMsgs, aiMsg];
    setMessages(allMsgs);
    await saveChatState(planId, allMsgs);

    if (data.isComplete && data.planData) {
      setPlanData(data.planData);
      setComplete(true);
      await supabase.from('plans').update({
        status: 'pending_review',
        duration_months: data.planData.duration_months,
        goals: data.planData.goals,
        meal_plan_base: data.planData.meal_plan_base,
        exercise_plan_base: data.planData.exercise_plan_base,
        scientific_rationale: data.planData.scientific_rationale,
        onboarding_conversation: allMsgs,
      }).eq('id', planId);

      // Generate technical diagnosis for Nina
      fetch('/api/diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: allMsgs, planData: data.planData }),
      }).then(r => r.json()).then(d => {
        if (d.diagnosis) {
          supabase.from('plans').update({ technical_diagnosis: d.diagnosis }).eq('id', planId);
        }
      });

      // Create alert for Nina
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('alerts').insert({
          patient_id: session.user.id,
          plan_id: planId,
          type: 'plan_ready',
          message: 'Novo plano pronto para revisão',
        });
      }
    }

    setLoading(false);
  }

  if (complete) {
    return (
      <div className="min-h-screen p-4">
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-xl font-medium mb-2">Plano criado!</h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
            Seu plano foi enviado para a Nina revisar. Ela vai analisar suas metas e o plano alimentar, e pode aprovar diretamente ou solicitar uma consulta antes.
          </p>
          <p className="text-gray-400 text-xs mt-4">Você receberá uma notificação quando o plano for aprovado.</p>
          <div className="mt-6 bg-teal-50 rounded-xl p-4 text-left">
            <p className="text-sm font-medium text-teal-800 mb-2">Resumo do seu plano:</p>
            <p className="text-xs text-teal-700">Duração: {planData?.duration_months} meses</p>
            <p className="text-xs text-teal-700">Metas: {planData?.goals?.length || 0} definidas</p>
            <p className="text-xs text-teal-700">Calorias/dia: ~{planData?.meal_plan_base?.calories} kcal</p>
            <p className="text-xs text-teal-700">Exercício: {planData?.exercise_plan_base?.weekly_frequency}x/semana</p>
          </div>
          <button onClick={() => window.location.href = '/dashboard'} className="mt-6 px-6 py-3 bg-teal-400 text-white rounded-xl text-sm font-medium">
            Ir para o app
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 border-b border-gray-100">
        <h1 className="text-lg font-medium">
          nin<span className="text-teal-400">AI</span>
          <span className="text-gray-400 text-sm font-normal ml-2">Criando seu plano</span>
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'assistant'
                ? 'bg-teal-50 text-teal-900 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'
                : 'bg-gray-100 text-gray-800 rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-teal-50 text-teal-600 px-4 py-3 rounded-2xl rounded-tl-sm text-sm">
              Pensando...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Digite sua resposta..."
            className="flex-1 px-4 py-3 rounded-full border border-gray-200 text-sm focus:outline-none focus:border-teal-400"
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-5 py-3 rounded-full bg-teal-400 text-white text-sm font-medium disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
