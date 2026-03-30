'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function NinaPanel() {
  const [profile, setProfile] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [tab, setTab] = useState<'patients' | 'materials'>('patients');
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

    setLoading(false);
  }

  async function markAlertRead(alertId: string) {
    await supabase.from('alerts').update({ read: true }).eq('id', alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }

  async function uploadMaterial(file: File, description: string) {
    const fileName = `material_${Date.now()}_${file.name}`;
    await supabase.storage.from('nina-materials').upload(fileName, file);
    const { data: urlData } = supabase.storage.from('nina-materials').getPublicUrl(fileName);

    await supabase.from('nina_materials').insert({
      uploaded_by: profile.id,
      name: file.name,
      description,
      file_url: urlData.publicUrl,
      file_type: file.name.endsWith('.pdf') ? 'pdf' : 'other',
    });
    loadData();
  }

  async function deleteMaterial(id: string) {
    await supabase.from('nina_materials').delete().eq('id', id);
    setMaterials(prev => prev.filter(m => m.id !== id));
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Carregando...</p></div>;
  if (selectedPlan) return <UnifiedPlanReview plan={selectedPlan} materials={materials} onBack={() => { setSelectedPlan(null); loadData(); }} />;

  const pending = patients.filter(p => p.status === 'pending_review' || p.status === 'consultation_requested');

  return (
    <div className="min-h-screen">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h1 className="text-lg font-medium">nin<span className="text-teal-400">AI</span> <span className="text-gray-400 text-sm">— Nina</span></h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('patients')} className={`text-xs px-3 py-1 rounded-full ${tab === 'patients' ? 'bg-teal-400 text-white' : 'bg-gray-100 text-gray-500'}`}>Pacientes</button>
          <button onClick={() => setTab('materials')} className={`text-xs px-3 py-1 rounded-full ${tab === 'materials' ? 'bg-teal-400 text-white' : 'bg-gray-100 text-gray-500'}`}>Materiais</button>
        </div>
      </div>

      {/* Materials tab */}
      {tab === 'materials' && (
        <div className="p-4">
          <p className="text-sm font-medium mb-2">Materiais de referência</p>
          <p className="text-xs text-gray-400 mb-4">Faça upload de planos, protocolos, livros (PDF) para a IA usar como referência na criação de cardápios.</p>
          
          <MaterialUpload onUpload={uploadMaterial} />

          <div className="mt-4 space-y-2">
            {materials.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-medium">
                  {m.file_type === 'pdf' ? 'PDF' : '📄'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  <p className="text-xs text-gray-400">{m.description || 'Sem descrição'}</p>
                </div>
                <button onClick={() => deleteMaterial(m.id)} className="text-xs text-red-400">✕</button>
              </div>
            ))}
            {materials.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhum material enviado ainda</p>}
          </div>

          <div className="mt-6 border-t border-gray-100 pt-4">
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} className="w-full py-3 border border-gray-200 rounded-xl text-sm text-gray-500">Sair</button>
          </div>
        </div>
      )}

      {/* Patients tab */}
      {tab === 'patients' && (
        <>
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

          {pending.length > 0 && (
            <div className="p-4 pb-0">
              <p className="text-sm font-medium mb-2">Para revisar ({pending.length})</p>
              {pending.map(p => (
                <div key={p.id} onClick={() => setSelectedPlan(p)} className="flex items-center gap-3 p-3 border border-teal-200 bg-teal-50 rounded-xl mb-2 cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-teal-400 flex items-center justify-center text-white font-medium">{(p as any).profiles?.name?.[0] || '?'}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-teal-800">{(p as any).profiles?.name || 'Paciente'}</p>
                    <p className="text-xs text-teal-600">Plano + cardápio para revisar</p>
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
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium">{(p as any).profiles?.name?.[0] || '?'}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{(p as any).profiles?.name || 'Paciente'}</p>
                  <p className="text-xs text-gray-400">{p.status === 'approved' ? 'Plano ativo' : p.status === 'pending_review' ? 'Aguardando revisão' : p.status}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.status === 'approved' ? 'bg-green-50 text-green-800' : p.status === 'pending_review' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>{p.status === 'approved' ? 'Ativo' : p.status === 'pending_review' ? 'Revisar' : p.status}</span>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-100">
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }} className="w-full py-3 border border-gray-200 rounded-xl text-sm text-gray-500">Sair</button>
          </div>
        </>
      )}
    </div>
  );
}

// Material upload component
function MaterialUpload({ onUpload }: { onUpload: (file: File, desc: string) => void }) {
  const [desc, setDesc] = useState('');
  const [uploading, setUploading] = useState(false);

  return (
    <div className="bg-purple-50 rounded-xl p-4">
      <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descrição do material (opcional)" className="w-full text-sm border border-purple-200 rounded-lg px-3 py-2 mb-2 bg-white" />
      <label className={`block w-full py-3 text-center rounded-xl text-sm font-medium cursor-pointer ${uploading ? 'bg-gray-300 text-gray-500' : 'bg-purple-400 text-white'}`}>
        {uploading ? 'Enviando...' : 'Upload PDF / documento'}
        <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={async e => {
          if (e.target.files?.[0]) {
            setUploading(true);
            await onUpload(e.target.files[0], desc);
            setDesc('');
            setUploading(false);
          }
        }} />
      </label>
    </div>
  );
}

// Unified plan review — Nina sees everything and approves once
function UnifiedPlanReview({ plan, materials, onBack }: { plan: any; materials: any[]; onBack: () => void }) {
  const [showConversation, setShowConversation] = useState(false);
  const [editingGoal, setEditingGoal] = useState<number | null>(null);
  const [editingMeal, setEditingMeal] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  const [editablePlan, setEditablePlan] = useState<any>({
    goals: plan.goals || [],
    meal_plan_base: plan.meal_plan_base || {},
    exercise_plan_base: plan.exercise_plan_base || {},
  });
  const [detailedPlan, setDetailedPlan] = useState<any>(plan.detailed_plan || {});
  const detailedDays = detailedPlan.days || [];

  const conv = plan.onboarding_conversation || [];
  const schedule = plan.initial_schedule || [];

  function updateGoal(index: number, field: string, value: string) {
    setEditablePlan((prev: any) => {
      const goals = [...prev.goals];
      goals[index] = { ...goals[index], [field]: value };
      return { ...prev, goals };
    });
  }

  function updateMealField(field: string, value: any) {
    setEditablePlan((prev: any) => ({ ...prev, meal_plan_base: { ...prev.meal_plan_base, [field]: value } }));
  }

  function updateDayMeal(dayIdx: number, mealIdx: number, newDesc: string) {
    setDetailedPlan((prev: any) => {
      const days = [...(prev.days || [])];
      days[dayIdx] = { ...days[dayIdx], meals: [...days[dayIdx].meals] };
      days[dayIdx].meals[mealIdx] = { ...days[dayIdx].meals[mealIdx], description: newDesc };
      return { ...prev, days };
    });
  }

  function updateDayExercise(dayIdx: number, field: string, value: string) {
    setDetailedPlan((prev: any) => {
      const days = [...(prev.days || [])];
      days[dayIdx] = { ...days[dayIdx], exercise: { ...days[dayIdx].exercise, [field]: value } };
      return { ...prev, days };
    });
  }

  async function approvePlan() {
    setApproving(true);

    // Save daily_schedule entries
    for (const day of schedule) {
      await supabase.from('daily_schedule').upsert({
        plan_id: plan.id,
        date: day.date,
        morning: day.morning,
        afternoon: day.afternoon,
        evening: day.evening,
        has_gym: day.has_gym,
      }, { onConflict: 'plan_id,date' });
    }

    // Save daily_plans entries
    for (const day of (detailedPlan.days || [])) {
      await supabase.from('daily_plans').upsert({
        plan_id: plan.id,
        date: day.date,
        meals: day.meals,
        exercise: day.exercise,
        status: 'active',
      }, { onConflict: 'plan_id,date' });
    }

    // Update plan with edits and approve
    await supabase.from('plans').update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      start_date: new Date().toISOString().split('T')[0],
      goals: editablePlan.goals,
      meal_plan_base: editablePlan.meal_plan_base,
      exercise_plan_base: editablePlan.exercise_plan_base,
      detailed_plan: detailedPlan,
    }).eq('id', plan.id);

    setApproving(false);
    onBack();
  }

  async function requestConsultation() {
    await supabase.from('plans').update({ status: 'consultation_requested' }).eq('id', plan.id);
    onBack();
  }

  const dayLabels: Record<string, string> = { '0': 'Dom', '1': 'Seg', '2': 'Ter', '3': 'Qua', '4': 'Qui', '5': 'Sex', '6': 'Sáb' };

  return (
    <div className="min-h-screen">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400">← Voltar</button>
        <h2 className="text-lg font-medium">{(plan as any).profiles?.name || 'Paciente'}</h2>
      </div>

      <div className="p-4">
        {/* Technical diagnosis */}
        {plan.technical_diagnosis && (
          <>
            <p className="text-sm font-medium mb-2">Diagnóstico técnico</p>
            <div className="bg-purple-50 rounded-xl p-3 mb-4 text-xs text-purple-800 leading-relaxed whitespace-pre-wrap">{plan.technical_diagnosis}</div>
          </>
        )}

        {/* Editable goals */}
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
              </div>
            )}
          </div>
        ))}

        {/* Editable meal plan base */}
        <p className="text-sm font-medium mt-4 mb-2">Plano alimentar base</p>
        <div className="bg-gray-50 rounded-xl p-3 mb-2">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Calorias', field: 'calories', val: editablePlan.meal_plan_base.calories },
              { label: 'Refeições/dia', field: 'meals_per_day', val: editablePlan.meal_plan_base.meals_per_day },
              { label: 'Proteína (g)', field: 'protein_g', val: editablePlan.meal_plan_base.protein_g },
              { label: 'Carbo (g)', field: 'carbs_g', val: editablePlan.meal_plan_base.carbs_g },
              { label: 'Gordura (g)', field: 'fat_g', val: editablePlan.meal_plan_base.fat_g },
            ].map(item => (
              <div key={item.field}>
                <label className="text-[10px] text-gray-400">{item.label}</label>
                <input type="number" value={item.val || ''} onChange={e => updateMealField(item.field, Number(e.target.value))} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Editable exercise base */}
        <p className="text-sm font-medium mt-4 mb-2">Exercícios base</p>
        <div className="bg-blue-50 rounded-xl p-3 mb-2">
          <select value={editablePlan.exercise_plan_base.weekly_frequency || 3} onChange={e => setEditablePlan((prev: any) => ({ ...prev, exercise_plan_base: { ...prev.exercise_plan_base, weekly_frequency: Number(e.target.value) } }))} className="text-sm border border-blue-200 rounded-lg px-2 py-1 bg-white mb-2 w-full">
            {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}x por semana</option>)}
          </select>
          {(editablePlan.exercise_plan_base.activities || []).map((a: any, idx: number) => (
            <div key={idx} className="flex gap-2 mb-1">
              <input value={a.type || ''} onChange={e => {
                const acts = [...editablePlan.exercise_plan_base.activities];
                acts[idx] = { ...a, type: e.target.value };
                setEditablePlan((prev: any) => ({ ...prev, exercise_plan_base: { ...prev.exercise_plan_base, activities: acts } }));
              }} className="flex-1 text-sm border border-blue-200 rounded-lg px-2 py-1 bg-white" />
              <input value={a.frequency || ''} onChange={e => {
                const acts = [...editablePlan.exercise_plan_base.activities];
                acts[idx] = { ...a, frequency: e.target.value };
                setEditablePlan((prev: any) => ({ ...prev, exercise_plan_base: { ...prev.exercise_plan_base, activities: acts } }));
              }} className="w-28 text-sm border border-blue-200 rounded-lg px-2 py-1 bg-white" />
            </div>
          ))}
        </div>

        {/* Detailed daily plan — editable */}
        {detailedDays.length > 0 && (
          <>
            <p className="text-sm font-medium mt-4 mb-2">Cardápio detalhado ({detailedDays.length} dias)</p>
            <p className="text-xs text-gray-400 mb-3">Toque para editar qualquer refeição ou exercício</p>

            {detailedDays.map((day: any, dayIdx: number) => {
              const dateObj = new Date(day.date + 'T12:00:00');
              const label = dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

              return (
                <div key={dayIdx} className="mb-3 bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">{label}</p>

                  {(day.meals || []).map((meal: any, mealIdx: number) => {
                    const mealKey = `${dayIdx}-${mealIdx}`;
                    return (
                      <div key={mealIdx} className="mb-2 bg-white rounded-lg p-2">
                        <p className="text-[10px] font-medium text-teal-700">{meal.meal}</p>
                        {editingMeal === mealKey ? (
                          <div onClick={e => e.stopPropagation()}>
                            <textarea value={meal.description} onChange={e => updateDayMeal(dayIdx, mealIdx, e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1 resize-none mt-1" rows={2} />
                            <button onClick={() => setEditingMeal(null)} className="text-[10px] text-teal-600">✓</button>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-600 cursor-pointer mt-0.5" onClick={() => setEditingMeal(mealKey)}>{meal.description} <span className="text-gray-300">✎</span></p>
                        )}
                      </div>
                    );
                  })}

                  {day.exercise && (
                    <div className="bg-blue-50 rounded-lg p-2 mt-1">
                      {editingExercise === String(dayIdx) ? (
                        <div onClick={e => e.stopPropagation()}>
                          <input value={day.exercise.type || ''} onChange={e => updateDayExercise(dayIdx, 'type', e.target.value)} className="w-full text-xs border border-blue-200 rounded px-2 py-1 bg-white mb-1" />
                          <textarea value={day.exercise.description || ''} onChange={e => updateDayExercise(dayIdx, 'description', e.target.value)} className="w-full text-xs border border-blue-200 rounded px-2 py-1 bg-white resize-none" rows={2} />
                          <button onClick={() => setEditingExercise(null)} className="text-[10px] text-blue-600">✓</button>
                        </div>
                      ) : (
                        <div className="cursor-pointer" onClick={() => setEditingExercise(String(dayIdx))}>
                          <p className="text-[10px] font-medium text-blue-700">Exercício: {day.exercise.type} <span className="text-blue-300">✎</span></p>
                          <p className="text-xs text-blue-600">{day.exercise.description}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Conversation */}
        <button onClick={() => setShowConversation(!showConversation)} className="w-full mt-2 py-2 border border-gray-200 rounded-xl text-sm text-gray-500">
          {showConversation ? 'Ocultar conversa' : 'Ver conversa do onboarding'}
        </button>
        {showConversation && (
          <div className="mt-2 bg-gray-50 rounded-xl p-3 max-h-60 overflow-y-auto">
            {conv.map((m: any, i: number) => (
              <div key={i} className={`mb-2 ${m.role === 'assistant' ? '' : 'text-right'}`}>
                <span className={`inline-block px-3 py-2 rounded-xl text-xs ${m.role === 'assistant' ? 'bg-teal-50 text-teal-800' : 'bg-white text-gray-700'}`}>{m.content}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 space-y-2">
          <button onClick={approvePlan} disabled={approving} className="w-full py-3 bg-teal-400 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {approving ? 'Aprovando e salvando...' : 'Aprovar tudo e liberar para o paciente'}
          </button>
          {plan.status !== 'consultation_requested' && plan.status !== 'approved' && (
            <button onClick={requestConsultation} className="w-full py-3 border border-amber-300 text-amber-700 rounded-xl text-sm font-medium">
              Solicitar consulta antes de aprovar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
