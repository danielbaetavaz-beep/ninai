'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Login from './login/page';

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [redirecting, setRedirecting] = useState(false);
  const router = useRouter();

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

  // Handle redirects in useEffect, not during render
  useEffect(() => {
    if (loading || !session || redirecting) return;

    if (profile?.role === 'nutritionist') {
      setRedirecting(true);
      router.push('/nina');
      return;
    }

    if (!plan || plan.status === 'onboarding') {
      setRedirecting(true);
      router.push(plan ? `/onboarding?plan=${plan.id}` : '/dashboard');
      return;
    }

    setRedirecting(true);
    router.push('/dashboard');
  }, [loading, session, profile, plan, redirecting, router]);

  if (loading || redirecting) return <div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}><div className="text-gray-400">Carregando...</div></div>;
  if (!session) return <Login />;

  return <div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}><div className="text-gray-400">Carregando...</div></div>;
}
