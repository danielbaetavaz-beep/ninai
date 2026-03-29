'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function NinaPanel() {
  const [profile, setProfile] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [tab, setTab] = useState('patients');
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
    setLoading(false);
  }

  async function approvePlan(planId: string) {
    await supabase.from('plans').update({ status: 'approved', approved_at: new Date().toISOString(), start_date: new Date().toISOString().split('T')[0] }).eq('id', planId);
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

  async function markAlertRead(alertId: string) {
    await supabase.from('alerts').update({ read: true }).eq('id', alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">Carregando...</p></div>;

  if (selectedPlan) return <PlanReview plan={selectedPlan} onApprove={() => approvePlan(selectedPlan.id)} onRequestConsultation={() => requestConsultation(selectedPlan.id)} onUploadExam={(file: File) => uploadExamResults(selectedPlan.id, file)} onBack={() => setSelectedPlan(null)} />;

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

function PlanReview({ plan, onApprove, onRequestConsultation, onUploadExam, onBack }: any) {
  const [showConversation, setShowConversation] = useState(false);
  const conv = plan.onboarding_conversation || [];

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

        <p className="text-sm font-medium mb-2">Metas negociadas</p>
        {(plan.goals || []).map((g: any, i: number) => (
          <div key={i} className="flex items-center gap-2 py-2 border-b border-gray-50">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            <div className="flex-1">
              <p className="text-sm">{g.description || g.type}</p>
              <p className="text-[10px] text-gray-400">{g.measurement} — {g.timeframe}</p>
            </div>
          </div>
        ))}

        {plan.meal_plan_base && (
          <>
            <p className="text-sm font-medium mt-4 mb-2">Plano alimentar proposto</p>
            <div className="bg-gray-50 rounded-xl p-3 mb-2 text-xs text-gray-600 space-y-1">
              <p>Calorias: {plan.meal_plan_base.calories} kcal/dia</p>
              <p>Proteína: {plan.meal_plan_base.protein_g}g | Carbo: {plan.meal_plan_base.carbs_g}g | Gordura: {plan.meal_plan_base.fat_g}g</p>
              <p>Refeições: {plan.meal_plan_base.meals_per_day}x/dia</p>
              {plan.meal_plan_base.guidelines?.map((g: string, i: number) => <p key={i}>• {g}</p>)}
            </div>
          </>
        )}

        {plan.exercise_plan_base && (
          <>
            <p className="text-sm font-medium mt-4 mb-2">Plano de exercícios proposto</p>
            <div className="bg-gray-50 rounded-xl p-3 mb-2 text-xs text-gray-600 space-y-1">
              <p>Frequência: {plan.exercise_plan_base.weekly_frequency}x/semana</p>
              {plan.exercise_plan_base.activities?.map((a: any, i: number) => <p key={i}>• {a.type} — {a.frequency}</p>)}
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
          {showConversation ? 'Ocultar conversa' : 'Ver conversa completa do onboarding'}
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
          <button onClick={onApprove} className="w-full py-3 bg-teal-400 text-white rounded-xl text-sm font-medium">
            Aprovar plano e liberar para o paciente
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
