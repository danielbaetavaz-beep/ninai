import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    runtime: process.env.NEXT_RUNTIME || 'unknown',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: url
        ? `✅ ${url.substring(0, 30)}...`
        : '❌ MISSING',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey
        ? `✅ ${anonKey.substring(0, 20)}... (${anonKey.length} chars)`
        : '❌ MISSING',
      SUPABASE_SERVICE_ROLE_KEY: serviceKey
        ? `✅ present (${serviceKey.length} chars)`
        : '❌ MISSING',
      ANTHROPIC_API_KEY: anthropicKey
        ? `✅ ${anthropicKey.substring(0, 12)}... (${anthropicKey.length} chars)`
        : '❌ MISSING',
    },
  });
}
