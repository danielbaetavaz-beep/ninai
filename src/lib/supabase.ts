import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[ninAI] ❌ Supabase env vars missing at module load time!',
    JSON.stringify({
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      env: typeof window === 'undefined' ? 'server' : 'client',
    })
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurado.');
  }
  return createClient(supabaseUrl, serviceKey);
}
