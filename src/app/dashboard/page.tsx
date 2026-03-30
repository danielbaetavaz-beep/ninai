'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
      const today = new Date();
      const weekStart = getWeekStart(today);
      const { data: wp } = await supabase.from('weekly_plans').select('*').eq('plan_id', currentPlan.id).gte('week_start', weekStart.toISOString().split('T')[0]).order('created_at', { ascending: false }).limit(1);
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
      <div className="flex flex-col min-h-screen">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span></h1>
          {profile && <UserMenu profile={profile} />}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-gray-500 text-sm mb-8">Bem-vindo! Você ainda não tem um plano ativo.</p>
          <button onClick={async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const { data: newPlan } = await supabase.from('plans').insert({ patient_id: session.user.id, status: 'onboarding' }).select().single();
              if (newPlan) window.location.href = `/onboarding?plan=${newPlan.id}`;
            }
          }} className="px-8 py-4 bg-teal-400 text-white rounded-2xl text-base font-medium">Criar novo plano</button>
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

// Helper: get Monday of the current week
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper: get real dates for each day from a start date
function getDayDates(startDate: Date): Record<string, string> {
  const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  const result: Record<string, string> = {};
  days.forEach((day, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    result[day] = d.toISOString().split('T')[0];
  });
  return result;
}

function WeeklyRoutineSetup({ plan, onComplete }: { plan: any; onComplete: () => void }) {
  const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  const dayLabels: Record<string, string> = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo' };

  // Calculate real dates
  const today = new Date();
  const todayDayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
  
  // If today is Sunday (0), start next week. Otherwise start from today's Monday
  const weekStart = getWeekStart(todayDayOfWeek === 0 ? new Date(today.getTime() + 86400000) : today);
  const dayDates = getDayDates(weekStart);
  
  // Determine which days to plan (from today to Sunday)
  const todayStr = today.toISOString().split('T')[0];
  const activeDays = days.filter(d => dayDates[d] >= todayStr);

  const mealsPerDay = Math.max(plan.meal_plan_base?.meals_per_day || 5, 3);
  const defaultMealNames = plan.meal_plan_base?.meal_names || ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'];
  const mealNames = defaultMealNames.slice(0, mealsPerDay);

  const [routine, setRoutine] = useState<any>(() => {
    const r: any = {};
    days.forEach(d => {
      r[d] = { meals: {}, gym: true };
      mealNames.forEach((m: string) => { r[d].meals[m] = 'casa'; });
    });
    return r;
  });
  const [generating, setGenerating] = useState(false);

  // Toggle a meal between casa/fora/livre
  function cycleMealLocation(day: string, meal: string) {
    setRoutine((prev: any) => {
      const current = prev[day].meals[meal];
      const next = current === 'casa' ? 'fora' : current === 'fora' ? 'livre' : 'casa';
      return { ...prev, [day]: { ...prev[day], meals: { ...prev[day].meals, [meal]: next } } };
    });
  }

  // Remove a meal from a specific day
  function toggleMealActive(day: string, meal: string) {
    setRoutine((prev: any) => {
      const current = prev[day].meals[meal];
      if (current === 'off') {
        return { ...prev, [day]: { ...prev[day], meals: { ...prev[day].meals, [meal]: 'casa' } } };
      }
      return { ...prev, [day]: { ...prev[day], meals: { ...prev[day].meals, [meal]: 'off' } } };
    });
  }

  async function generatePlan() {
    setGenerating(true);
    
    // Only send active days with their real dates
    const routineWithDates: any = {};
    days.forEach(d => {
      routineWithDates[d] = { ...routine[d], date: dayDates[d] };
    });

    const res = await fetch('/api/weekly-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        routine: routineWithDates, 
        mealPlanBase: plan.meal_plan_base, 
        exercisePlanBase: plan.exercise_plan_base, 
        goals: plan.goals, 
        mealNames,
        weekStart: weekStart.toISOString().split('T')[0],
        dayDates,
      }),
    });
    const weekPlan = await res.json();

    const { data: existingWeeks } = await supabase.from('weekly_plans').select('week_number').eq('plan_id', plan.id).order('week_number', { ascending: false }).limit(1);
    const nextWeek = (existingWeeks && existingWeeks.length > 0) ? existingWeeks[0].week_number + 1 : 1;

    // Insert with pending status — needs Nina approval (point 16)
    await supabase.from('weekly_plans').insert({
      plan_id: plan.id, week_number: nextWeek, week_start: weekStart.toISOString().split('T')[0],
      routine: routineWithDates, meal_plan_detailed: weekPlan.meal_plan || {}, exercise_plan_detailed: weekPlan.exercise_plan || {},
      submitted_at: new Date().toISOString(),
      status: 'pending_nina_approval',
      day_dates: dayDates,
    });

    // Alert Nina about new weekly plan
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
      <p className="text-gray-400 text-sm mb-1">Plano de {plan.duration_months} meses — {mealsPerDay} refeições/dia</p>
      <p className="text-gray-400 text-xs mb-1">Toque na refeição para alternar: Casa → Fora → Livre</p>
      <p className="text-gray-400 text-xs mb-4">Segure para desativar/reativar uma refeição do dia</p>

      {days.map(day => {
        const isActive = activeDays.includes(day);
        const dateStr = dayDates[day];
        const dateObj = new Date(dateStr + 'T12:00:00');
        const dateLabel = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        
        return (
          <div key={day} className={`mb-3 rounded-xl p-3 ${isActive ? 'bg-gray-50' : 'bg-gray-50/50 opacity-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{dayLabels[day]}</span>
                <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full">{dateLabel}</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input type="checkbox" checked={routine[day].gym} onChange={() => setRoutine((prev: any) => ({ ...prev, [day]: { ...prev[day], gym: !prev[day].gym } }))} className="rounded" />
                Academia
              </label>
            </div>
            <div className="space-y-1">
              {mealNames.map((meal: string) => {
                const loc = routine[day].meals[meal] || 'casa';
                const style = mealLocationStyle[loc] || mealLocationStyle.casa;
                return (
                  <div key={meal} className="flex items-center justify-between">
                    <span className={`text-xs ${loc === 'off' ? 'text-gray-300 line-through' : 'text-gray-500'}`}>{meal}</span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => cycleMealLocation(day, meal)}
                        className={`text-xs px-3 py-1 rounded-full ${style.bg}`}
                      >
                        {style.label}
                      </button>
                      <button
                        onClick={() => toggleMealActive(day, meal)}
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
