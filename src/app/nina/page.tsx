'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday } from '@/lib/dates';
import ExpandingInput from '@/components/ExpandingInput';
import NewPatientForm from '@/components/NewPatientForm';

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
  const [showNewPatient, setShowNewPatient] = useState(false);
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

    const { data: plans } = await supabase.from('plans').select('*, profiles:patient_id(name, email)').not('status', 'eq', 'archived').order('created_at', { ascending: false });
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
  if (showNewPatient) return <NewPatientForm profile={profile} knowledge={knowledge} onDone={() => { setShowNewPatient(false); loadData(); }} onBack={() => setShowNewPatient(false)} />;
  if (teachingSession) return <TeachingSession session={teachingSession} onDone={() => { setTeachingSession(null); loadData(); }} />;
  if (selectedChat) return <DirectChat plan={selectedChat} profile={profile} onBack={() => { setSelectedChat(null); loadUnread(); }} />;
  if (selectedPlan) return <UnifiedPlanReview plan={selectedPlan} knowledge={knowledge} onBack={() => { setSelectedPlan(null); loadData(); }} />;

  const activePlans = patients.filter(p => p.status === 'approved');
  const pending = patients.filter(p => p.status === 'pending_review' || p.status === 'consultation_requested');

  return (
    <div className="relative" style={{ height: '100dvh', overflow: 'hidden' }}>
      {/* Fixed header */}
      <div id="nina-header" className="fixed top-0 left-0 right-0 z-30 max-w-md mx-auto transition-all duration-200" style={{ background: 'rgba(255,255,255,1)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span> <span className="text-gray-400 text-sm">— Nina</span></h1>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} className="text-xs text-gray-400">Sair</button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="overflow-y-auto" style={{ height: '100dvh', paddingTop: '60px', paddingBottom: '70px' }}
        onScroll={(e) => {
          const header = document.getElementById('nina-header');
          const scrollTop = (e.target as HTMLDivElement).scrollTop;
          if (header) {
            if (scrollTop > 20) {
              header.style.background = 'rgba(255,255,255,0.85)';
              header.style.borderBottom = '0.5px solid rgba(0,0,0,0.06)';
            } else {
              header.style.background = 'rgba(255,255,255,1)';
              header.style.borderBottom = 'none';
            }
          }
        }}
      >

      {/* DASHBOARD TAB */}
      {tab === 'dashboard' && <NinaDashboard patients={patients} activePlans={activePlans} pending={pending} alerts={alerts} patientStats={patientStats} unreadByPlan={unreadByPlan} onSelectPlan={setSelectedPlan} onMarkAlertRead={markAlertRead} />}

      {/* PATIENTS TAB */}
      {tab === 'patients' && (
        <div className="p-4">
          <button onClick={() => setShowNewPatient(true)} className="w-full py-3.5 mb-4 bg-teal-500 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Novo paciente
          </button>
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

          {/* Bulletin / Mural section */}
          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="text-sm font-medium mb-3">Publicar no Mural</p>
            <BulletinComposer patients={patients.filter((p: any) => p.status === 'approved')} profile={profile} />
          </div>
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

      {/* Fixed bottom nav with icons */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 max-w-md mx-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex justify-around py-1.5">
          {([
            { id: 'dashboard' as const, label: 'Visão geral', icon: (a: boolean) => (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="8" rx="2" fill={a ? '#1D9E75' : '#d0d0d0'} opacity={a ? 1 : 0.6}/>
                <rect x="13" y="3" width="8" height="8" rx="2" fill={a ? '#1D9E75' : '#d0d0d0'} opacity={a ? 0.7 : 0.4}/>
                <rect x="3" y="13" width="8" height="8" rx="2" fill={a ? '#1D9E75' : '#d0d0d0'} opacity={a ? 0.7 : 0.4}/>
                <rect x="13" y="13" width="8" height="8" rx="2" fill={a ? '#1D9E75' : '#d0d0d0'} opacity={a ? 0.5 : 0.3}/>
              </svg>
            )},
            { id: 'patients' as const, label: 'Pacientes', icon: (a: boolean) => (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" fill={a ? '#1D9E75' : '#d0d0d0'} opacity={a ? 1 : 0.6}/>
                <path d="M4 20C4 16.69 7.58 14 12 14C16.42 14 20 16.69 20 20" stroke={a ? '#1D9E75' : '#d0d0d0'} strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )},
            { id: 'chat' as const, label: 'Mensagens', icon: (a: boolean) => {
              const totalUnread = Object.values(unreadByPlan as Record<string, number>).reduce((s, n) => (s as number) + (n as number), 0) as number;
              return (
                <div className="relative">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H8L4 22V6C4 4.9 4.9 4 6 4H4Z" fill={a ? '#1D9E75' : '#d0d0d0'} opacity={a ? 1 : 0.6}/>
                    <circle cx="9" cy="11" r="1" fill="white"/><circle cx="13" cy="11" r="1" fill="white"/><circle cx="17" cy="11" r="1" fill="white"/>
                  </svg>
                  {totalUnread > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center">{totalUnread}</span>}
                </div>
              );
            }},
            { id: 'materials' as const, label: 'Materiais', icon: (a: boolean) => (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M6 2H14L20 8V22H6C4.9 22 4 21.1 4 20V4C4 2.9 4.9 2 6 2Z" fill={a ? '#1D9E75' : '#d0d0d0'} opacity={a ? 1 : 0.6}/>
                <path d="M14 2V8H20" stroke="white" strokeWidth="1.5"/>
                <line x1="8" y1="13" x2="16" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="8" y1="17" x2="13" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )},
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex flex-col items-center py-1 px-3 touch-manipulation" style={{ WebkitTapHighlightColor: 'transparent' }}>
              {t.icon(tab === t.id)}
              <span className={`text-[10px] mt-0.5 font-medium ${tab === t.id ? 'text-teal-500' : 'text-gray-400'}`}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
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
  const [sessions, setSessions] = useState<any[]>([]);
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
    const [{ data: dp }, { data: m }, { data: ex }, { data: files }, { data: sessData }] = await Promise.all([
      supabase.from('daily_plans').select('*').eq('plan_id', plan.id).in('date', allDates),
      supabase.from('meals').select('*').eq('plan_id', plan.id).gte('date', minDate).lte('date', maxDate),
      supabase.from('exercises').select('*').eq('plan_id', plan.id).gte('date', minDate).lte('date', maxDate),
      supabase.from('patient_files').select('*').eq('plan_id', plan.id).order('created_at', { ascending: false }),
      supabase.from('app_sessions').select('opened_at').eq('user_id', plan.patient_id).order('opened_at', { ascending: false }),
    ]);
    setDailyPlans(dp || []); setMeals(m || []); setExercises(ex || []); setPatientFiles(files || []); setSessions(sessData || []); setLoading(false);
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
    await fetch('/api/delete-patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: plan.id, patientId: plan.patient_id, keepHistory }),
    });
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

        {/* Engagement metrics */}
        {(() => {
          const totalSessions = sessions.length;
          const now = new Date();
          const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
          const sessionsThisWeek = sessions.filter((s: any) => new Date(s.opened_at) >= weekAgo);
          const daysThisWeek = new Set(sessionsThisWeek.map((s: any) => new Date(s.opened_at).toDateString())).size;
          
          // Average sessions per day (based on days that had at least one session)
          const allDaysWithSessions = new Set(sessions.map((s: any) => new Date(s.opened_at).toDateString())).size;
          const avgPerDay = allDaysWithSessions > 0 ? Math.round((totalSessions / allDaysWithSessions) * 10) / 10 : 0;

          return (
            <div className="bg-purple-50 rounded-xl p-3 mb-3">
              <p className="text-[10px] font-medium text-purple-700 mb-2">Engajamento no app</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-sm font-medium text-purple-800">{totalSessions}</p><p className="text-[9px] text-purple-500">acessos total</p></div>
                <div><p className="text-sm font-medium text-purple-800">{avgPerDay}</p><p className="text-[9px] text-purple-500">média/dia</p></div>
                <div><p className="text-sm font-medium text-purple-800">{daysThisWeek}/7</p><p className="text-[9px] text-purple-500">dias esta sem.</p></div>
              </div>
            </div>
          );
        })()}

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

// Professional dashboard for Nina
function NinaDashboard({ patients, activePlans, pending, alerts, patientStats, unreadByPlan, onSelectPlan, onMarkAlertRead }: any) {
  const [briefing, setBriefing] = useState<string>('');
  const [loadingBriefing, setLoadingBriefing] = useState(true);

  useEffect(() => { generateBriefing(); }, []);

  async function generateBriefing() {
    try {
      const totalUnread = Object.values(unreadByPlan as Record<string, number>).reduce((s, n) => (s as number) + (n as number), 0) as number;
      const res = await fetch('/api/nina-briefing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patients: activePlans, patientStats, alerts: alerts.length, pending: pending.length, unreadMessages: totalUnread }),
      });
      const data = await res.json();
      if (data.briefing) setBriefing(data.briefing);
    } catch {}
    setLoadingBriefing(false);
  }

  // Calculate metrics
  const totalActive = activePlans.length;
  const avgAdherence = totalActive > 0 ? Math.round(activePlans.reduce((sum: number, p: any) => sum + (patientStats[p.id]?.adherence || 0), 0) / totalActive) : 0;
  const totalGreenMeals = activePlans.reduce((sum: number, p: any) => sum + (patientStats[p.id]?.greenMeals || 0), 0);
  const totalExercises = activePlans.reduce((sum: number, p: any) => sum + (patientStats[p.id]?.exerciseDone || 0), 0);
  const needsAttention = activePlans.filter((p: any) => (patientStats[p.id]?.daysNoRegistration || 0) >= 3 || (patientStats[p.id]?.adherence || 0) < 30).length;

  // Ranking — sorted by adherence
  const ranked = [...activePlans].sort((a: any, b: any) => (patientStats[b.id]?.adherence || 0) - (patientStats[a.id]?.adherence || 0));

  // Action items count
  const totalUnread = Object.values(unreadByPlan as Record<string, number>).reduce((s, n) => (s as number) + (n as number), 0) as number;
  const actionCount = pending.length + alerts.length + (totalUnread > 0 ? 1 : 0);

  return (
    <div className="p-4">

      {/* AI Briefing */}
      <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-4 mb-4 border border-teal-100">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-teal-400 flex items-center justify-center">
            <span className="text-white text-xs font-medium">n</span>
          </div>
          <p className="text-xs font-medium text-teal-700">ninAI — Briefing do dia</p>
        </div>
        {loadingBriefing ? (
          <div className="flex items-center gap-2 py-2">
            <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-teal-600">Preparando seu resumo...</p>
          </div>
        ) : (
          <p className="text-sm text-teal-900 leading-relaxed">{briefing || 'Bom dia, Nina! Seu dashboard está pronto.'}</p>
        )}
      </div>

      {/* Quick metrics */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
          <p className={`text-xl font-medium ${avgAdherence >= 70 ? 'text-green-600' : avgAdherence >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{avgAdherence}%</p>
          <p className="text-[9px] text-gray-400 mt-0.5">aderência média</p>
        </div>
        <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
          <p className="text-xl font-medium text-teal-600">{totalActive}</p>
          <p className="text-[9px] text-gray-400 mt-0.5">pacientes</p>
        </div>
        <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
          <p className="text-xl font-medium text-green-600">{totalGreenMeals}</p>
          <p className="text-[9px] text-gray-400 mt-0.5">refeições verdes</p>
        </div>
        <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
          <p className="text-xl font-medium text-blue-600">{totalExercises}</p>
          <p className="text-[9px] text-gray-400 mt-0.5">exercícios</p>
        </div>
      </div>

      {/* Action items */}
      {actionCount > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Ações pendentes</p>
          {pending.map((p: any) => (
            <div key={p.id} onClick={() => onSelectPlan(p)} className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-xl mb-2 cursor-pointer active:scale-[0.98] transition-transform">
              <div className="w-9 h-9 rounded-full bg-teal-400 flex items-center justify-center text-white text-sm font-medium">{(p as any).profiles?.name?.[0] || '?'}</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-teal-800">{(p as any).profiles?.name || 'Paciente'}</p>
                <p className="text-[10px] text-teal-600">Plano aguardando sua aprovação</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
          ))}
          {alerts.map((a: any) => (
            <div key={a.id} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-2">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 22h20L12 2z" fill="#EF9F27"/><text x="12" y="18" textAnchor="middle" fontSize="12" fill="white" fontWeight="bold">!</text></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">{(a as any).profiles?.name || 'Alerta'}</p>
                <p className="text-[10px] text-amber-700">{a.message}</p>
              </div>
              <button onClick={() => onMarkAlertRead(a.id)} className="text-[10px] px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 font-medium">OK</button>
            </div>
          ))}
          {totalUnread > 0 && (
            <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-xl mb-2">
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H8L4 22V6C4 4.9 4.9 4 6 4Z" fill="#7F77DD"/><circle cx="9" cy="11" r="1" fill="white"/><circle cx="13" cy="11" r="1" fill="white"/><circle cx="17" cy="11" r="1" fill="white"/></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-800">{totalUnread} mensagem{totalUnread > 1 ? 'ns' : ''} não lida{totalUnread > 1 ? 's' : ''}</p>
                <p className="text-[10px] text-purple-600">Vá para Mensagens para responder</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ranking */}
      {ranked.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Ranking da semana</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {ranked.map((p: any, i: number) => {
              const stats = patientStats[p.id] || {};
              const isFirst = i === 0;
              const needsHelp = (stats.daysNoRegistration || 0) >= 3 || (stats.adherence || 0) < 30;
              return (
                <div key={p.id} onClick={() => onSelectPlan(p)} className={`flex items-center gap-3 p-3 cursor-pointer active:bg-gray-50 transition-colors ${i < ranked.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  {/* Position */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${isFirst ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-400'}`}>
                    {isFirst ? '👑' : i + 1}
                  </div>
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${needsHelp ? 'bg-red-50 text-red-500' : 'bg-teal-50 text-teal-700'}`}>
                    {(p as any).profiles?.name?.[0] || '?'}
                  </div>
                  {/* Name & details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{(p as any).profiles?.name || 'Paciente'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400">{stats.greenMeals || 0} verdes</span>
                      <span className="text-[10px] text-gray-400">{stats.exerciseDone || 0} exerc.</span>
                      {needsHelp && <span className="text-[10px] text-red-400">{stats.daysNoRegistration}d sem registro</span>}
                    </div>
                  </div>
                  {/* Adherence bar */}
                  <div className="w-16">
                    <p className={`text-sm font-medium text-right ${(stats.adherence || 0) >= 70 ? 'text-green-600' : (stats.adherence || 0) >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{stats.adherence || 0}%</p>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full rounded-full ${(stats.adherence || 0) >= 70 ? 'bg-green-400' : (stats.adherence || 0) >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.min(100, stats.adherence || 0)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly evolution chart (simple bar chart) */}
      {activePlans.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Aderência por paciente</p>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="space-y-3">
              {ranked.map((p: any) => {
                const stats = patientStats[p.id] || {};
                const adherence = stats.adherence || 0;
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500 w-16 truncate text-right">{(p as any).profiles?.name?.split(' ')[0] || '?'}</span>
                    <div className="flex-1 h-5 bg-gray-50 rounded-full overflow-hidden relative">
                      <div className={`h-full rounded-full transition-all duration-500 ${adherence >= 70 ? 'bg-gradient-to-r from-green-300 to-green-500' : adherence >= 40 ? 'bg-gradient-to-r from-amber-200 to-amber-400' : 'bg-gradient-to-r from-red-200 to-red-400'}`} style={{ width: `${Math.max(8, adherence)}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-gray-700">{adherence}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Needs attention */}
      {needsAttention > 0 && (
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
          <div className="flex items-center gap-2 mb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#E24B4A"/><text x="12" y="16" textAnchor="middle" fontSize="12" fill="white" fontWeight="bold">!</text></svg>
            <p className="text-sm font-medium text-red-800">{needsAttention} paciente{needsAttention > 1 ? 's' : ''} precisa{needsAttention > 1 ? 'm' : ''} de atenção</p>
          </div>
          <div className="space-y-1.5">
            {activePlans.filter((p: any) => (patientStats[p.id]?.daysNoRegistration || 0) >= 3 || (patientStats[p.id]?.adherence || 0) < 30).map((p: any) => {
              const stats = patientStats[p.id] || {};
              return (
                <div key={p.id} onClick={() => onSelectPlan(p)} className="flex items-center gap-2 cursor-pointer">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-[10px] font-medium">{(p as any).profiles?.name?.[0]}</div>
                  <p className="text-xs text-red-700">{(p as any).profiles?.name} — {stats.daysNoRegistration >= 3 ? `${stats.daysNoRegistration} dias sem registro` : `aderência ${stats.adherence}%`}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activePlans.length === 0 && (
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🌱</span>
          </div>
          <p className="text-sm text-gray-500">Nenhum paciente ativo ainda</p>
          <p className="text-xs text-gray-400 mt-1">Quando seus pacientes criarem planos, eles aparecerão aqui.</p>
        </div>
      )}
    </div>
  );
}

// Bulletin composer for Nina to create mural posts
function BulletinComposer({ patients, profile }: { patients: any[]; profile: any }) {
  const [postType, setPostType] = useState('aviso');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [sendAsMessage, setSendAsMessage] = useState(false);
  const [audience, setAudience] = useState('all');
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const types = [
    { id: 'promo', label: 'Promoção', icon: '🏷️' },
    { id: 'conteudo', label: 'Conteúdo', icon: '📚' },
    { id: 'aviso', label: 'Aviso', icon: '📢' },
    { id: 'receita', label: 'Receita', icon: '👨‍🍳' },
    { id: 'evento', label: 'Evento', icon: '📅' },
    { id: 'produto', label: 'Produto', icon: '🎁' },
  ];

  function togglePatient(id: string) {
    setSelectedPatients(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function publish() {
    if (!title.trim() || !content.trim()) return;
    setPublishing(true);

    let imageUrl = '';
    let attachUrl = '';
    let attachName = '';

    if (imageFile) {
      const fn = `bulletin/${Date.now()}_${imageFile.name}`;
      await supabase.storage.from('nina-materials').upload(fn, imageFile);
      const { data } = supabase.storage.from('nina-materials').getPublicUrl(fn);
      imageUrl = data.publicUrl;
    }
    if (attachFile) {
      const fn = `bulletin/${Date.now()}_${attachFile.name}`;
      await supabase.storage.from('nina-materials').upload(fn, attachFile);
      const { data } = supabase.storage.from('nina-materials').getPublicUrl(fn);
      attachUrl = data.publicUrl;
      attachName = attachFile.name;
    }

    const audienceIds = audience === 'selected' ? Array.from(selectedPatients) : [];

    await supabase.from('bulletin_posts').insert({
      author_id: profile.id,
      post_type: postType,
      title: title.trim(),
      content: content.trim(),
      image_url: imageUrl || null,
      attachment_url: attachUrl || null,
      attachment_name: attachName || null,
      action_label: actionLabel.trim() || null,
      action_url: actionUrl.trim() || null,
      audience: audience === 'selected' ? 'selected' : 'all',
      audience_ids: audienceIds,
      send_as_message: sendAsMessage,
    });

    // If send as message, create direct messages too
    if (sendAsMessage) {
      const targetPatients = audience === 'selected'
        ? patients.filter((p: any) => selectedPatients.has(p.patient_id))
        : patients;
      for (const p of targetPatients) {
        await supabase.from('direct_messages').insert({
          plan_id: p.id,
          sender_id: profile.id,
          sender_role: 'nutritionist',
          content: `📢 ${title}\n\n${content}${actionUrl ? `\n\n${actionLabel}: ${actionUrl}` : ''}`,
        });
      }
    }

    setPublishing(false);
    setPublished(true);
    setTitle(''); setContent(''); setActionLabel(''); setActionUrl('');
    setImageFile(null); setAttachFile(null);
    setTimeout(() => setPublished(false), 3000);
  }

  if (published) {
    return (
      <div className="bg-green-50 rounded-xl p-4 text-center">
        <p className="text-sm font-medium text-green-800">Publicado com sucesso!</p>
        <p className="text-xs text-green-600 mt-1">{sendAsMessage ? 'Post no mural + mensagem enviada' : 'Post publicado no mural'}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      {/* Post type */}
      <div className="flex flex-wrap gap-1.5">
        {types.map(t => (
          <button key={t.id} onClick={() => setPostType(t.id)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${postType === t.id ? 'bg-teal-400 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Title */}
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da publicação" className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" />

      {/* Content */}
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Escreva sua mensagem..." className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 resize-none" rows={3} />

      {/* Attachments */}
      <div className="flex gap-2">
        <label className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] text-gray-600 cursor-pointer">
          🖼 {imageFile ? imageFile.name.slice(0, 15) : 'Imagem'}
          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && setImageFile(e.target.files[0])} />
        </label>
        <label className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] text-gray-600 cursor-pointer">
          📎 {attachFile ? attachFile.name.slice(0, 15) : 'Arquivo'}
          <input type="file" className="hidden" onChange={e => e.target.files?.[0] && setAttachFile(e.target.files[0])} />
        </label>
      </div>

      {/* Action button (optional) */}
      <div className="flex gap-2">
        <input value={actionLabel} onChange={e => setActionLabel(e.target.value)} placeholder="Botão (ex: Saiba mais)" className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none" />
        <input value={actionUrl} onChange={e => setActionUrl(e.target.value)} placeholder="Link do botão" className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none" />
      </div>

      {/* Audience */}
      <div>
        <p className="text-[10px] text-gray-500 mb-1.5">Audiência</p>
        <div className="flex gap-2 mb-2">
          <button onClick={() => setAudience('all')} className={`flex-1 py-2 rounded-lg text-xs font-medium ${audience === 'all' ? 'bg-teal-400 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>Todos</button>
          <button onClick={() => setAudience('selected')} className={`flex-1 py-2 rounded-lg text-xs font-medium ${audience === 'selected' ? 'bg-teal-400 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>Selecionar</button>
        </div>
        {audience === 'selected' && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {patients.map((p: any) => (
              <button key={p.id} onClick={() => togglePatient(p.patient_id)} className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${selectedPatients.has(p.patient_id) ? 'bg-teal-50 text-teal-700' : 'bg-white text-gray-600'}`}>
                <div className={`w-4 h-4 rounded border ${selectedPatients.has(p.patient_id) ? 'bg-teal-400 border-teal-400' : 'border-gray-300'} flex items-center justify-center`}>
                  {selectedPatients.has(p.patient_id) && <span className="text-white text-[8px]">✓</span>}
                </div>
                {(p as any).profiles?.name || 'Paciente'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Send as message too */}
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={sendAsMessage} onChange={e => setSendAsMessage(e.target.checked)} className="rounded" />
        Enviar também como mensagem direta
      </label>

      {/* Publish */}
      <button onClick={publish} disabled={!title.trim() || !content.trim() || publishing} className="w-full py-3 bg-teal-400 text-white rounded-xl text-sm font-medium disabled:opacity-50">
        {publishing ? 'Publicando...' : 'Publicar no Mural'}
      </button>
    </div>
  );
}
