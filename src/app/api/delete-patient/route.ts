import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { planId, patientId, keepHistory } = await request.json();

    if (keepHistory) {
      await supabaseAdmin.from('plans').update({ status: 'archived' }).eq('id', planId);
      return NextResponse.json({ success: true });
    }

    // Full delete — order matters for foreign keys
    await supabaseAdmin.from('direct_messages').delete().eq('plan_id', planId);
    await supabaseAdmin.from('favorite_meals').delete().eq('plan_id', planId);
    await supabaseAdmin.from('patient_files').delete().eq('plan_id', planId);
    await supabaseAdmin.from('bulletin_likes').delete().eq('user_id', patientId);
    await supabaseAdmin.from('meals').delete().eq('plan_id', planId);
    await supabaseAdmin.from('exercises').delete().eq('plan_id', planId);
    await supabaseAdmin.from('daily_plans').delete().eq('plan_id', planId);
    await supabaseAdmin.from('daily_schedule').delete().eq('plan_id', planId);
    await supabaseAdmin.from('daily_checkins').delete().eq('plan_id', planId);
    await supabaseAdmin.from('alerts').delete().eq('plan_id', planId);
    await supabaseAdmin.from('plans').delete().eq('id', planId);
    await supabaseAdmin.from('profiles').delete().eq('id', patientId);

    // Also delete from auth
    await supabaseAdmin.auth.admin.deleteUser(patientId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
