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
  const [unreadByPlan, setUnreadByPlan] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);
  // Poll for new messages every 10 seconds
  useEffect(() => { const i = setInterval(loadUnread, 10000); return () => clearInterval(i); }, [patients]);

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
    // Load unread after patients are set
    setTimeout(loadUnread, 100);
  }

  async function markAlertRead(id: string) {
    await supabase.from('alerts').update({ read: true }).eq('id', id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  async function loadUnread() {
    if (!patients || patients.length === 0) return;
    const counts: Record<string, number> = {};
    for (const p of patients) {
      const { data } = await supabase.from('direct_messages').select('id').eq('plan_id', p.id).eq('sender_role', 'patient').eq('read', false);
      if (data && data.length > 0) counts[p.id] = data.length;
    }
    setUnreadByPlan(counts);
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Carregando...</p></div>;
  if (teachingSession) return <TeachingSession session={teachingSession} onDone={() => { setTeachingSession(null); loadData(); }} />;
  if (selectedChat) return <DirectChat plan={selectedChat} profile={profile} onBack={() => { setSelectedChat(null); loadUnread(); }} />;
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
        ].map(t => {
          const totalUnread = t.id === 'chat' ? Object.values(unreadByPlan).reduce((s, n) => s + n, 0) : 0;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2.5 text-xs font-medium border-b-2 relative ${tab === t.id ? 'text-teal-600 border-teal-400' : 'text-gray-400 border-transparent'}`}>
              {t.label}
              {totalUnread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{totalUnread}</span>}
            </button>
          );
        })}
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
          {patients.filter(p => p.status === 'approved').map(p => {
            const unread = unreadByPlan[p.id] || 0;
            return (
              <div key={p.id} onClick={() => { setSelectedChat(p); }} className={`flex items-center gap-3 p-3 rounded-xl mb-2 cursor-pointer ${unread > 0 ? 'border-2 border-purple-200 bg-purple-50/30' : 'border border-gray-100'}`}>
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium relative">
                  {(p as any).profiles?.name?.[0] || '?'}
                  {unread > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{unread}</span>}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{(p as any).profiles?.name || 'Paciente'}</p>
                  {unread > 0 && <p className="text-xs text-purple-600">{unread} mensagem{unread > 1 ? 'ns' : ''} nova{unread > 1 ? 's' : ''}</p>}
                </div>
                <span className="text-xs text-gray-400">→</span>
              </div>
            );
          })}
          {patients.filter(p => p.status === 'approved').length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhum paciente ativo para conversar</p>}
        </div>
      )}

      {/* MATERIALS TAB */}
      {tab === 'materials' && (
        <div className="p-4">
          <p className="text-sm font-medium mb-2">Materiais de referência</p>
          <p className="text-xs text-gray-400 mb-4">Faça upload de PDFs e o app vai te fazer perguntas para aprender seu método.</p>

          <MaterialUploadAndTeach profile={profile} materials={materials} onStartTeaching={setTeachingSession} onUpload={async (file: File, desc: string) => {
            const fileName = `material_${Date.now()}_${file.name}`;
            await supabase.storage.from('nina-materials').upload(fileName, file);
            const { data: urlData } = supabase.storage.from('nina-materials').getPublicUrl(fileName);
            
            // Read file as base64 to store for later use in teaching
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(file);
            });
            
            await supabase.from('nina_materials').insert({ 
              uploaded_by: profile.id, name: file.name, description: desc, 
              file_url: urlData.publicUrl, 
              file_type: file.name.endsWith('.pdf') ? 'pdf' : 'other',
              content_summary: base64, // Store base64 for teaching session
            });
            loadData();
          }} onDelete={async (id: string) => { await supabase.from('nina_materials').delete().eq('id', id); loadData(); }} />

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

  const [materialContent, setMaterialContent] = useState<string>('');

  useEffect(() => { startSession(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function startSession() {
    setLoading(true);
    const materialNames = session.materials.map((m: any) => m.name);

    // Use base64 stored in content_summary during upload
    const pdfContents: { name: string; base64: string }[] = [];
    let textFallback = '';

    for (const mat of session.materials) {
      if (mat.content_summary && mat.file_type === 'pdf') {
        // content_summary has the base64 of the PDF stored during upload
        pdfContents.push({ name: mat.name, base64: mat.content_summary });
      } else {
        textFallback += `\n[${mat.name}]: ${mat.description || 'Sem conteúdo disponível'}`;
      }
    }

    setMaterialContent(textFallback);

    const res = await fetch('/api/process-material', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialNames, pdfContents, textContent: textFallback }),
    });
    const data = await res.json();
    
    setMaterialContent(pdfContents.length > 0 
      ? `Conteúdo dos PDFs foi lido pela IA na primeira mensagem. Materiais: ${materialNames.join(', ')}. ${textFallback}`
      : textFallback
    );
    
    setMessages([{ role: 'assistant', content: data.text }]);
    setLoading(false);
  }

  async function send() {
    if (!input.trim() || loading) return;
    const newMsgs = [...messages, { role: 'user', content: input }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    const res = await fetch('/api/teach-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: newMsgs, materialContext: materialContent }) });
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
    return <ActivePatientView plan={plan} onBack={onBack} />;
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

// Full patient view for active plans — shows plan summary, upcoming days with cardapios, history
function ActivePatientView({ plan, onBack }: { plan: any; onBack: () => void }) {
  const [dailyPlans, setDailyPlans] = useState<any[]>([]);
  const [meals, setMeals] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState<'upcoming' | 'history' | 'files'>('upcoming');
  const [patientFiles, setPatientFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const todayStr = getLocalToday();
  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const futureDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { date: ds, dayLabel: dayLabels[d.getDay()], isToday: i === 0 };
  });

  const pastDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (7 - i));
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { date: ds, dayLabel: dayLabels[d.getDay()] };
  });

  useEffect(() => { loadPatientData(); }, []);

  async function loadPatientData() {
    const allDates = [...pastDays.map(d => d.date), ...futureDays.map(d => d.date)];
    const minDate = allDates[0];
    const maxDate = allDates[allDates.length - 1];
    const [{ data: dp }, { data: m }, { data: ex }, { data: files }] = await Promise.all([
      supabase.from('daily_plans').select('*').eq('plan_id', plan.id).in('date', allDates),
      supabase.from('meals').select('*').eq('plan_id', plan.id).gte('date', minDate).lte('date', maxDate),
      supabase.from('exercises').select('*').eq('plan_id', plan.id).gte('date', minDate).lte('date', maxDate),
      supabase.from('patient_files').select('*').eq('plan_id', plan.id).order('created_at', { ascending: false }),
    ]);
    setDailyPlans(dp || []); setMeals(m || []); setExercises(ex || []); setPatientFiles(files || []); setLoading(false);
  }

  async function uploadFile(file: File, description: string) {
    setUploading(true);
    const fileName = `patient_${plan.patient_id}/${Date.now()}_${file.name}`;
    await supabase.storage.from('patient-files').upload(fileName, file);
    const { data: urlData } = supabase.storage.from('patient-files').getPublicUrl(fileName);
    await supabase.from('patient_files').insert({
      plan_id: plan.id, patient_id: plan.patient_id, name: file.name, description,
      file_url: urlData.publicUrl, file_type: file.type.startsWith('image/') ? 'image' : file.name.split('.').pop() || 'other',
    });
    setUploading(false);
    loadPatientData();
  }

  async function deleteFile(fileId: string) {
    await supabase.from('patient_files').delete().eq('id', fileId);
    setPatientFiles((prev: any[]) => prev.filter((f: any) => f.id !== fileId));
  }

  async function deletePatient(keepHistory: boolean) {
    setDeleting(true);
    if (!keepHistory) {
      // Delete all data
      await supabase.from('direct_messages').delete().eq('plan_id', plan.id);
      await supabase.from('favorite_meals').delete().eq('plan_id', plan.id);
      await supabase.from('patient_files').delete().eq('plan_id', plan.id);
      await supabase.from('meals').delete().eq('plan_id', plan.id);
      await supabase.from('exercises').delete().eq('plan_id', plan.id);
      await supabase.from('daily_plans').delete().eq('plan_id', plan.id);
      await supabase.from('daily_schedule').delete().eq('plan_id', plan.id);
      await supabase.from('daily_checkins').delete().eq('plan_id', plan.id);
      await supabase.from('alerts').delete().eq('plan_id', plan.id);
      await supabase.from('plans').delete().eq('id', plan.id);
      await supabase.from('profiles').delete().eq('id', plan.patient_id);
    } else {
      // Just deactivate the plan, keep history
      await supabase.from('plans').update({ status: 'archived' }).eq('id', plan.id);
    }
    setDeleting(false);
    onBack();
  }

  function getDailyPlan(date: string) { return dailyPlans.find(p => p.date === date); }
  function getDayMeals(date: string) { return meals.filter(m => m.date === date); }
  function getDayExercise(date: string) { return exercises.find(e => e.date === date); }

  const patientName = (plan as any).profiles?.name || 'Paciente';
  const mp = plan.meal_plan_base || {};
  const pastMeals = meals.filter(m => m.date < todayStr);
  const greenMeals = pastMeals.filter(m => m.flag === 'green').length;
  const totalPastMeals = pastMeals.length;
  const adherence = totalPastMeals > 0 ? Math.round((greenMeals / totalPastMeals) * 100) : 0;
  const exDone = exercises.filter(e => e.done && e.date < todayStr).length;
  const exTotal = exercises.filter(e => e.date < todayStr).length;

  const flagColor: Record<string, string> = { green: 'bg-green-400', yellow: 'bg-amber-400', red: 'bg-red-400' };
  const flagBg: Record<string, string> = { green: 'bg-green-50', yellow: 'bg-amber-50', red: 'bg-red-50' };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Carregando...</p></div>;

  return (
    <div className="min-h-screen">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400">← Voltar</button>
        <div className="flex-1">
          <h2 className="text-lg font-medium">{patientName}</h2>
          <p className="text-xs text-gray-400">Plano de {plan.duration_months}m — desde {plan.start_date ? new Date(plan.start_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}</p>
        </div>
        <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Ativo</span>
      </div>

      <div className="p-4 pb-0">
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-gray-50 rounded-xl p-2 text-center"><p className={`text-lg font-medium ${adherence >= 70 ? 'text-green-600' : adherence >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{adherence}%</p><p className="text-[10px] text-gray-400">aderência</p></div>
          <div className="bg-gray-50 rounded-xl p-2 text-center"><p className="text-lg font-medium">{greenMeals}/{totalPastMeals}</p><p className="text-[10px] text-gray-400">verdes</p></div>
          <div className="bg-gray-50 rounded-xl p-2 text-center"><p className="text-lg font-medium">{exDone}/{exTotal}</p><p className="text-[10px] text-gray-400">exercício</p></div>
          <div className="bg-gray-50 rounded-xl p-2 text-center"><p className="text-lg font-medium">{mp.calories}</p><p className="text-[10px] text-gray-400">kcal/dia</p></div>
        </div>

        <div className="bg-teal-50 rounded-xl p-3 mb-3">
          <div className="flex justify-between text-[10px] text-teal-700"><span>P: {mp.protein_g}g</span><span>C: {mp.carbs_g}g</span><span>G: {mp.fat_g}g</span><span>{mp.meals_per_day} ref/dia</span></div>
        </div>

        <div className="mb-3">
          {(plan.goals || []).map((g: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-0.5"><div className="w-1.5 h-1.5 rounded-full bg-teal-400" /><p className="text-[10px] text-gray-600">{g.description} — {g.timeframe}</p></div>
          ))}
        </div>
      </div>

      <div className="flex border-b border-gray-100 px-4">
        <button onClick={() => setViewTab('upcoming')} className={`flex-1 py-2 text-xs font-medium text-center border-b-2 ${viewTab === 'upcoming' ? 'text-teal-600 border-teal-400' : 'text-gray-400 border-transparent'}`}>Próximos dias</button>
        <button onClick={() => setViewTab('history')} className={`flex-1 py-2 text-xs font-medium text-center border-b-2 ${viewTab === 'history' ? 'text-teal-600 border-teal-400' : 'text-gray-400 border-transparent'}`}>Histórico</button>
        <button onClick={() => setViewTab('files')} className={`flex-1 py-2 text-xs font-medium text-center border-b-2 relative ${viewTab === 'files' ? 'text-teal-600 border-teal-400' : 'text-gray-400 border-transparent'}`}>
          Arquivos
          {patientFiles.length > 0 && <span className="ml-1 text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{patientFiles.length}</span>}
        </button>
      </div>

      <div className="p-4">
        {(viewTab === 'upcoming' ? futureDays : pastDays).map(day => {
          const dp = getDailyPlan(day.date);
          const dayMealsReg = getDayMeals(day.date);
          const dayEx = getDayExercise(day.date);
          const hasPlan = !!dp;
          const isExpanded = expandedDay === day.date;
          const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          const isToday = day.date === todayStr;
          const isPast = day.date < todayStr;

          const completed = dayMealsReg.filter(m => m.completed === true || (m.flag && m.completed !== false)).length;
          const total = dp?.meals?.length || 0;
          const dayScore = total > 0 && isPast ? Math.round((completed / total) * 100) : -1;

          let dominant = '';
          if (dayMealsReg.length > 0) {
            const g = dayMealsReg.filter(m => m.flag === 'green').length;
            const y = dayMealsReg.filter(m => m.flag === 'yellow').length;
            const r = dayMealsReg.filter(m => m.flag === 'red').length;
            if (g >= y && g >= r) dominant = 'green'; else if (y >= r) dominant = 'yellow'; else dominant = 'red';
          }

          return (
            <div key={day.date} className={`mb-2 rounded-xl border overflow-hidden ${isToday ? 'border-teal-200 bg-teal-50/20' : dominant ? `${flagBg[dominant]}` : hasPlan ? 'border-green-100' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setExpandedDay(isExpanded ? null : day.date)}>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${dominant ? flagColor[dominant] : hasPlan ? 'bg-green-400' : 'bg-gray-200'}`} />
                  <span className="text-sm font-medium">{day.dayLabel}</span>
                  <span className="text-xs text-gray-400">{dateLabel}</span>
                  {isToday && <span className="text-[10px] text-teal-500">hoje</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  {dayScore >= 0 && <span className={`text-[10px] font-medium ${dayScore >= 70 ? 'text-green-600' : dayScore >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{dayScore}%</span>}
                  {isPast && completed > 0 && <span className="text-[10px] text-gray-400">{completed}/{total}</span>}
                  {dayEx?.done && <span className="text-[10px]">💪</span>}
                  {!hasPlan && !isPast && <span className="text-[10px] text-gray-300">sem cardápio</span>}
                  {hasPlan && !isPast && !dominant && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">✓</span>}
                  <svg className={`w-3.5 h-3.5 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 border-t border-gray-50/50 space-y-1.5">
                  {hasPlan ? (dp.meals || []).map((meal: any, idx: number) => {
                    const reg = dayMealsReg.find((m: any) => m.meal_name === meal.meal);
                    return (
                      <div key={idx} className={`rounded-lg p-2 ${reg?.flag ? flagBg[reg.flag] : 'bg-white border border-gray-50'}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-medium text-teal-700">{meal.meal}</p>
                          <div className="flex items-center gap-1">
                            {meal.location && <span className="text-[10px] text-gray-400">{meal.location}</span>}
                            {reg?.flag && <div className={`w-2 h-2 rounded-full ${flagColor[reg.flag]}`} />}
                            {reg?.completed === false && <span className="text-[10px] text-red-400">✕</span>}
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">{reg?.actual_description || meal.description}</p>
                        {reg?.feedback && <p className="text-[10px] text-gray-500 italic mt-0.5">{reg.feedback}</p>}
                        {meal.macros && <div className="flex gap-2 mt-1 text-[10px] text-gray-400"><span>P:{meal.macros.protein_g}g</span><span>C:{meal.macros.carbs_g}g</span><span>G:{meal.macros.fat_g}g</span><span>{meal.macros.calories}kcal</span></div>}
                      </div>
                    );
                  }) : <p className="text-xs text-gray-400 py-1">{isPast ? 'Nenhum registro.' : 'Sem cardápio gerado.'}</p>}
                  {dp?.exercise && (
                    <div className={`rounded-lg p-2 ${dayEx?.done ? 'bg-green-50' : 'bg-blue-50'}`}>
                      <p className="text-[10px] font-medium text-blue-700">{dayEx?.done ? '✓' : '○'} Exercício: {dayEx?.actual_type || dp.exercise.type}</p>
                      <p className="text-xs text-blue-600">{dp.exercise.description}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FILES TAB */}
      {viewTab === 'files' && (
        <div className="p-4">
          <div className="bg-gray-50 rounded-xl p-3 mb-4">
            <label className={`block w-full py-3 text-center rounded-xl text-sm font-medium cursor-pointer ${uploading ? 'bg-gray-300 text-gray-500' : 'bg-teal-400 text-white'}`}>
              {uploading ? 'Enviando...' : '+ Upload arquivo (exame, foto, documento)'}
              <input type="file" accept="image/*,.pdf,.doc,.docx,.txt" className="hidden" onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                if (e.target.files?.[0]) {
                  const desc = prompt('Descrição do arquivo (opcional):') || '';
                  await uploadFile(e.target.files[0], desc);
                }
              }} />
            </label>
          </div>
          {patientFiles.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhum arquivo. Faça upload de exames, fotos ou documentos.</p>}
          {patientFiles.map((file: any) => (
            <div key={file.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl mb-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${file.file_type === 'image' ? 'bg-blue-50' : file.file_type === 'pdf' ? 'bg-red-50' : 'bg-gray-50'}`}>
                {file.file_type === 'image' ? '🖼' : file.file_type === 'pdf' ? '📄' : '📎'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-[10px] text-gray-400">{file.description || 'Sem descrição'} — {new Date(file.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="flex items-center gap-1">
                <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 px-2 py-1 bg-teal-50 rounded-lg">Ver</a>
                <button onClick={() => deleteFile(file.id)} className="text-xs text-red-400 px-2 py-1">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete patient */}
      <div className="p-4 border-t border-gray-100">
        <button onClick={() => setShowDeleteConfirm(true)} className="w-full py-2.5 border border-red-200 text-red-500 rounded-xl text-xs font-medium">Remover paciente</button>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowDeleteConfirm(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-2xl w-[90%] max-w-sm p-5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <p className="text-lg font-medium mb-2">Remover {patientName}?</p>
            <p className="text-xs text-gray-500 mb-4">Escolha o que fazer com os dados:</p>
            <button onClick={() => deletePatient(true)} disabled={deleting} className="w-full py-3 mb-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-medium disabled:opacity-50">{deleting ? 'Processando...' : 'Arquivar (manter histórico)'}</button>
            <p className="text-[10px] text-gray-400 text-center mb-3">O paciente não acessa mais, mas você mantém os registros.</p>
            <button onClick={() => deletePatient(false)} disabled={deleting} className="w-full py-3 mb-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium disabled:opacity-50">{deleting ? 'Processando...' : 'Apagar tudo permanentemente'}</button>
            <p className="text-[10px] text-gray-400 text-center mb-4">Remove paciente e todos os dados. Irreversível.</p>
            <button onClick={() => setShowDeleteConfirm(false)} className="w-full py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
