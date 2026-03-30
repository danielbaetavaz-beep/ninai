'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const NINA_EMAIL = 'izagiffoni@hotmail.com';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isSignUp) {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) { setError(signUpError.message); setLoading(false); return; }
      if (data.user) {
        const role = email.toLowerCase().trim() === NINA_EMAIL ? 'nutritionist' : 'patient';
        await supabase.from('profiles').insert({
          id: data.user.id,
          email,
          name,
          role,
        });
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setError(signInError.message); setLoading(false); return; }
    }
    setLoading(false);
    window.location.href = '/';
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold">
          nin<span className="text-teal-400">AI</span>
        </h1>
        <p className="text-gray-400 text-sm mt-2">Seu plano nutricional inteligente</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {isSignUp && (
          <input
            type="text"
            placeholder="Seu nome"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal-400"
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal-400"
          required
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal-400"
          required
          minLength={6}
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-teal-400 text-white font-medium text-sm disabled:opacity-50"
        >
          {loading ? 'Aguarde...' : isSignUp ? 'Criar conta' : 'Entrar'}
        </button>

        <button
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
          className="w-full text-sm text-gray-400 py-2"
        >
          {isSignUp ? 'Já tenho conta → Entrar' : 'Não tenho conta → Criar'}
        </button>
      </form>
    </div>
  );
}
