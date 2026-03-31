'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import ExpandingInput from '@/components/ExpandingInput';

interface Message { role: 'user' | 'assistant'; content: string; }

export default function ChatTab({ plan }: { plan: any }) {
  const [chatMode, setChatMode] = useState<'ai' | 'nina'>('ai');
  const [aiMessages, setAiMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Como posso te ajudar? Pode me perguntar sobre o que comer, tirar dúvidas sobre seu plano, ou pedir sugestões.' }
  ]);
  const [ninaMessages, setNinaMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unreadNina, setUnreadNina] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (chatMode === 'nina') loadNinaMessages(); }, [chatMode]);
  useEffect(() => { checkUnread(); const i = setInterval(checkUnread, 10000); return () => clearInterval(i); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages, ninaMessages]);

  async function checkUnread() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('direct_messages').select('id').eq('plan_id', plan.id).eq('sender_role', 'nutritionist').eq('read', false);
    setUnreadNina(data?.length || 0);
  }

  async function loadNinaMessages() {
    const { data } = await supabase.from('direct_messages').select('*').eq('plan_id', plan.id).order('created_at', { ascending: true });
    setNinaMessages(data || []);
    // Mark as read
    const { data: { session } } = await supabase.auth.getSession();
    if (session && data) {
      const unread = data.filter(m => !m.read && m.sender_role === 'nutritionist');
      for (const m of unread) await supabase.from('direct_messages').update({ read: true }).eq('id', m.id);
      setUnreadNina(0);
    }
  }

  async function sendAI() {
    if (!input.trim() || loading) return;
    const newMsgs = [...aiMessages, { role: 'user' as const, content: input }];
    setAiMessages(newMsgs);
    setInput('');
    setLoading(true);
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: newMsgs.slice(-10), mode: 'general', planContext: { goals: plan.goals, meal_plan_base: plan.meal_plan_base, exercise_plan_base: plan.exercise_plan_base } }) });
    const data = await res.json();
    setAiMessages([...newMsgs, { role: 'assistant', content: data.text || 'Desculpe, tive um problema.' }]);
    setLoading(false);
  }

  async function sendNina() {
    if (!input.trim() || loading) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('direct_messages').insert({ plan_id: plan.id, sender_id: session.user.id, sender_role: 'patient', content: input });
    }
    setInput('');
    setLoading(false);
    await loadNinaMessages();
  }

  const messages = chatMode === 'ai' ? aiMessages : ninaMessages;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Mode toggle */}
      <div className="flex border-b border-gray-100 px-4">
        <button onClick={() => setChatMode('ai')} className={`flex-1 py-2.5 text-xs font-medium text-center border-b-2 ${chatMode === 'ai' ? 'text-teal-600 border-teal-400' : 'text-gray-400 border-transparent'}`}>
          🤖 ninAI
        </button>
        <button onClick={() => setChatMode('nina')} className={`flex-1 py-2.5 text-xs font-medium text-center border-b-2 relative ${chatMode === 'nina' ? 'text-teal-600 border-teal-400' : 'text-gray-400 border-transparent'}`}>
          👩‍⚕️ Nina
          {unreadNina > 0 && <span className="absolute -top-0.5 right-4 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{unreadNina}</span>}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {chatMode === 'ai' && aiMessages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'assistant' ? 'bg-teal-50 text-teal-900 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl' : 'bg-gray-100 text-gray-800 rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl'}`}>{m.content}</div>
          </div>
        ))}
        {chatMode === 'nina' && ninaMessages.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Nenhuma mensagem com a Nina. Mande a primeira!</p>}
        {chatMode === 'nina' && ninaMessages.map((m, i) => (
          <div key={i} className={`flex ${m.sender_role === 'patient' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${m.sender_role === 'patient' ? 'bg-gray-100 text-gray-800 rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl' : 'bg-purple-50 text-purple-900 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'}`}>
              {m.content}
              <p className="text-[10px] text-gray-400 mt-1">{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-teal-50 text-teal-600 px-4 py-3 rounded-2xl rounded-tl-sm text-sm">...</div></div>}
        <div ref={bottomRef} />
      </div>

      <ExpandingInput value={input} onChange={setInput} onSend={chatMode === 'ai' ? sendAI : sendNina} disabled={loading} placeholder={chatMode === 'ai' ? 'Pergunte à ninAI...' : 'Mensagem para a Nina...'} />
    </div>
  );
}
