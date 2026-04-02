import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEMO_PATIENTS = [
  { email: 'n1@gmail.com', password: '121212', name: 'Mariana Silva', age: 28, weight: 68, height: 165, gender: 'Feminino', goals: ['Emagrecer', 'Mais energia'], activity: '3-4x por semana', adherenceProfile: 'excellent' },
  { email: 'n2@gmail.com', password: '121212', name: 'Rafael Costa', age: 35, weight: 92, height: 180, gender: 'Masculino', goals: ['Ganhar massa muscular', 'Comer melhor'], activity: '5+ por semana', adherenceProfile: 'good' },
  { email: 'n3@gmail.com', password: '121212', name: 'Juliana Mendes', age: 42, weight: 74, height: 160, gender: 'Feminino', goals: ['Melhorar saúde metabólica', 'Emagrecer'], activity: '1-2x por semana', adherenceProfile: 'medium' },
  { email: 'n4@gmail.com', password: '121212', name: 'Pedro Almeida', age: 25, weight: 78, height: 175, gender: 'Masculino', goals: ['Ganhar massa muscular', 'Mais energia'], activity: '5+ por semana', adherenceProfile: 'excellent' },
  { email: 'n5@gmail.com', password: '121212', name: 'Camila Rocha', age: 31, weight: 62, height: 158, gender: 'Feminino', goals: ['Comer melhor', 'Controlar ansiedade/compulsão'], activity: 'Sedentário', adherenceProfile: 'struggling' },
];

const MEAL_PLANS: Record<string, any> = {
  excellent: { calories: 1600, protein_g: 120, carbs_g: 160, fat_g: 50, meals_per_day: 5, meal_names: ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar'] },
  good: { calories: 2200, protein_g: 180, carbs_g: 220, fat_g: 65, meals_per_day: 6, meal_names: ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'] },
  medium: { calories: 1400, protein_g: 100, carbs_g: 140, fat_g: 45, meals_per_day: 5, meal_names: ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar'] },
  struggling: { calories: 1500, protein_g: 110, carbs_g: 150, fat_g: 48, meals_per_day: 4, meal_names: ['Café da manhã', 'Almoço', 'Lanche da tarde', 'Jantar'] },
};

const MEAL_OPTIONS: Record<string, { description: string; macros: any }[]> = {
  'Café da manhã': [
    { description: 'Ovos mexidos com torrada integral, abacate e café preto', macros: { protein_g: 22, carbs_g: 25, fat_g: 15, calories: 320 } },
    { description: 'Iogurte grego com granola, mel e frutas vermelhas', macros: { protein_g: 18, carbs_g: 35, fat_g: 8, calories: 280 } },
    { description: 'Tapioca com queijo branco, tomate e orégano', macros: { protein_g: 15, carbs_g: 30, fat_g: 10, calories: 270 } },
  ],
  'Lanche da manhã': [
    { description: 'Banana com pasta de amendoim', macros: { protein_g: 8, carbs_g: 30, fat_g: 10, calories: 230 } },
    { description: 'Mix de castanhas com damasco seco', macros: { protein_g: 6, carbs_g: 20, fat_g: 14, calories: 220 } },
    { description: 'Shake de whey com leite e morango', macros: { protein_g: 25, carbs_g: 15, fat_g: 3, calories: 190 } },
  ],
  'Almoço': [
    { description: 'Frango grelhado com arroz integral, feijão, salada verde e legumes', macros: { protein_g: 40, carbs_g: 55, fat_g: 12, calories: 480 } },
    { description: 'Salmão ao forno com batata doce, brócolis e azeite', macros: { protein_g: 38, carbs_g: 45, fat_g: 18, calories: 490 } },
    { description: 'Carne magra com quinoa, salada de folhas, tomate e cenoura ralada', macros: { protein_g: 35, carbs_g: 50, fat_g: 14, calories: 460 } },
  ],
  'Lanche da tarde': [
    { description: 'Pão integral com peito de peru e queijo branco', macros: { protein_g: 18, carbs_g: 22, fat_g: 8, calories: 230 } },
    { description: 'Vitamina de banana com aveia e canela', macros: { protein_g: 10, carbs_g: 35, fat_g: 5, calories: 220 } },
    { description: 'Wrap de atum com alface e tomate', macros: { protein_g: 20, carbs_g: 18, fat_g: 6, calories: 200 } },
  ],
  'Jantar': [
    { description: 'Omelete de claras com espinafre, cogumelos e queijo cottage', macros: { protein_g: 30, carbs_g: 8, fat_g: 10, calories: 240 } },
    { description: 'Sopa de legumes com frango desfiado e torrada', macros: { protein_g: 25, carbs_g: 30, fat_g: 8, calories: 290 } },
    { description: 'Peixe grelhado com purê de abóbora e salada', macros: { protein_g: 32, carbs_g: 25, fat_g: 10, calories: 310 } },
  ],
  'Ceia': [
    { description: 'Chá de camomila com biscoito integral', macros: { protein_g: 3, carbs_g: 15, fat_g: 3, calories: 100 } },
    { description: 'Iogurte natural com chia', macros: { protein_g: 8, carbs_g: 10, fat_g: 5, calories: 120 } },
  ],
};

function getDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getFutureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getFlag(adherence: string, mealIndex: number): 'green' | 'yellow' | 'red' {
  const rand = Math.random();
  if (adherence === 'excellent') return rand < 0.8 ? 'green' : 'yellow';
  if (adherence === 'good') return rand < 0.6 ? 'green' : rand < 0.85 ? 'yellow' : 'red';
  if (adherence === 'medium') return rand < 0.4 ? 'green' : rand < 0.7 ? 'yellow' : 'red';
  // struggling
  return rand < 0.2 ? 'green' : rand < 0.5 ? 'yellow' : 'red';
}

export async function POST(request: NextRequest) {
  try {
    // Verify secret (simple protection)
    const { secret } = await request.json();
    if (secret !== 'nina-demo-2024') {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }

    const results: string[] = [];

    // Step 1: Clean up existing demo users
    for (const demo of DEMO_PATIENTS) {
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u: any) => u.email === demo.email);
      if (existing) {
        // Clean all data
        const { data: plans } = await supabase.from('plans').select('id').eq('patient_id', existing.id);
        for (const plan of (plans || [])) {
          await supabase.from('direct_messages').delete().eq('plan_id', plan.id);
          await supabase.from('favorite_meals').delete().eq('plan_id', plan.id);
          await supabase.from('patient_files').delete().eq('plan_id', plan.id);
          await supabase.from('meals').delete().eq('plan_id', plan.id);
          await supabase.from('exercises').delete().eq('plan_id', plan.id);
          await supabase.from('daily_plans').delete().eq('plan_id', plan.id);
          await supabase.from('daily_schedule').delete().eq('plan_id', plan.id);
          await supabase.from('daily_checkins').delete().eq('plan_id', plan.id);
          await supabase.from('alerts').delete().eq('plan_id', plan.id);
        }
        await supabase.from('app_sessions').delete().eq('user_id', existing.id);
        await supabase.from('bulletin_likes').delete().eq('user_id', existing.id);
        await supabase.from('plans').delete().eq('patient_id', existing.id);
        await supabase.from('profiles').delete().eq('id', existing.id);
        await supabase.auth.admin.deleteUser(existing.id);
        results.push(`Cleaned ${demo.email}`);
      }
    }

    // Also clean any other non-Nina users
    const { data: allUsers } = await supabase.auth.admin.listUsers();
    for (const u of (allUsers?.users || [])) {
      if (u.email === 'izagiffoni@hotmail.com') continue;
      if (DEMO_PATIENTS.some(d => d.email === u.email)) continue;
      // Clean this user
      const { data: plans } = await supabase.from('plans').select('id').eq('patient_id', u.id);
      for (const plan of (plans || [])) {
        await supabase.from('direct_messages').delete().eq('plan_id', plan.id);
        await supabase.from('favorite_meals').delete().eq('plan_id', plan.id);
        await supabase.from('meals').delete().eq('plan_id', plan.id);
        await supabase.from('exercises').delete().eq('plan_id', plan.id);
        await supabase.from('daily_plans').delete().eq('plan_id', plan.id);
        await supabase.from('daily_schedule').delete().eq('plan_id', plan.id);
        await supabase.from('daily_checkins').delete().eq('plan_id', plan.id);
        await supabase.from('alerts').delete().eq('plan_id', plan.id);
      }
      await supabase.from('app_sessions').delete().eq('user_id', u.id);
      await supabase.from('plans').delete().eq('patient_id', u.id);
      await supabase.from('profiles').delete().eq('id', u.id);
      await supabase.auth.admin.deleteUser(u.id);
      results.push(`Cleaned extra user ${u.email}`);
    }

    // Step 2: Create 5 demo patients
    for (const demo of DEMO_PATIENTS) {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: demo.email,
        password: demo.password,
        email_confirm: true,
      });
      if (authError || !authData.user) {
        results.push(`ERROR creating ${demo.email}: ${authError?.message}`);
        continue;
      }
      const userId = authData.user.id;

      // Create profile
      await supabase.from('profiles').insert({
        id: userId, email: demo.email, name: demo.name, role: 'patient',
      });

      // Create plan
      const mealPlan = MEAL_PLANS[demo.adherenceProfile];
      const startDate = getDateStr(21); // Started 3 weeks ago
      const { data: planData } = await supabase.from('plans').insert({
        patient_id: userId,
        status: 'approved',
        approved_at: new Date(startDate + 'T10:00:00').toISOString(),
        start_date: startDate,
        duration_months: 6,
        goals: demo.goals.map(g => ({ description: g, measurement: 'Acompanhamento semanal', timeframe: '6 meses' })),
        meal_plan_base: mealPlan,
        exercise_plan_base: { weekly_frequency: demo.activity.includes('5') ? 5 : demo.activity.includes('3') ? 4 : demo.activity.includes('1') ? 2 : 1, activities: [{ type: 'Treino personalizado', frequency: demo.activity }] },
        scientific_rationale: `Plano personalizado para ${demo.name}, ${demo.age} anos, ${demo.weight}kg, ${demo.height}cm. Objetivos: ${demo.goals.join(', ')}.`,
        onboarding_conversation: [{ role: 'user', content: `Nome: ${demo.name}. Objetivos: ${demo.goals.join(', ')}. Atividade: ${demo.activity}. Peso: ${demo.weight}kg. Altura: ${demo.height}cm. Idade: ${demo.age}. Sexo: ${demo.gender}.` }],
      }).select().single();

      if (!planData) { results.push(`ERROR creating plan for ${demo.name}`); continue; }
      const planId = planData.id;

      // Generate daily plans and meals for last 14 days + next 7 days
      for (let daysAgo = 14; daysAgo >= -7; daysAgo--) {
        const date = daysAgo >= 0 ? getDateStr(daysAgo) : getFutureDate(-daysAgo);
        const isPast = daysAgo > 0;
        const isToday = daysAgo === 0;

        // Generate daily plan meals
        const dayMeals = mealPlan.meal_names.map((mealName: string) => {
          const options = MEAL_OPTIONS[mealName] || MEAL_OPTIONS['Lanche da tarde'];
          const chosen = randomPick(options);
          return {
            meal: mealName,
            description: chosen.description,
            macros: chosen.macros,
            location: Math.random() > 0.3 ? 'Casa' : 'Fora',
          };
        });

        const hasExercise = Math.random() < (demo.activity.includes('5') ? 0.7 : demo.activity.includes('3') ? 0.5 : 0.2);
        const exercise = hasExercise ? {
          type: randomPick(['Musculação', 'Corrida', 'Yoga', 'Funcional', 'Natação']),
          description: '45-60 min de treino',
          duration_min: randomPick([30, 45, 60]),
        } : null;

        // Insert daily plan
        await supabase.from('daily_plans').insert({
          plan_id: planId, date, meals: dayMeals, exercise, status: 'active',
        });

        // Insert schedule
        await supabase.from('daily_schedule').upsert({
          plan_id: planId, date,
          morning: Math.random() > 0.3 ? 'casa' : 'fora',
          afternoon: Math.random() > 0.4 ? 'casa' : 'fora',
          evening: Math.random() > 0.2 ? 'casa' : 'fora',
          has_gym: hasExercise,
        }, { onConflict: 'plan_id,date' });

        // For past days, create meal records with flags
        if (isPast || isToday) {
          // Skip some days for struggling patients
          if (demo.adherenceProfile === 'struggling' && Math.random() < 0.3) continue;
          if (demo.adherenceProfile === 'medium' && Math.random() < 0.15) continue;

          for (let mi = 0; mi < dayMeals.length; mi++) {
            const meal = dayMeals[mi];
            const flag = getFlag(demo.adherenceProfile, mi);
            const completed = Math.random() > (demo.adherenceProfile === 'struggling' ? 0.3 : 0.1);

            if (completed) {
              await supabase.from('meals').insert({
                plan_id: planId, date,
                meal_name: meal.meal,
                planned_description: meal.description,
                actual_description: flag === 'green' ? meal.description : flag === 'yellow' ? 'Parecido mas com algumas mudanças' : 'Comi algo bem diferente do planejado',
                flag,
                completed: true,
                feedback: flag === 'green' ? 'Ótima escolha! Dentro do plano.' : flag === 'yellow' ? 'Aceitável, mas pode melhorar na próxima.' : 'Fora do plano. Tente seguir mais próximo amanhã.',
              });
            }
          }

          // Exercise record
          if (exercise) {
            const exerciseDone = demo.adherenceProfile === 'excellent' ? Math.random() > 0.1 :
              demo.adherenceProfile === 'good' ? Math.random() > 0.3 :
              demo.adherenceProfile === 'medium' ? Math.random() > 0.5 : Math.random() > 0.7;
            await supabase.from('exercises').insert({
              plan_id: planId, date,
              type: exercise.type,
              actual_type: exercise.type,
              done: exerciseDone,
              duration_min: exerciseDone ? exercise.duration_min : 0,
            });
          }

          // Daily checkin for some days
          if (Math.random() > 0.3) {
            await supabase.from('daily_checkins').insert({
              plan_id: planId, date,
              water_liters: randomPick([1, 1.5, 2, 2.5, 3]),
              sleep_hours: randomPick([5, 6, 7, 8]),
              energy_level: randomPick([2, 3, 4, 5]),
              digestion: randomPick(['boa', 'regular', 'ruim']),
            });
          }
        }
      }

      // App sessions (simulate engagement)
      const sessionCounts: Record<string, number> = { excellent: 45, good: 30, medium: 18, struggling: 8 };
      const numSessions = sessionCounts[demo.adherenceProfile] || 15;
      for (let s = 0; s < numSessions; s++) {
        const daysAgo = Math.floor(Math.random() * 21);
        const hour = 6 + Math.floor(Math.random() * 16);
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        d.setHours(hour, Math.floor(Math.random() * 60));
        await supabase.from('app_sessions').insert({ user_id: userId, opened_at: d.toISOString() });
      }

      // Some favorite meals
      if (demo.adherenceProfile !== 'struggling') {
        for (let f = 0; f < 3; f++) {
          await supabase.from('favorite_meals').insert({
            plan_id: planId,
            meal_name: randomPick(mealPlan.meal_names),
            description: randomPick(MEAL_OPTIONS['Almoço']).description,
          });
        }
      }

      results.push(`✅ Created ${demo.name} (${demo.email}) — ${demo.adherenceProfile} profile, 14 days history`);
    }

    // Create a welcome bulletin post from Nina
    const { data: ninaProfile } = await supabase.from('profiles').select('id').eq('email', 'izagiffoni@hotmail.com').single();
    if (ninaProfile) {
      await supabase.from('bulletin_posts').insert({
        author_id: ninaProfile.id,
        post_type: 'aviso',
        title: 'Bem-vindos ao ninAI! 🎉',
        content: 'Olá pessoal! Estou muito feliz em começar essa jornada com vocês. Aqui no mural vou compartilhar dicas, receitas e novidades. Qualquer dúvida, me mandem mensagem. Vamos juntos! 💚',
        audience: 'all',
      });
      await supabase.from('bulletin_posts').insert({
        author_id: ninaProfile.id,
        post_type: 'conteudo',
        title: 'Dica da semana: Hidratação',
        content: 'Beber pelo menos 2 litros de água por dia é essencial para o metabolismo funcionar bem. Uma dica: tenha sempre uma garrafa por perto e coloque alarmes no celular para lembrar. Água com limão ou hortelã conta! 💧',
        audience: 'all',
      });
      await supabase.from('bulletin_posts').insert({
        author_id: ninaProfile.id,
        post_type: 'receita',
        title: 'Overnight Oats de Banana',
        content: 'Misture 40g de aveia, 150ml de leite, 1 banana amassada, canela e chia. Deixe na geladeira de um dia pro outro. De manhã, adicione frutas por cima. Prático e delicioso! 🥣',
        audience: 'all',
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
