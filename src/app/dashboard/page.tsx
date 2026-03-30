'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday, toLocalDateStr, getWeekStartDate, getDayDates as getDayDatesUtil } from '@/lib/dates';
import UserMenu from '@/components/UserMenu';
import TodayTab from '@/components/TodayTab';
import WeekTab from '@/components/WeekTab';
import PlanTab from '@/components/PlanTab';
import ChatTab from '@/components/ChatTab';
import ProfileTab from '@/components/ProfileTab';

export default function Dashboard() {
  const [tab, setTab] = useState('hoje');
  const [profile, setProfile] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<any>(null);
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
      // Find weekly plan where today is within the plan period
      const { data: wp } = await supabase.from('weekly_plans').select('*').eq('plan_id', currentPlan.id).lte('week_start', todayStr).order('week_start', { ascending: false }).limit(1);
      if (wp && wp.length > 0) {
        // Only show weekly plan if approved by Nina
        if (wp[0].status === 'approved') {
          setWeeklyPlan(wp[0]);
        } else {
          setWeeklyPlan({ ...wp[0], _pending: true });
        }
      }
    }
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Carregando...</p></div>;

  if (!plan) {
    return (
      <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span></h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{profile?.name || profile?.email || ''}</span>
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
      <div className="flex flex-col min-h-screen">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span></h1>
          {profile && <UserMenu profile={profile} plan={plan} />}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4"><span className="text-2xl">⏳</span></div>
          <p className="text-gray-700 font-medium mb-2">{plan.status === 'consultation_requested' ? 'A Nina solicitou uma consulta' : 'Plano aguardando revisão da Nina'}</p>
          <p className="text-gray-400 text-sm max-w-xs">{plan.status === 'consultation_requested' ? 'A Nina quer te conhecer pessoalmente antes de aprovar o plano.' : 'Seu plano foi enviado para a Nina analisar. Você será notificado quando for aprovado.'}</p>
          {plan.duration_months && <p className="text-teal-600 text-xs mt-4">Plano de {plan.duration_months} meses</p>}
        </div>
      </div>
    );
  }

  // Plan approved but weekly plan pending Nina approval
  if (plan.status === 'approved' && weeklyPlan?._pending) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span></h1>
          {profile && <UserMenu profile={profile} plan={plan} />}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4"><span className="text-2xl">📋</span></div>
          <p className="text-gray-700 font-medium mb-2">Planejamento semanal enviado!</p>
          <p className="text-gray-400 text-sm max-w-xs mb-4">Seu cardápio da semana foi gerado e está aguardando a aprovação da Nina. Assim que ela aprovar, você poderá começar a registrar suas refeições.</p>
          <div className="bg-amber-50 rounded-xl p-3 inline-flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm text-amber-700">Aguardando aprovação da Nina</span>
          </div>
        </div>
      </div>
    );
  }

  // Plan approved but no weekly plan — show setup
  if (plan.status === 'approved' && !weeklyPlan) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span></h1>
          {profile && <UserMenu profile={profile} plan={plan} />}
        </div>
        <WeeklyRoutineSetup plan={plan} onComplete={() => loadData()} />
      </div>
    );
  }

  const tabs = [
    { id: 'hoje', label: 'Hoje' },
    { id: 'semana', label: 'Semana' },
    { id: 'plano', label: 'Plano' },
    { id: 'chat', label: 'Chat' },
    { id: 'perfil', label: profile?.name?.split(' ')[0] || 'Perfil' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span></h1>
        {profile && <UserMenu profile={profile} plan={plan} />}
      </div>
      <div className="flex-1 overflow-y-auto pb-16">
        {tab === 'hoje' && <TodayTab plan={plan} weeklyPlan={weeklyPlan} />}
        {tab === 'semana' && <WeekTab plan={plan} weeklyPlan={weeklyPlan} />}
        {tab === 'plano' && <PlanTab plan={plan} />}
        {tab === 'chat' && <ChatTab plan={plan} />}
        {tab === 'perfil' && <ProfileTab profile={profile} plan={plan} />}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 max-w-md mx-auto">
        <div className="flex justify-around py-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center py-1 px-3 ${tab === t.id ? 'text-teal-400' : 'text-gray-300'}`}>
              <div className={`w-1.5 h-1.5 rounded-full mb-1 ${tab === t.id ? 'bg-teal-400' : 'bg-transparent'}`} />
              <span className="text-xs">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Helpers are now imported from @/lib/dates

function WeeklyRoutineSetup({ plan, onComplete }: { plan: any; onComplete: () => void }) {
  const dayLabels: Record<string, string> = { domingo: 'Domingo', segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado' };
  const dayKeysFromJS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

  // Build plan from TODAY through next Sunday
  const today = new Date();
  const todayStr = getLocalToday();
  
  // Calculate days from today to next Sunday (inclusive)
  const plannedDays: { key: string; date: string; dateObj: Date }[] = [];
  const d = new Date(today);
  // Always include at least today + go until next Sunday
  do {
    const dateStr = toLocalDateStr(d);
    const dayKey = dayKeysFromJS[d.getDay()];
    plannedDays.push({ key: dayKey, date: dateStr, dateObj: new Date(d) });
    d.setDate(d.getDate() + 1);
  } while (d.getDay() !== 1 || plannedDays.length < 2); 
  // Stop when we hit Monday (start of next week) — but always at least 2 days

  // The weekStart is today
  const weekStartStr = todayStr;

  // Build dayDates map
  const dayDates: Record<string, string> = {};
  plannedDays.forEach(pd => {
    // If same dayKey appears twice (e.g. plan starts Sunday, next Sunday), use first occurrence
    if (!dayDates[pd.key]) dayDates[pd.key] = pd.date;
  });

  const mealsPerDay = Math.max(plan.meal_plan_base?.meals_per_day || 5, 3);
  const defaultMealNames = plan.meal_plan_base?.meal_names || ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'];
  const mealNames = defaultMealNames.slice(0, mealsPerDay);

  const [routine, setRoutine] = useState<any>(() => {
    const r: any = {};
    plannedDays.forEach(pd => {
      r[pd.date] = { key: pd.key, meals: {} as Record<string, string>, gym: true };
      mealNames.forEach((m: string) => { r[pd.date].meals[m] = 'casa'; });
    });
    return r;
  });
  const [generating, setGenerating] = useState(false);

  // Toggle a meal between casa/fora/livre
  function cycleMealLocation(dateStr: string, meal: string) {
    setRoutine((prev: any) => {
      const current = prev[dateStr].meals[meal];
      const next = current === 'casa' ? 'fora' : current === 'fora' ? 'livre' : 'casa';
      return { ...prev, [dateStr]: { ...prev[dateStr], meals: { ...prev[dateStr].meals, [meal]: next } } };
    });
  }

  function toggleMealActive(dateStr: string, meal: string) {
    setRoutine((prev: any) => {
      const current = prev[dateStr].meals[meal];
      if (current === 'off') {
        return { ...prev, [dateStr]: { ...prev[dateStr], meals: { ...prev[dateStr].meals, [meal]: 'casa' } } };
      }
      return { ...prev, [dateStr]: { ...prev[dateStr], meals: { ...prev[dateStr].meals, [meal]: 'off' } } };
    });
  }

  async function generatePlan() {
    setGenerating(true);
    
    // Build routine keyed by day name for the API, with dates
    const routineByDay: any = {};
    const dayDatesForApi: Record<string, string> = {};
    plannedDays.forEach(pd => {
      routineByDay[pd.key] = { ...routine[pd.date], date: pd.date };
      dayDatesForApi[pd.key] = pd.date;
    });

    const res = await fetch('/api/weekly-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        routine: routineByDay, 
        mealPlanBase: plan.meal_plan_base, 
        exercisePlanBase: plan.exercise_plan_base, 
        goals: plan.goals, 
        mealNames,
        weekStart: weekStartStr,
        dayDates: dayDatesForApi,
      }),
    });
    const weekPlan = await res.json();

    const { data: existingWeeks } = await supabase.from('weekly_plans').select('week_number').eq('plan_id', plan.id).order('week_number', { ascending: false }).limit(1);
    const nextWeek = (existingWeeks && existingWeeks.length > 0) ? existingWeeks[0].week_number + 1 : 1;

    await supabase.from('weekly_plans').insert({
      plan_id: plan.id, week_number: nextWeek, week_start: weekStartStr,
      routine: routineByDay, meal_plan_detailed: weekPlan.meal_plan || {}, exercise_plan_detailed: weekPlan.exercise_plan || {},
      submitted_at: new Date().toISOString(),
      status: 'pending_nina_approval',
      day_dates: dayDatesForApi,
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('alerts').insert({
        patient_id: session.user.id, plan_id: plan.id,
        type: 'plan_ready', message: 'Novo planejamento semanal para revisar',
      });
    }

    setGenerating(false);
    onComplete();
  }

  const mealLocationStyle: Record<string, { bg: string; text: string; label: string }> = {
    casa: { bg: 'bg-green-50 text-green-800', text: 'text-green-800', label: 'Casa' },
    fora: { bg: 'bg-amber-50 text-amber-800', text: 'text-amber-800', label: 'Fora' },
    livre: { bg: 'bg-purple-50 text-purple-800', text: 'text-purple-800', label: 'Livre' },
    off: { bg: 'bg-gray-100 text-gray-400', text: 'text-gray-400', label: 'Sem' },
  };

  return (
    <div className="p-4 overflow-y-auto">
      <h2 className="text-lg font-medium mb-1">Planeje sua semana</h2>
      <p className="text-gray-400 text-sm mb-1">De {new Date(plannedDays[0].date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} até {new Date(plannedDays[plannedDays.length - 1].date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} — {mealsPerDay} refeições/dia</p>
      <p className="text-gray-400 text-xs mb-1">Toque na refeição para alternar: Casa → Fora → Livre</p>
      <p className="text-gray-400 text-xs mb-4">Use ✕ para desativar uma refeição do dia</p>

      {plannedDays.map(pd => {
        const dayRoutine = routine[pd.date];
        if (!dayRoutine) return null;
        const dateLabel = pd.dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const isToday = pd.date === todayStr;
        
        return (
          <div key={pd.date} className={`mb-3 rounded-xl p-3 ${isToday ? 'bg-teal-50/50 border border-teal-200' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{dayLabels[pd.key]}</span>
                <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full">{dateLabel}</span>
                {isToday && <span className="text-xs text-teal-500">hoje</span>}
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input type="checkbox" checked={dayRoutine.gym} onChange={() => setRoutine((prev: any) => ({ ...prev, [pd.date]: { ...prev[pd.date], gym: !prev[pd.date].gym } }))} className="rounded" />
                Academia
              </label>
            </div>
            <div className="space-y-1">
              {mealNames.map((meal: string) => {
                const loc = dayRoutine.meals[meal] || 'casa';
                const style = mealLocationStyle[loc] || mealLocationStyle.casa;
                return (
                  <div key={meal} className="flex items-center justify-between">
                    <span className={`text-xs ${loc === 'off' ? 'text-gray-300 line-through' : 'text-gray-500'}`}>{meal}</span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => cycleMealLocation(pd.date, meal)}
                        className={`text-xs px-3 py-1 rounded-full ${style.bg}`}
                      >
                        {style.label}
                      </button>
                      <button
                        onClick={() => toggleMealActive(pd.date, meal)}
                        className="text-[10px] px-1.5 py-1 rounded text-gray-300 hover:text-gray-500"
                        title={loc === 'off' ? 'Reativar' : 'Desativar'}
                      >
                        {loc === 'off' ? '＋' : '✕'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <button onClick={generatePlan} disabled={generating} className="w-full py-4 bg-teal-400 text-white rounded-2xl font-medium disabled:opacity-50 mt-2">
        {generating ? 'Gerando seu plano semanal...' : 'Gerar plano da semana'}
      </button>
      <p className="text-xs text-gray-400 text-center mt-2">Após gerar, o plano será enviado para a Nina aprovar</p>
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
      if (!session) {
        setError('Sessão expirada. Faça login novamente.');
        setCreating(false);
        return;
      }

      // Ensure profile exists (may have failed during signup due to RLS)
      const { data: profile } = await supabase.from('profiles').select('id').eq('id', session.user.id).single();
      
      if (!profile) {
        // Try to create profile — use upsert to avoid conflicts
        const { error: profileErr } = await supabase.from('profiles').upsert({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
          role: 'patient',
        }, { onConflict: 'id' });
        
        if (profileErr) {
          setError('Erro ao criar perfil: ' + profileErr.message);
          setCreating(false);
          return;
        }
      }

      const { data: newPlan, error: insertError } = await supabase.from('plans').insert({ 
        patient_id: session.user.id, 
        status: 'onboarding' 
      }).select().single();
      
      if (insertError) {
        setError('Erro ao criar plano: ' + insertError.message);
        setCreating(false);
        return;
      }
      if (newPlan) {
        window.location.href = `/onboarding?plan=${newPlan.id}`;
      }
    } catch (err: any) {
      setError('Erro: ' + err.message);
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col items-center w-full px-4">
      <button 
        onClick={handleCreate} 
        disabled={creating}
        className="px-8 py-4 bg-teal-400 text-white rounded-2xl text-base font-medium active:bg-teal-500 touch-manipulation disabled:opacity-50"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {creating ? 'Criando...' : 'Criar novo plano'}
      </button>
      {error && <p className="text-red-400 text-xs mt-3 max-w-xs text-center">{error}</p>}
    </div>
  );
}
