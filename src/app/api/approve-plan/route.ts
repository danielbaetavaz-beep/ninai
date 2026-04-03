import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { planId, goals, meal_plan_base, monthly_plan } = await request.json();
    const { error } = await supabase.from('plans').update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      start_date: new Date().toISOString().split('T')[0],
      goals,
      meal_plan_base,
      monthly_plan,
    }).eq('id', planId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
