'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday } from '@/lib/dates';
import ExpandingInput from '@/components/ExpandingInput';

export default function NinaPanel() {
  const [profile, setProfile] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [patientStats, setPatientStats] = useState<Record<string, any>>({});
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [teachingSession, setTeachingSession] = useState<any>(null);
  const [tab, setTab] = useState<'dashboard' | 'patients' | 'materials' | 'chat'>('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (prof?.role !== 'nutritionist') { window.location.href = '/dashboard'; return; }
    setProfile(prof);

    const { data: plans } = await supabase.from('plans').select('*, profiles:patient_id(name, email)').order('created_at', { ascending: false });
    setPatients(plans || []);

    const { data: al } = await supabase.from('alerts').select('*, profiles:patient_id(name)').eq('read', false).order('created_at', { ascending: false });
    setAlerts(al || []);

    const { data: mats } = await supabase.from('nina_materials').select('*').order('created_at', { ascending: false });
    setMaterials(mats || []);

    const { data: kn } = await supabase.from('nina_knowledge').select('*').order('created_at', { ascending: false });
    setKnowledge(kn || []);

    // Load stats for active patients
    if (plans) {
      const activePlans = plans.filter(p => p.status === 'approved');
      const stats: Record<string, any> = {};
      const today = getLocalToday();
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth()+1).padStart(2,'0')}-${String(weekAgo.getDate()).padStart(2,'0')}`;

      for (const p of activePlans) {
        const [{ data: meals }, { data: exercises }] = await Promise.all([
          supabase.from('meals').select('flag, completed, date').eq('plan_id', p.id).gte('date', weekAgoStr),
          supabase.from('exercises').select('done, date').eq('plan_id', p.id).gte('date', weekAgoStr),
        ]);
        const totalMeals = meals?.length || 0;
        const greenMeals = meals?.filter(m => m.flag === 'green').length || 0;
        const completedMeals = meals?.filter(m => m.completed === true || (m.flag && m.completed !== false)).length || 0;
        const missedMeals = meals?.filter(m => m.completed === false).length || 0;
        const exerciseDone = exercises?.filter(e => e.done).length || 0;
        const exerciseTotal = exercises?.length || 0;
        const uniqueDays = new Set(meals?.map(m => m.date) || []).size;
        const daysNoRegistration = 7 - uniqueDays;

        stats[p.id] = { totalMeals, greenMeals, completedMeals, missedMeals, exerciseDone, exerciseTotal, daysNoRegistration, adherence: totalMeals > 0 ? Math.round((greenMeals / totalMeals) * 100) : 0 };
      }
      setPatientStats(stats);
    }
    setLoading(false);
  }

  async function markAlertRead(id: string) {
    await supabase.from('alerts').update({ read: true }).eq('id', id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Carregando...</p></div>;
  if (teachingSession) return <TeachingSession session={teachingSession} onDone={() => { setTeachingSession(null); loadData(); }} />;
  if (selectedChat) return <DirectChat plan={selectedChat} profile={profile} onBack={() => { setSelectedChat(null); }} />;
  if (selectedPlan) return <UnifiedPlanReview plan={selectedPlan} knowledge={knowledge} onBack={() => { setSelectedPlan(null); loadData(); }} />;

  const activePlans = patients.filter(p => p.status === 'approved');
  const pending = patients.filter(p => p.status === 'pending_review' || p.status === 'consultation_requested');

  return (
    <div className="min-h-screen">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span> <span className="text-gray-400 text-sm">— Nina</span></h1>
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} className="text-xs text-gray-400">Sair</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-4">
        {[
          { id: 'dashboard' as const, label: 'Visão geral' },
          { id: 'patients' as const, label: 'Pacientes' },
          { id: 'chat' as const, label: 'Mensagens' },
          { id: 'materials' as const, label: 'Materiais' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2.5 text-xs font-medium border-b-2 ${tab === t.id ? 'text-teal-600 border-teal-400' : 'text-gray-400 border-transparent'}`}>{t.label}</button>
        ))}
      </div>

      {/* DASHBOARD TAB */}
      {tab === 'dashboard' && (
        <div className="p-4">
          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Alertas ({alerts.length})</p>
              {alerts.map(a => (
                <div key={a.id} className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">{(a as any).profiles?.name || 'Paciente'}</p>
                    <p className="text-xs text-amber-700">{a.message}</p>
                  </div>
                  <button onClick={() => markAlertRead(a.id)} className="text-xs px-3 py-1.5 rounded-full bg-amber-100 text-amber-800">OK</button>
                </div>
              ))}
            </div>
          )}

          {/* Pending reviews */}
          {pending.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Para revisar ({pending.length})</p>
              {pending.map(p => (
                <div key={p.id} onClick={() => setSelectedPlan(p)} className="flex items-center gap-3 p-3 border border-teal-200 bg-teal-50 rounded-xl mb-2 cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-teal-400 flex items-center justify-center text-white text-sm font-medium">{(p as any).profiles?.name?.[0] || '?'}</div>
                  <div className="flex-1"><p className="text-sm font-medium text-teal-800">{(p as any).profiles?.name || 'Paciente'}</p><p className="text-xs text-teal-600">Plano para revisar</p></div>
                  <span className="text-xs text-teal-400">→</span>
                </div>
              ))}
            </div>
          )}

          {/* Active patients overview */}
          <p className="text-sm font-medium mb-2">Pacientes ativos ({activePlans.length})</p>
          {activePlans.map(p => {
            const stats = patientStats[p.id] || {};
            const needsAttention = stats.daysNoRegistration >= 3 || stats.adherence < 30;
            return (
              <div key={p.id} onClick={() => setSelectedPlan(p)} className={`p-3 rounded-xl mb-2 cursor-pointer border ${needsAttention ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-sm font-medium">{(p as any).profiles?.name?.[0] || '?'}</div>
                    <div>
                      <p className="text-sm font-medium">{(p as any).profiles?.name || 'Paciente'}</p>
                      {needsAttention && <span className="text-[10px] text-red-500">⚠ precisa de atenção</span>}
                    </div>
                  </div>
                  <div className={`text-lg font-medium ${stats.adherence >= 70 ? 'text-green-600' : stats.adherence >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{stats.adherence || 0}%</div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div><p className="text-xs font-medium">{stats.greenMeals || 0}/{stats.totalMeals || 0}</p><p className="text-[10px] text-gray-400">verdes</p></div>
                  <div><p className="text-xs font-medium">{stats.exerciseDone || 0}/{stats.exerciseTotal || 0}</p><p className="text-[10px] text-gray-400">exercício</p></div>
                  <div><p className="text-xs font-medium">{stats.missedMeals || 0}</p><p className="text-[10px] text-gray-400">puladas</p></div>
                  <div><p className="text-xs font-medium text-red-500">{stats.daysNoRegistration || 0}</p><p className="text-[10px] text-gray-400">s/ registro</p></div>
                </div>
              </div>
            );
          })}
          {activePlans.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhum paciente ativo</p>}
        </div>
      )}

      {/* PATIENTS TAB */}
      {tab === 'patients' && (
        <div className="p-4">
          {patients.map(p => (
            <div key={p.id} onClick={() => setSelectedPlan(p)} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl mb-2 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium">{(p as any).profiles?.name?.[0] || '?'}</div>
              <div className="flex-1">
                <p className="text-sm font-medium">{(p as any).profiles?.name || 'Paciente'}</p>
                <p className="text-xs text-gray-400">{p.status === 'approved' ? 'Ativo' : p.status === 'pending_review' ? 'Revisar' : p.status}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.status === 'approved' ? 'bg-green-50 text-green-800' : p.status === 'pending_review' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>{p.status === 'approved' ? 'Ativo' : p.status === 'pending_review' ? 'Revisar' : p.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* CHAT TAB */}
      {tab === 'chat' && (
        <div className="p-4">
          <p className="text-sm font-medium mb-3">Mensagens diretas</p>
          {patients.filter(p => p.status === 'approved').map(p => (
            <div key={p.id} onClick={() => setSelectedChat(p)} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl mb-2 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium">{(p as any).profiles?.name?.[0] || '?'}</div>
              <div className="flex-1"><p className="text-sm font-medium">{(p as any).profiles?.name || 'Paciente'}</p></div>
              <span className="text-xs text-gray-400">→</span>
            </div>
          ))}
          {patients.filter(p => p.status === 'approved').length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhum paciente ativo para conversar</p>}
        </div>
      )}

      {/* MATERIALS TAB */}
      {tab === 'materials' && (
        <div className="p-4">
          <p className="text-sm font-medium mb-2">Materiais de referência</p>
          <p className="text-xs text-gray-400 mb-4">Faça upload de PDFs e o app vai te fazer perguntas para aprender seu método.</p>

          <MaterialUploadAndTeach profile={profile} materials={materials} onStartTeaching={setTeachingSession} onUpload={async (file, desc) => {
            const fileName = `material_${Date.now()}_${file.name}`;
            await supabase.storage.from('nina-materials').upload(fileName, file);
            const { data: urlData } = supabase.storage.from('nina-materials').getPublicUrl(fileName);
            await supabase.from('nina_materials').insert({ uploaded_by: profile.id, name: file.name, description: desc, file_url: urlData.publicUrl, file_type: file.name.endsWith('.pdf') ? 'pdf' : 'other' });
            loadData();
          }} onDelete={async (id) => { await supabase.from('nina_materials').delete().eq('id', id); loadData(); }} />

          {/* Knowledge base */}
          {knowledge.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium mb-2">Conhecimento aprendido ({knowledge.length})</p>
              {knowledge.map(k => (
                <div key={k.id} className="bg-purple-50 rounded-xl p-3 mb-2">
                  <p className="text-sm font-medium text-purple-800">{k.title}</p>
                  <p className="text-xs text-purple-700 mt-1 leading-relaxed line-clamp-3">{k.content}</p>
                  <p className="text-[10px] text-purple-400 mt-1">{new Date(k.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Material upload + teaching trigger
function MaterialUploadAndTeach({ profile, materials, onStartTeaching, onUpload, onDelete }: any) {
  const [desc, setDesc] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedForTeach, setSelectedForTeach] = useState<Set<string>>(new Set());

  function toggleTeachSelect(id: string) {
    setSelectedForTeach(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function startTeaching() {
    const selected = materials.filter((m: any) => selectedForTeach.has(m.id));
    if (selected.length === 0) return;
    onStartTeaching({ materials: selected });
  }

  return (
    <div>
      <div className="bg-purple-50 rounded-xl p-4 mb-4">
        <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descrição (opcional)" className="w-full text-sm border border-purple-200 rounded-lg px-3 py-2 mb-2 bg-white" />
        <label className={`block w-full py-3 text-center rounded-xl text-sm font-medium cursor-pointer ${uploading ? 'bg-gray-300' : 'bg-purple-400 text-white'}`}>
          {uploading ? 'Enviando...' : 'Upload PDF / documento'}
          <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={async e => { if (e.target.files?.[0]) { setUploading(true); await onUpload(e.target.files[0], desc); setDesc(''); setUploading(false); } }} />
        </label>
      </div>

      {materials.length > 0 && (
        <div className="space-y-2 mb-4">
          {materials.map((m: any) => (
            <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${selectedForTeach.has(m.id) ? 'bg-purple-100 border border-purple-300' : 'bg-gray-50'}`} onClick={() => toggleTeachSelect(m.id)}>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedForTeach.has(m.id) ? 'bg-purple-400 border-purple-400' : 'border-gray-200'}`}>
                {selectedForTeach.has(m.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                <p className="text-xs text-gray-400">{m.description || 'Sem descrição'}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); onDelete(m.id); }} className="text-xs text-red-400">✕</button>
            </div>
          ))}
        </div>
      )}

      {selectedForTeach.size > 0 && (
        <button onClick={startTeaching} className="w-full py-3 bg-purple-500 text-white rounded-xl text-sm font-medium">
          🧠 Ensinar a ninAI ({selectedForTeach.size} material{selectedForTeach.size > 1 ? 'is' : ''})
        </button>
      )}
    </div>
  );
}

// Teaching session — conversation with Nina about materials
function TeachingSession({ session, onDone }: { session: any; onDone: () => void }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [knowledgeDraft, setKnowledgeDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { startSession(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function startSession() {
    setLoading(true);
    const materialNames = session.materials.map((m: any) => m.name);
    const materialContext = session.materials.map((m: any) => `[${m.name}]: ${m.description || 'Sem descrição'}`).join('\n');

    const res = await fetch('/api/process-material', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materialSummaries: materialContext, materialNames }) });
    const data = await res.json();
    setMessages([{ role: 'assistant', content: data.text }]);
    setLoading(false);
  }

  async function send() {
    if (!input.trim() || loading) return;
    const newMsgs = [...messages, { role: 'user', content: input }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    const materialContext = session.materials.map((m: any) => `[${m.name}]: ${m.description || ''}`).join('\n');
    const res = await fetch('/api/teach-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: newMsgs, materialContext }) });
    const data = await res.json();

    setMessages([...newMsgs, { role: 'assistant', content: data.text }]);
    if (data.isComplete && data.knowledge) setKnowledgeDraft(data.knowledge);
    setLoading(false);
  }

  async function approveKnowledge() {
    if (!knowledgeDraft) return;
    setSaving(true);
    await supabase.from('nina_knowledge').insert({
      title: `Aprendizado: ${session.materials.map((m: any) => m.name).join(', ')}`,
      content: knowledgeDraft,
      source_materials: session.materials.map((m: any) => ({ id: m.id, name: m.name })),
      conversation: messages,
      status: 'approved',
    });
    setSaving(false);
    onDone();
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={onDone} className="text-gray-400">← Voltar</button>
        <div><h2 className="text-lg font-medium">🧠 Sessão de aprendizado</h2><p className="text-xs text-gray-400">{session.materials.length} material(is)</p></div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'assistant' ? 'bg-purple-50 text-purple-900 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl' : 'bg-gray-100 text-gray-800 rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl'}`}>{m.content}</div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-purple-50 text-purple-600 px-4 py-3 rounded-2xl rounded-tl-sm text-sm">Pensando...</div></div>}

        {knowledgeDraft && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-sm font-medium text-green-800 mb-2">Resumo do aprendizado</p>
            <p className="text-xs text-green-700 leading-relaxed whitespace-pre-wrap">{knowledgeDraft}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={approveKnowledge} disabled={saving} className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">{saving ? 'Salvando...' : '✓ Aprovar e guardar'}</button>
              <button onClick={() => setKnowledgeDraft(null)} className="flex-1 py-2.5 border border-green-300 text-green-700 rounded-xl text-sm">Continuar conversa</button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!knowledgeDraft && <ExpandingInput value={input} onChange={setInput} onSend={send} disabled={loading} placeholder="Responda a pergunta..." />}
    </div>
  );
}

// Direct chat Nina <> Patient
function DirectChat({ plan, profile, onBack }: { plan: any; profile: any; onBack: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadMessages(); const interval = setInterval(loadMessages, 5000); return () => clearInterval(interval); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadMessages() {
    const { data } = await supabase.from('direct_messages').select('*').eq('plan_id', plan.id).order('created_at', { ascending: true });
    setMessages(data || []);
    // Mark unread messages as read
    if (data) {
      const unread = data.filter(m => !m.read && m.sender_role === 'patient');
      for (const m of unread) await supabase.from('direct_messages').update({ read: true }).eq('id', m.id);
    }
  }

  async function send() {
    if (!input.trim() || sending) return;
    setSending(true);
    await supabase.from('direct_messages').insert({ plan_id: plan.id, sender_id: profile.id, sender_role: 'nutritionist', content: input });
    setInput('');
    setSending(false);
    await loadMessages();
  }

  const patientName = (plan as any).profiles?.name || 'Paciente';

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400">← Voltar</button>
        <h2 className="text-lg font-medium">{patientName}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Nenhuma mensagem ainda. Comece a conversa!</p>}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.sender_role === 'nutritionist' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${m.sender_role === 'nutritionist' ? 'bg-teal-50 text-teal-900 rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl' : 'bg-gray-100 text-gray-800 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'}`}>
              {m.content}
              <p className="text-[10px] text-gray-400 mt-1">{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <ExpandingInput value={input} onChange={setInput} onSend={send} disabled={sending} placeholder="Enviar mensagem..." />
    </div>
  );
}

// Unified plan review (same as before but includes knowledge context)
function UnifiedPlanReview({ plan, knowledge, onBack }: { plan: any; knowledge: any[]; onBack: () => void }) {
  const [showConversation, setShowConversation] = useState(false);
  const [editingGoal, setEditingGoal] = useState<number | null>(null);
  const [editingMeal, setEditingMeal] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [editablePlan, setEditablePlan] = useState<any>({ goals: plan.goals || [], meal_plan_base: plan.meal_plan_base || {}, exercise_plan_base: plan.exercise_plan_base || {} });
  const [detailedPlan, setDetailedPlan] = useState<any>(plan.detailed_plan || {});
  const detailedDays = detailedPlan.days || [];
  const conv = plan.onboarding_conversation || [];

  function updateGoal(i: number, field: string, value: string) { setEditablePlan((p: any) => { const g = [...p.goals]; g[i] = { ...g[i], [field]: value }; return { ...p, goals: g }; }); }
  function updateMealField(field: string, value: any) { setEditablePlan((p: any) => ({ ...p, meal_plan_base: { ...p.meal_plan_base, [field]: value } })); }
  function updateDayMeal(di: number, mi: number, desc: string) { setDetailedPlan((p: any) => { const d = [...(p.days||[])]; d[di] = { ...d[di], meals: [...d[di].meals] }; d[di].meals[mi] = { ...d[di].meals[mi], description: desc }; return { ...p, days: d }; }); }
  function updateDayExercise(di: number, f: string, v: string) { setDetailedPlan((p: any) => { const d = [...(p.days||[])]; d[di] = { ...d[di], exercise: { ...d[di].exercise, [f]: v } }; return { ...p, days: d }; }); }

  async function approvePlan() {
    setApproving(true);
    const schedule = plan.initial_schedule || [];
    for (const day of schedule) { await supabase.from('daily_schedule').upsert({ plan_id: plan.id, date: day.date, morning: day.morning, afternoon: day.afternoon, evening: day.evening, has_gym: day.has_gym }, { onConflict: 'plan_id,date' }); }
    for (const day of detailedDays) { await supabase.from('daily_plans').upsert({ plan_id: plan.id, date: day.date, meals: day.meals, exercise: day.exercise, status: 'active' }, { onConflict: 'plan_id,date' }); }
    await supabase.from('plans').update({ status: 'approved', approved_at: new Date().toISOString(), start_date: getLocalToday(), goals: editablePlan.goals, meal_plan_base: editablePlan.meal_plan_base, exercise_plan_base: editablePlan.exercise_plan_base, detailed_plan: detailedPlan }).eq('id', plan.id);
    setApproving(false); onBack();
  }

  async function requestConsultation() { await supabase.from('plans').update({ status: 'consultation_requested' }).eq('id', plan.id); onBack(); }

  if (plan.status === 'approved') {
    // Show patient overview for active plans
    return (
      <div className="min-h-screen">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400">← Voltar</button>
          <h2 className="text-lg font-medium">{(plan as any).profiles?.name || 'Paciente'}</h2>
          <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Ativo</span>
        </div>
        <div className="p-4">
          <p className="text-sm font-medium mb-2">Plano ativo</p>
          <div className="bg-gray-50 rounded-xl p-3 mb-3 text-xs text-gray-600 space-y-1">
            <p>Duração: {plan.duration_months} meses</p>
            <p>Calorias: {plan.meal_plan_base?.calories} kcal/dia</p>
            <p>Proteína: {plan.meal_plan_base?.protein_g}g | Carbo: {plan.meal_plan_base?.carbs_g}g | Gordura: {plan.meal_plan_base?.fat_g}g</p>
            <p>Exercício: {plan.exercise_plan_base?.weekly_frequency}x/semana</p>
          </div>
          <p className="text-sm font-medium mb-2">Metas</p>
          {(plan.goals || []).map((g: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1.5"><div className="w-1.5 h-1.5 rounded-full bg-teal-400" /><p className="text-xs">{g.description} — {g.timeframe}</p></div>
          ))}
        </div>
      </div>
    );
  }

  // Pending review
  return (
    <div className="min-h-screen">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400">← Voltar</button>
        <h2 className="text-lg font-medium">{(plan as any).profiles?.name || 'Paciente'}</h2>
      </div>
      <div className="p-4">
        {plan.technical_diagnosis && (<><p className="text-sm font-medium mb-2">Diagnóstico</p><div className="bg-purple-50 rounded-xl p-3 mb-4 text-xs text-purple-800 whitespace-pre-wrap">{plan.technical_diagnosis}</div></>)}

        <p className="text-sm font-medium mb-2">Metas</p>
        {(editablePlan.goals || []).map((g: any, i: number) => (
          <div key={i} className="py-2 border-b border-gray-50 cursor-pointer" onClick={() => setEditingGoal(editingGoal === i ? null : i)}>
            {editingGoal === i ? (
              <div className="space-y-2 bg-gray-50 rounded-xl p-3" onClick={e => e.stopPropagation()}>
                <input value={g.description || ''} onChange={e => updateGoal(i, 'description', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2" />
                <input value={g.measurement || ''} onChange={e => updateGoal(i, 'measurement', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2" />
                <input value={g.timeframe || ''} onChange={e => updateGoal(i, 'timeframe', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2" />
                <button onClick={() => setEditingGoal(null)} className="text-xs text-teal-600">✓ OK</button>
              </div>
            ) : (<div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-400" /><div className="flex-1"><p className="text-sm">{g.description}</p><p className="text-[10px] text-gray-400">{g.measurement} — {g.timeframe}</p></div></div>)}
          </div>
        ))}

        <p className="text-sm font-medium mt-4 mb-2">Alimentação base</p>
        <div className="bg-gray-50 rounded-xl p-3 mb-2 grid grid-cols-2 gap-2">
          {[{ l: 'Calorias', f: 'calories' }, { l: 'Refeições', f: 'meals_per_day' }, { l: 'Proteína(g)', f: 'protein_g' }, { l: 'Carbo(g)', f: 'carbs_g' }, { l: 'Gordura(g)', f: 'fat_g' }].map(x => (
            <div key={x.f}><label className="text-[10px] text-gray-400">{x.l}</label><input type="number" value={editablePlan.meal_plan_base[x.f] || ''} onChange={e => updateMealField(x.f, Number(e.target.value))} className="w-full text-sm border rounded-lg px-2 py-1" /></div>
          ))}
        </div>

        {detailedDays.length > 0 && (<>
          <p className="text-sm font-medium mt-4 mb-2">Cardápio ({detailedDays.length} dias)</p>
          {detailedDays.map((day: any, di: number) => {
            const label = new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
            return (<div key={di} className="mb-3 bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-medium text-gray-600 mb-2">{label}</p>
              {(day.meals||[]).map((meal: any, mi: number) => {
                const k = `${di}-${mi}`;
                return (<div key={mi} className="bg-white rounded-lg p-2 mb-1">
                  <p className="text-[10px] font-medium text-teal-700">{meal.meal}</p>
                  {editingMeal === k ? (<div onClick={e=>e.stopPropagation()}><textarea value={meal.description} onChange={e=>updateDayMeal(di,mi,e.target.value)} className="w-full text-xs border rounded px-2 py-1 resize-none mt-1" rows={2}/><button onClick={()=>setEditingMeal(null)} className="text-[10px] text-teal-600">✓</button></div>)
                  : (<p className="text-xs text-gray-600 cursor-pointer mt-0.5" onClick={()=>setEditingMeal(k)}>{meal.description} <span className="text-gray-300">✎</span></p>)}
                </div>);
              })}
              {day.exercise && (editingExercise === String(di) ? (
                <div className="bg-blue-50 rounded-lg p-2 mt-1" onClick={e=>e.stopPropagation()}>
                  <input value={day.exercise.type||''} onChange={e=>updateDayExercise(di,'type',e.target.value)} className="w-full text-xs border rounded px-2 py-1 bg-white mb-1"/>
                  <textarea value={day.exercise.description||''} onChange={e=>updateDayExercise(di,'description',e.target.value)} className="w-full text-xs border rounded px-2 py-1 bg-white resize-none" rows={2}/>
                  <button onClick={()=>setEditingExercise(null)} className="text-[10px] text-blue-600">✓</button>
                </div>
              ) : (
                <div className="bg-blue-50 rounded-lg p-2 mt-1 cursor-pointer" onClick={()=>setEditingExercise(String(di))}>
                  <p className="text-[10px] font-medium text-blue-700">Exercício: {day.exercise.type} <span className="text-blue-300">✎</span></p>
                  <p className="text-xs text-blue-600">{day.exercise.description}</p>
                </div>
              ))}
            </div>);
          })}
        </>)}

        <button onClick={()=>setShowConversation(!showConversation)} className="w-full mt-2 py-2 border border-gray-200 rounded-xl text-sm text-gray-500">{showConversation ? 'Ocultar conversa' : 'Ver conversa'}</button>
        {showConversation && (<div className="mt-2 bg-gray-50 rounded-xl p-3 max-h-60 overflow-y-auto">{conv.map((m:any,i:number)=>(<div key={i} className={`mb-2 ${m.role==='assistant'?'':'text-right'}`}><span className={`inline-block px-3 py-2 rounded-xl text-xs ${m.role==='assistant'?'bg-teal-50 text-teal-800':'bg-white text-gray-700'}`}>{m.content}</span></div>))}</div>)}

        <div className="mt-6 space-y-2">
          <button onClick={approvePlan} disabled={approving} className="w-full py-3 bg-teal-400 text-white rounded-xl text-sm font-medium disabled:opacity-50">{approving ? 'Aprovando...' : 'Aprovar e liberar'}</button>
          {plan.status !== 'consultation_requested' && plan.status !== 'approved' && (<button onClick={requestConsultation} className="w-full py-3 border border-amber-300 text-amber-700 rounded-xl text-sm font-medium">Solicitar consulta</button>)}
        </div>
      </div>
    </div>
  );
}
