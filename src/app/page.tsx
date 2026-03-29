'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Login from './login/page';

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else { setLoading(false); setProfile(null); setPlan(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(prof);
    if (prof) {
      const { data: plans } = await supabase.from('plans').select('*').eq('patient_id', userId).order('created_at', { ascending: false }).limit(1);
      if (plans && plans.length > 0) setPlan(plans[0]);
    }
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400">Carregando...</div></div>;
  if (!session) return <Login />;

  if (profile?.role === 'nutritionist') {
    window.location.href = '/nina';
    return null;
  }

  if (!plan || plan.status === 'onboarding') {
    window.location.href = plan ? `/onboarding?plan=${plan.id}` : '/dashboard';
    return null;
  }

  window.location.href = '/dashboard';
  return null;
}
