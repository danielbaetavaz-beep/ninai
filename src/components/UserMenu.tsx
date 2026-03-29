'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function UserMenu({ profile, plan }: { profile: any; plan?: any }) {
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  const initial = profile?.name?.[0]?.toUpperCase() || '?';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center text-teal-800 text-sm font-medium"
      >
        {initial}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-sm font-medium truncate">{profile?.name || 'Usuário'}</p>
              <p className="text-xs text-gray-400 truncate">{profile?.email}</p>
            </div>

            {plan && (
              <button
                onClick={() => { setOpen(false); window.location.href = '/dashboard'; }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Plano ativo
              </button>
            )}

            <button
              onClick={() => { setOpen(false); window.location.href = '/dashboard?tab=plano'; }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Meus planos
            </button>

            <button
              onClick={() => { setOpen(false); window.location.href = '/dashboard?tab=perfil'; }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Perfil
            </button>

            <div className="border-t border-gray-50">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
              >
                Sair da conta
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
