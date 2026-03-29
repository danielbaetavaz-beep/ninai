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
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1);
      const { data: wp } = await supabase.from('weekly_plans').select('*').eq('plan_id', currentPlan.id).gte('week_start', weekStart.toISOString().split('T')[0]).limit(1);
      if (wp && wp.length > 0) setWeeklyPlan(wp[0]);
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

function WeeklyRoutineSetup({ plan, onComplete }: { plan: any; onComplete: () => void }) {
  const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  const dayLabels: Record<string, string> = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo' };

  const mealsPerDay = Math.max(plan.meal_plan_base?.meals_per_day || 5, 3);
  const defaultMealNames = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'];
  const mealNames = defaultMealNames.slice(0, mealsPerDay);

  const [routine, setRoutine] = useState<any>(() => {
    const r: any = {};
    days.forEach(d => {
      r[d] = { meals: {}, gym: true };
      mealNames.forEach(m => { r[d].meals[m] = 'casa'; });
    });
    return r;
  });
  const [generating, setGenerating] = useState(false);

  async function generatePlan() {
    setGenerating(true);
    const res = await fetch('/api/weekly-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routine, mealPlanBase: plan.meal_plan_base, exercisePlanBase: plan.exercise_plan_base, goals: plan.goals, mealNames }),
    });
    const weekPlan = await res.json();

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);

    const { data: existingWeeks } = await supabase.from('weekly_plans').select('week_number').eq('plan_id', plan.id).order('week_number', { ascending: false }).limit(1);
    const nextWeek = (existingWeeks && existingWeeks.length > 0) ? existingWeeks[0].week_number + 1 : 1;

    await supabase.from('weekly_plans').insert({
      plan_id: plan.id, week_number: nextWeek, week_start: weekStart.toISOString().split('T')[0],
      routine, meal_plan_detailed: weekPlan.meal_plan || {}, exercise_plan_detailed: weekPlan.exercise_plan || {},
      submitted_at: new Date().toISOString(),
    });
    setGenerating(false);
    onComplete();
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-medium mb-1">Planeje sua semana</h2>
      <p className="text-gray-400 text-sm mb-1">Plano de {plan.duration_months} meses — {mealsPerDay} refeições/dia</p>
      <p className="text-gray-400 text-xs mb-4">Informe onde você vai estar em cada refeição e se terá acesso à academia.</p>

      {days.map(day => (
        <div key={day} className="mb-4 bg-gray-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{dayLabels[day]}</span>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input type="checkbox" checked={routine[day].gym} onChange={() => setRoutine((prev: any) => ({ ...prev, [day]: { ...prev[day], gym: !prev[day].gym } }))} className="rounded" />
              Academia
            </label>
          </div>
          <div className="space-y-1">
            {mealNames.map(meal => (
              <div key={meal} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{meal}</span>
                <button onClick={() => setRoutine((prev: any) => ({ ...prev, [day]: { ...prev[day], meals: { ...prev[day].meals, [meal]: prev[day].meals[meal] === 'casa' ? 'fora' : 'casa' } } }))}
                  className={`text-xs px-3 py-1 rounded-full ${routine[day].meals[meal] === 'casa' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                  {routine[day].meals[meal] === 'casa' ? 'Casa' : 'Fora'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button onClick={generatePlan} disabled={generating} className="w-full py-4 bg-teal-400 text-white rounded-2xl font-medium disabled:opacity-50">
        {generating ? 'Gerando seu plano semanal...' : 'Gerar plano da semana'}
      </button>
    </div>
  );
}
