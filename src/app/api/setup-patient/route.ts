import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json();

    if (action === 'create_user') {
      // Check if exists
      const { data: users } = await supabase.auth.admin.listUsers();
      const existing = users?.users?.find((u: any) => u.email === data.email);
      if (existing) return NextResponse.json({ userId: existing.id, existing: true });

      const { data: authData, error } = await supabase.auth.admin.createUser({
        email: data.email, password: data.password || '121212', email_confirm: true,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ userId: authData.user.id });
    }

    if (action === 'create_profile') {
      const { error } = await supabase.from('profiles').upsert(data.profile, { onConflict: 'id' });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === 'create_measurement') {
      const { error } = await supabase.from('patient_measurements').insert(data.measurement);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === 'create_plan') {
      const { data: plan, error } = await supabase.from('plans').insert(data.plan).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ planId: plan.id });
    }

    if (action === 'approve_plan') {
      const { error } = await supabase.from('plans').update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        start_date: new Date().toISOString().split('T')[0],
        goals: data.goals,
        meal_plan_base: data.meal_plan_base,
        monthly_plan: data.monthly_plan,
      }).eq('id', data.planId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
