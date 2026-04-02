'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday } from '@/lib/dates';
import UserMenu from '@/components/UserMenu';
import JourneyTab from '@/components/JourneyTab';
import TodayTab from '@/components/TodayTab';
import ScheduleTab from '@/components/ScheduleTab';
import PlanTab from '@/components/PlanTab';
import ChatTab from '@/components/ChatTab';
import GroceryTab from '@/components/GroceryTab';
import ProfileTab from '@/components/ProfileTab';

export default function Dashboard() {
  const [tab, setTab] = useState('jornada');
  const [profile, setProfile] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [todayPlan, setTodayPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t) setTab(t);
    loadData();
  }, []);

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setProfile(prof);
    if (prof?.role === 'nutritionist') { window.location.href = '/nina'; return; }

    const { data: plans } = await supabase.from('plans').select('*').eq('patient_id', session.user.id).order('created_at', { ascending: false }).limit(1);
    if (!plans || plans.length === 0) { setLoading(false); return; }
    const currentPlan = plans[0];
    setPlan(currentPlan);

    if (currentPlan.status === 'onboarding') { window.location.href = `/onboarding?plan=${currentPlan.id}`; return; }

    if (currentPlan.status === 'approved') {
      const todayStr = getLocalToday();
      const { data: dp } = await supabase.from('daily_plans').select('*').eq('plan_id', currentPlan.id).eq('date', todayStr).limit(1);
      if (dp && dp.length > 0) setTodayPlan(dp[0]);
    }
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}><p className="text-gray-400">Carregando...</p></div>;

  if (!plan) {
    return (
      <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span></h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{profile?.name || ''}</span>
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} className="text-xs text-red-400 touch-manipulation">Sair</button>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-gray-500 text-sm mb-8">Bem-vindo! Você ainda não tem um plano ativo.</p>
          <CreatePlanButton />
        </div>
      </div>
    );
  }

  if (plan.status === 'pending_review' || plan.status === 'consultation_requested') {
    return (
      <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span></h1>
          {profile && <UserMenu profile={profile} plan={plan} />}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4"><span className="text-2xl">⏳</span></div>
          <p className="text-gray-700 font-medium mb-2">{plan.status === 'consultation_requested' ? 'A Nina solicitou uma consulta' : 'Plano aguardando revisão da Nina'}</p>
          <p className="text-gray-400 text-sm max-w-xs">{plan.status === 'consultation_requested' ? 'A Nina quer te conhecer pessoalmente antes de aprovar.' : 'Seu plano com cardápio foi enviado para a Nina. Você será notificado quando for aprovado.'}</p>
        </div>
      </div>
    );
  }

  // Plan approved — if no daily plan for today, prompt to fill schedule
  if (plan.status === 'approved' && !todayPlan) {
    return (
      <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span></h1>
          {profile && <UserMenu profile={profile} plan={plan} />}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4"><span className="text-2xl">📅</span></div>
          <p className="text-gray-700 font-medium mb-2">Sem cardápio para hoje</p>
          <p className="text-gray-400 text-sm max-w-xs mb-6">Preencha sua programação na aba Programação para gerar seu cardápio.</p>
          <button onClick={() => setTab('programacao')} className="px-6 py-3 bg-teal-400 text-white rounded-xl text-sm font-medium">Ir para Programação</button>
        </div>
        <BottomNav tab={tab} setTab={setTab} profileName={profile?.name} />
      </div>
    );
  }

  const tabs = [
    { id: 'jornada', label: 'Jornada' },
    { id: 'hoje', label: 'Hoje' },
    { id: 'programacao', label: 'Agenda' },
    { id: 'compras', label: 'Compras' },
    { id: 'chat', label: 'Chat' },
  ];

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span></h1>
        {profile && <UserMenu profile={profile} plan={plan} />}
      </div>
      <div className="flex-1 overflow-y-auto pb-16">
        {tab === 'jornada' && <JourneyTab plan={plan} />}
        {tab === 'hoje' && <TodayTab plan={plan} todayPlan={todayPlan} />}
        {tab === 'programacao' && <ScheduleTab plan={plan} onPlanGenerated={loadData} />}
        {tab === 'compras' && <GroceryTab plan={plan} />}
        {tab === 'chat' && <ChatTab plan={plan} />}
      </div>
      <BottomNav tab={tab} setTab={setTab} profileName={profile?.name} />
    </div>
  );
}

function BottomNav({ tab, setTab, profileName }: { tab: string; setTab: (t: string) => void; profileName?: string }) {
  const tabs = [
    { id: 'jornada', label: 'Jornada', icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 21L5 10L12 3L19 10L21 21H3Z" fill={active ? '#1D9E75' : '#d0d0d0'} opacity={active ? 1 : 0.6}/>
        <path d="M9 21V15H15V21" stroke="white" strokeWidth="1.5"/>
        <circle cx="12" cy="9" r="2" fill="white"/>
        <path d="M12 3L12 7" stroke={active ? '#0F6E56' : '#bbb'} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M12 3L14 5" stroke={active ? '#0F6E56' : '#bbb'} strokeWidth="1" strokeLinecap="round"/>
      </svg>
    )},
    { id: 'hoje', label: 'Hoje', icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="3" fill={active ? '#1D9E75' : '#d0d0d0'} opacity={active ? 1 : 0.6}/>
        <rect x="3" y="5" width="18" height="6" rx="3" fill={active ? '#0F6E56' : '#bbb'} opacity={active ? 0.8 : 0.4}/>
        <text x="12" y="19" textAnchor="middle" fontSize="9" fill="white" fontWeight="bold" fontFamily="sans-serif">{new Date().getDate()}</text>
        <rect x="7" y="3" width="2" height="4" rx="1" fill={active ? '#0F6E56' : '#bbb'}/>
        <rect x="15" y="3" width="2" height="4" rx="1" fill={active ? '#0F6E56' : '#bbb'}/>
      </svg>
    )},
    { id: 'programacao', label: 'Agenda', icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="2" fill={active ? '#1D9E75' : '#d0d0d0'} opacity={active ? 1 : 0.6}/>
        <line x1="8" y1="8" x2="16" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="8" y1="12" x2="16" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="8" y1="16" x2="13" y2="16" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )},
    { id: 'compras', label: 'Compras', icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M6 6H4L2 20H22L20 6H18" stroke={active ? '#1D9E75' : '#d0d0d0'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6 6C6 3.79 8.69 2 12 2C15.31 2 18 3.79 18 6" stroke={active ? '#1D9E75' : '#d0d0d0'} strokeWidth="2"/>
        <circle cx="9" cy="13" r="1.5" fill={active ? '#1D9E75' : '#d0d0d0'}/>
        <circle cx="15" cy="13" r="1.5" fill={active ? '#1D9E75' : '#d0d0d0'}/>
      </svg>
    )},
    { id: 'chat', label: 'Chat', icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H8L4 22V6C4 4.9 4.9 4 6 4H4Z" fill={active ? '#1D9E75' : '#d0d0d0'} opacity={active ? 1 : 0.6}/>
        <circle cx="9" cy="11" r="1" fill="white"/><circle cx="13" cy="11" r="1" fill="white"/><circle cx="17" cy="11" r="1" fill="white"/>
      </svg>
    )},
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 max-w-md mx-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex justify-around py-1.5">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="flex flex-col items-center py-1 px-3 touch-manipulation" style={{ WebkitTapHighlightColor: 'transparent' }}>
            {t.icon(tab === t.id)}
            <span className={`text-[10px] mt-0.5 font-medium ${tab === t.id ? 'text-teal-500' : 'text-gray-400'}`}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CreatePlanButton() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    setCreating(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('Sessão expirada.'); setCreating(false); return; }

      const { data: profile } = await supabase.from('profiles').select('id').eq('id', session.user.id).single();
      if (!profile) {
        await supabase.from('profiles').upsert({ id: session.user.id, email: session.user.email || '', name: session.user.email?.split('@')[0] || 'Usuário', role: 'patient' }, { onConflict: 'id' });
      }

      const { data: newPlan, error: insertError } = await supabase.from('plans').insert({ patient_id: session.user.id, status: 'onboarding' }).select().single();
      if (insertError) { setError('Erro: ' + insertError.message); setCreating(false); return; }
      if (newPlan) window.location.href = `/onboarding?plan=${newPlan.id}`;
    } catch (err: any) {
      setError('Erro: ' + err.message);
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col items-center w-full px-4">
      <button onClick={handleCreate} disabled={creating} className="px-8 py-4 bg-teal-400 text-white rounded-2xl text-base font-medium active:bg-teal-500 touch-manipulation disabled:opacity-50" style={{ WebkitTapHighlightColor: 'transparent' }}>
        {creating ? 'Criando...' : 'Criar novo plano'}
      </button>
      {error && <p className="text-red-400 text-xs mt-3 max-w-xs text-center">{error}</p>}
    </div>
  );
}
