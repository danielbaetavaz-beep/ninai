'use client';
import { useState, useRef, useEffect } from 'react';

interface Message { role: 'user' | 'assistant'; content: string; }

export default function ChatTab({ plan }: { plan: any }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Como posso te ajudar? Pode me mandar foto de um cardápio, perguntar sobre o que comer, ou tirar qualquer dúvida sobre seu plano.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: newMsgs.slice(-10),
        mode: 'general',
        planContext: {
          goals: plan.goals,
          meal_plan_base: plan.meal_plan_base,
          exercise_plan_base: plan.exercise_plan_base,
        },
      }),
    });
    const data = await res.json();
    setMessages([...newMsgs, { role: 'assistant', content: data.text || 'Desculpe, tive um problema. Tenta de novo?' }]);
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <div className="p-4 pb-0">
        <p className="text-lg font-medium mb-2">Chat com a nin<span className="text-teal-400">AI</span></p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
        {loading && <div className="flex justify-start"><div className="bg-teal-50 text-teal-600 px-4 py-3 rounded-2xl rounded-tl-sm text-sm">Pensando...</div></div>}
        <div ref={bottomRef} />
      </div>
      <div className="p-4 border-t border-gray-100">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Pergunte qualquer coisa..." className="flex-1 px-4 py-3 rounded-full border border-gray-200 text-sm focus:outline-none focus:border-teal-400" disabled={loading} />
          <button onClick={send} disabled={loading || !input.trim()} className="px-5 py-3 rounded-full bg-teal-400 text-white text-sm font-medium disabled:opacity-50">Enviar</button>
        </div>
      </div>
    </div>
  );
}
