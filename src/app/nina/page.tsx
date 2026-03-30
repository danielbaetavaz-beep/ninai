'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function NinaPanel() {
  const [profile, setProfile] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [selectedWeeklyPlan, setSelectedWeeklyPlan] = useState<any>(null);
  const [pendingWeeklyPlans, setPendingWeeklyPlans] = useState<any[]>([]);
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

    // Load pending weekly plans
    const { data: weeklyPlans } = await supabase.from('weekly_plans').select('*, plans:plan_id(patient_id, profiles:patient_id(name))').eq('status', 'pending_nina_approval').order('created_at', { ascending: false });
    setPendingWeeklyPlans(weeklyPlans || []);

    const { data: al } = await supabase.from('alerts').select('*, profiles:patient_id(name)').eq('read', false).order('created_at', { ascending: false });
    setAlerts(al || []);
    setLoading(false);
  }

  async function approvePlan(planId: string, updatedPlan?: any) {
    const updateData: any = { status: 'approved', approved_at: new Date().toISOString(), start_date: new Date().toISOString().split('T')[0] };
    if (updatedPlan) {
      if (updatedPlan.goals) updateData.goals = updatedPlan.goals;
      if (updatedPlan.meal_plan_base) updateData.meal_plan_base = updatedPlan.meal_plan_base;
      if (updatedPlan.exercise_plan_base) updateData.exercise_plan_base = updatedPlan.exercise_plan_base;
    }
    await supabase.from('plans').update(updateData).eq('id', planId);
    setSelectedPlan(null);
    loadData();
  }

  async function requestConsultation(planId: string) {
    await supabase.from('plans').update({ status: 'consultation_requested' }).eq('id', planId);
    setSelectedPlan(null);
    loadData();
  }

  async function uploadExamResults(planId: string, file: File) {
    const fileName = `${planId}/exam_${Date.now()}.pdf`;
    await supabase.storage.from('exam-results').upload(fileName, file);
    const { data: urlData } = supabase.storage.from('exam-results').getPublicUrl(fileName);
    const { data: plan } = await supabase.from('plans').select('exam_results').eq('id', planId).single();
    const existing = plan?.exam_results || [];
    await supabase.from('plans').update({
      exam_results: [...existing, { url: urlData.publicUrl, uploaded_at: new Date().toISOString(), name: file.name }],
      status: 'pending_review',
    }).eq('id', planId);
    loadData();
  }

  async function approveWeeklyPlan(weeklyPlanId: string, updatedMealPlan?: any) {
    const updateData: any = { status: 'approved', approved_at: new Date().toISOString() };
    if (updatedMealPlan) updateData.meal_plan_detailed = updatedMealPlan;
    await supabase.from('weekly_plans').update(updateData).eq('id', weeklyPlanId);
    setSelectedWeeklyPlan(null);
    loadData();
  }

  async function markAlertRead(alertId: string) {
    await supabase.from('alerts').update({ read: true }).eq('id', alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Carregando...</p></div>;

  if (selectedWeeklyPlan) return <WeeklyPlanReview weeklyPlan={selectedWeeklyPlan} onApprove={approveWeeklyPlan} onBack={() => setSelectedWeeklyPlan(null)} />;
  if (selectedPlan) return <PlanReview plan={selectedPlan} onApprove={approvePlan} onRequestConsultation={() => requestConsultation(selectedPlan.id)} onUploadExam={(file: File) => uploadExamResults(selectedPlan.id, file)} onBack={() => setSelectedPlan(null)} />;

  const pending = patients.filter(p => p.status === 'pending_review' || p.status === 'consultation_requested');

  return (
    <div className="min-h-screen">
      <div className="p-4 border-b border-gray-100">
        <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span> <span className="text-gray-400 text-sm">— Painel da Nina</span></h1>
      </div>

      {alerts.length > 0 && (
        <div className="p-4 pb-0">
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

      {/* Pending weekly plans — point 16 */}
      {pendingWeeklyPlans.length > 0 && (
        <div className="p-4 pb-0">
          <p className="text-sm font-medium mb-2">Cardápios semanais para aprovar ({pendingWeeklyPlans.length})</p>
          {pendingWeeklyPlans.map(wp => (
            <div key={wp.id} onClick={() => setSelectedWeeklyPlan(wp)} className="flex items-center gap-3 p-3 border border-blue-200 bg-blue-50 rounded-xl mb-2 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center text-white font-medium">
                📋
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800">{(wp as any).plans?.profiles?.name || 'Paciente'}</p>
                <p className="text-xs text-blue-600">Semana {wp.week_number} — início {wp.week_start}</p>
              </div>
              <span className="text-xs text-blue-400">→</span>
            </div>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <div className="p-4 pb-0">
          <p className="text-sm font-medium mb-2">Planos para revisar ({pending.length})</p>
          {pending.map(p => (
            <div key={p.id} onClick={() => setSelectedPlan(p)} className="flex items-center gap-3 p-3 border border-teal-200 bg-teal-50 rounded-xl mb-2 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-teal-400 flex items-center justify-center text-white font-medium">
                {(p as any).profiles?.name?.[0] || '?'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-teal-800">{(p as any).profiles?.name || 'Paciente'}</p>
                <p className="text-xs text-teal-600">{p.status === 'consultation_requested' ? 'Consulta solicitada — upload resultados' : 'Novo plano para revisar'}</p>
              </div>
              <span className="text-xs text-teal-400">→</span>
            </div>
          ))}
        </div>
      )}

      <div className="p-4">
        <p className="text-sm font-medium mb-2">Todos os pacientes</p>
        {patients.map(p => (
          <div key={p.id} onClick={() => setSelectedPlan(p)} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl mb-2 cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium">
              {(p as any).profiles?.name?.[0] || '?'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{(p as any).profiles?.name || 'Paciente'}</p>
              <p className="text-xs text-gray-400">
                {p.status === 'approved' ? 'Plano ativo' : p.status === 'pending_review' ? 'Aguardando revisão' : p.status === 'onboarding' ? 'Em onboarding' : p.status}
              </p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              p.status === 'approved' ? 'bg-green-50 text-green-800' : p.status === 'pending_review' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-500'
            }`}>{p.status === 'approved' ? 'Ativo' : p.status === 'pending_review' ? 'Revisar' : p.status}</span>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-100">
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} className="w-full py-3 border border-gray-200 rounded-xl text-sm text-gray-500">Sair</button>
      </div>
    </div>
  );
}

// Plan review with editable fields (point 14 for Nina side)
function PlanReview({ plan, onApprove, onRequestConsultation, onUploadExam, onBack }: any) {
  const [showConversation, setShowConversation] = useState(false);
  const [editablePlan, setEditablePlan] = useState<any>({
    goals: plan.goals || [],
    meal_plan_base: plan.meal_plan_base || {},
    exercise_plan_base: plan.exercise_plan_base || {},
  });
  const [editingGoal, setEditingGoal] = useState<number | null>(null);
  const conv = plan.onboarding_conversation || [];

  function updateGoal(index: number, field: string, value: string) {
    const updated = { ...editablePlan };
    updated.goals = [...updated.goals];
    updated.goals[index] = { ...updated.goals[index], [field]: value };
    setEditablePlan(updated);
  }

  function updateMealField(field: string, value: any) {
    setEditablePlan((prev: any) => ({
      ...prev,
      meal_plan_base: { ...prev.meal_plan_base, [field]: value }
    }));
  }

  return (
    <div className="min-h-screen">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400">← Voltar</button>
        <h2 className="text-lg font-medium">{(plan as any).profiles?.name || 'Paciente'}</h2>
      </div>

      <div className="p-4">
        {plan.technical_diagnosis && (
          <>
            <p className="text-sm font-medium mb-2">Diagnóstico técnico</p>
            <div className="bg-purple-50 rounded-xl p-3 mb-4 text-xs text-purple-800 leading-relaxed whitespace-pre-wrap">
              {plan.technical_diagnosis}
            </div>
          </>
        )}

        <p className="text-sm font-medium mb-2">Metas (toque para editar)</p>
        {(editablePlan.goals || []).map((g: any, i: number) => (
          <div key={i} className="py-2 border-b border-gray-50 cursor-pointer" onClick={() => setEditingGoal(editingGoal === i ? null : i)}>
            {editingGoal === i ? (
              <div className="space-y-2 bg-gray-50 rounded-xl p-3" onClick={e => e.stopPropagation()}>
                <input value={g.description || ''} onChange={e => updateGoal(i, 'description', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" placeholder="Descrição" />
                <input value={g.measurement || ''} onChange={e => updateGoal(i, 'measurement', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" placeholder="Como medir" />
                <input value={g.timeframe || ''} onChange={e => updateGoal(i, 'timeframe', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" placeholder="Prazo" />
                <button onClick={() => setEditingGoal(null)} className="text-xs text-teal-600 font-medium">✓ OK</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                <div className="flex-1">
                  <p className="text-sm">{g.description || g.type}</p>
                  <p className="text-[10px] text-gray-400">{g.measurement} — {g.timeframe}</p>
                </div>
                <span className="text-[10px] text-gray-300">editar</span>
              </div>
            )}
          </div>
        ))}

        {editablePlan.meal_plan_base && (
          <>
            <p className="text-sm font-medium mt-4 mb-2">Plano alimentar (editável)</p>
            <div className="bg-gray-50 rounded-xl p-3 mb-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400">Calorias</label>
                  <input type="number" value={editablePlan.meal_plan_base.calories || ''} onChange={e => updateMealField('calories', Number(e.target.value))} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">Refeições/dia</label>
                  <select value={editablePlan.meal_plan_base.meals_per_day || 5} onChange={e => updateMealField('meals_per_day', Number(e.target.value))} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1">
                    {[3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">Proteína (g)</label>
                  <input type="number" value={editablePlan.meal_plan_base.protein_g || ''} onChange={e => updateMealField('protein_g', Number(e.target.value))} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">Carbo (g)</label>
                  <input type="number" value={editablePlan.meal_plan_base.carbs_g || ''} onChange={e => updateMealField('carbs_g', Number(e.target.value))} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">Gordura (g)</label>
                  <input type="number" value={editablePlan.meal_plan_base.fat_g || ''} onChange={e => updateMealField('fat_g', Number(e.target.value))} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1" />
                </div>
              </div>
            </div>
          </>
        )}

        {plan.scientific_rationale && (
          <>
            <p className="text-sm font-medium mt-4 mb-2">Racional científico</p>
            <div className="bg-blue-50 rounded-xl p-3 mb-2 text-xs text-blue-800 leading-relaxed whitespace-pre-wrap">
              {plan.scientific_rationale}
            </div>
          </>
        )}

        <button onClick={() => setShowConversation(!showConversation)} className="w-full mt-2 py-2 border border-gray-200 rounded-xl text-sm text-gray-500">
          {showConversation ? 'Ocultar conversa' : 'Ver conversa do onboarding'}
        </button>
        {showConversation && (
          <div className="mt-2 bg-gray-50 rounded-xl p-3 max-h-60 overflow-y-auto">
            {conv.map((m: any, i: number) => (
              <div key={i} className={`mb-2 ${m.role === 'assistant' ? '' : 'text-right'}`}>
                <span className={`inline-block px-3 py-2 rounded-xl text-xs ${m.role === 'assistant' ? 'bg-teal-50 text-teal-800' : 'bg-white text-gray-700'}`}>
                  {m.content}
                </span>
              </div>
            ))}
          </div>
        )}

        {plan.exam_results?.length > 0 && (
          <>
            <p className="text-sm font-medium mt-4 mb-2">Exames enviados</p>
            {plan.exam_results.map((e: any, i: number) => (
              <a key={i} href={e.url} target="_blank" className="block p-2 bg-gray-50 rounded-lg mb-1 text-xs text-blue-600">{e.name}</a>
            ))}
          </>
        )}

        <div className="mt-6 space-y-2">
          {plan.status === 'consultation_requested' && (
            <label className="block w-full py-3 bg-purple-400 text-white rounded-xl text-sm font-medium text-center cursor-pointer">
              Upload resultados da consulta/exames
              <input type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) onUploadExam(e.target.files[0]); }} />
            </label>
          )}
          <button onClick={() => onApprove(plan.id, editablePlan)} className="w-full py-3 bg-teal-400 text-white rounded-xl text-sm font-medium">
            Aprovar plano (com edições)
          </button>
          {plan.status !== 'consultation_requested' && (
            <button onClick={onRequestConsultation} className="w-full py-3 border border-amber-300 text-amber-700 rounded-xl text-sm font-medium">
              Solicitar consulta antes de aprovar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Weekly plan review for Nina — point 16
function WeeklyPlanReview({ weeklyPlan, onApprove, onBack }: { weeklyPlan: any; onApprove: (id: string, mealPlan?: any) => void; onBack: () => void }) {
  const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  const dayLabels: Record<string, string> = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo' };
  
  const [mealPlan, setMealPlan] = useState<any>(weeklyPlan.meal_plan_detailed || {});
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [editingMeal, setEditingMeal] = useState<string | null>(null);

  const dayDates = weeklyPlan.day_dates || weeklyPlan.routine || {};
  const patientName = (weeklyPlan as any).plans?.profiles?.name || 'Paciente';

  function updateMealDescription(day: string, mealIndex: number, newDesc: string) {
    const updated = { ...mealPlan };
    updated[day] = [...(updated[day] || [])];
    updated[day][mealIndex] = { ...updated[day][mealIndex], description: newDesc };
    setMealPlan(updated);
  }

  return (
    <div className="min-h-screen">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400">← Voltar</button>
        <div>
          <h2 className="text-lg font-medium">{patientName}</h2>
          <p className="text-xs text-gray-400">Semana {weeklyPlan.week_number} — início {weeklyPlan.week_start}</p>
        </div>
      </div>

      <div className="p-4">
        <p className="text-sm text-gray-500 mb-4">Revise o cardápio semanal. Toque em qualquer refeição para editar a descrição.</p>

        {days.map(day => {
          const dayMeals = mealPlan[day] || [];
          const dateStr = dayDates[day]?.date || dayDates[day] || '';
          const exPlan = weeklyPlan.exercise_plan_detailed?.[day];
          const isOpen = expandedDay === day;

          return (
            <div key={day} className="mb-3">
              <button onClick={() => setExpandedDay(isOpen ? null : day)} className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{dayLabels[day]}</span>
                  {dateStr && <span className="text-[10px] text-gray-400">{typeof dateStr === 'string' ? dateStr.slice(5) : ''}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{dayMeals.length} refeições</span>
                  <svg className={`w-4 h-4 text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </button>

              {isOpen && (
                <div className="mt-1 space-y-2 pl-2 pr-2">
                  {dayMeals.map((meal: any, idx: number) => {
                    const mealKey = `${day}-${idx}`;
                    return (
                      <div key={idx} className="bg-white border border-gray-100 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-teal-700">{meal.meal}</p>
                          {meal.location && <span className="text-[10px] bg-gray-50 px-2 py-0.5 rounded-full text-gray-400">{meal.location}</span>}
                        </div>
                        {editingMeal === mealKey ? (
                          <div>
                            <textarea
                              value={meal.description}
                              onChange={e => updateMealDescription(day, idx, e.target.value)}
                              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-teal-400 resize-none"
                              rows={3}
                            />
                            <button onClick={() => setEditingMeal(null)} className="text-[10px] text-teal-600 font-medium mt-1">✓ OK</button>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-600 cursor-pointer" onClick={() => setEditingMeal(mealKey)}>
                            {meal.description} <span className="text-gray-300 ml-1">✎</span>
                          </p>
                        )}
                        {meal.macros && (
                          <div className="flex gap-3 mt-2 text-[10px] text-gray-400">
                            <span>P: {meal.macros.protein_g}g</span>
                            <span>C: {meal.macros.carbs_g}g</span>
                            <span>G: {meal.macros.fat_g}g</span>
                            <span>{meal.macros.calories} kcal</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {exPlan && (
                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-xs font-medium text-blue-700">Exercício: {exPlan.type}</p>
                      <p className="text-xs text-blue-600">{exPlan.description}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="mt-6 space-y-2">
          <button onClick={() => onApprove(weeklyPlan.id, mealPlan)} className="w-full py-3 bg-teal-400 text-white rounded-xl text-sm font-medium">
            Aprovar cardápio semanal
          </button>
          <button onClick={onBack} className="w-full py-3 border border-gray-200 text-gray-500 rounded-xl text-sm">Voltar</button>
        </div>
      </div>
    </div>
  );
}
