'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ProfileTab({ profile, plan }: { profile: any; plan: any }) {
  const [allPlans, setAllPlans] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('plans').select('*').eq('patient_id', profile.id).order('created_at', { ascending: false }).then(({ data }) => setAllPlans(data || []));
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center text-teal-800 text-xl font-medium">
          {profile?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <p className="text-lg font-medium">{profile?.name || 'Paciente'}</p>
          <p className="text-xs text-gray-400">{profile?.email}</p>
        </div>
      </div>

      {plan && (
        <>
          <p className="text-sm font-medium mb-2">Plano atual</p>
          <div className="bg-teal-50 rounded-xl p-3 mb-4">
            <p className="text-sm text-teal-800 font-medium">Ciclo 1 — {plan.duration_months || 6} meses</p>
            <p className="text-xs text-teal-600 mt-1">Status: {plan.status === 'approved' ? 'Ativo' : plan.status === 'pending_review' ? 'Aguardando Nina' : plan.status}</p>
            <p className="text-xs text-teal-600">{plan.goals?.length || 0} metas definidas</p>
          </div>
        </>
      )}

      <p className="text-sm font-medium mb-2">Histórico de planos</p>
      {allPlans.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhum plano anterior.</p>
      ) : (
        allPlans.map((p, i) => (
          <div key={p.id} className={`p-3 rounded-xl mb-2 ${i === 0 ? 'bg-teal-50 border border-teal-200' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Ciclo {allPlans.length - i}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.status === 'approved' ? 'bg-green-50 text-green-800' : p.status === 'completed' ? 'bg-gray-200 text-gray-600' : 'bg-amber-50 text-amber-800'}`}>
                {p.status === 'approved' ? 'Ativo' : p.status === 'completed' ? 'Concluído' : 'Pendente'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{p.duration_months || '?'} meses — {p.goals?.length || 0} metas</p>
            <p className="text-xs text-gray-400">Criado em {new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        ))
      )}

      <button onClick={logout} className="w-full mt-6 py-3 border border-gray-200 rounded-xl text-sm text-gray-500">
        Sair da conta
      </button>
    </div>
  );
}
