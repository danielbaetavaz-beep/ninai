import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { routine, mealPlanBase, exercisePlanBase, goals, mealNames, weekStart, dayDates } = await request.json();

    const meals = mealNames || ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar'];
    
    // Build per-day meal instructions
    const dayInstructions = Object.entries(routine).map(([day, info]: [string, any]) => {
      const date = info.date || dayDates?.[day] || '';
      const activeMeals = Object.entries(info.meals || {})
        .filter(([_, loc]) => loc !== 'off')
        .map(([name, loc]) => `${name} (${loc})`)
        .join(', ');
      const inactiveMeals = Object.entries(info.meals || {})
        .filter(([_, loc]) => loc === 'off')
        .map(([name]) => name)
        .join(', ');
      
      return `${day} (${date}): Refeições ativas: ${activeMeals || 'nenhuma'}${inactiveMeals ? `. SEM: ${inactiveMeals}` : ''}. Academia: ${info.gym ? 'sim' : 'não'}`;
    }).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Você é a ninAI. Gere o plano detalhado da semana.

SEMANA COMEÇA EM: ${weekStart}
DATAS DE CADA DIA:
${JSON.stringify(dayDates, null, 2)}

ROTINA DA SEMANA (com datas e detalhes de cada dia):
${dayInstructions}

PLANO ALIMENTAR BASE:
${JSON.stringify(mealPlanBase, null, 2)}

PLANO DE EXERCÍCIOS BASE:
${JSON.stringify(exercisePlanBase, null, 2)}

METAS:
${JSON.stringify(goals, null, 2)}

IMPORTANTE:
- Cada dia deve ter APENAS as refeições marcadas como ativas (casa, fora, ou livre)
- Refeições marcadas como "off" NÃO devem aparecer no plano desse dia
- Refeições "livre" devem ter uma sugestão leve mas com nota "refeição livre — sem restrições"
- Refeições "casa" devem detalhar ingredientes e preparo
- Refeições "fora" devem dar orientações (priorize X, evite Y)
- Dias sem academia: sugira exercícios alternativos (corrida, caminhada, alongamento)
- Dias de descanso: marque como "descanso"

Retorne APENAS um JSON (sem markdown, sem backticks):
{
  "meal_plan": {
    "segunda": [{"meal": "Café da manhã", "description": "...", "macros": {"protein_g": 0, "carbs_g": 0, "fat_g": 0, "calories": 0}, "location": "casa"}],
    "terca": [...],
    ...
  },
  "exercise_plan": {
    "segunda": {"type": "musculação", "description": "Treino de peito e tríceps"},
    "terca": {"type": "corrida", "description": "30 min corrida leve"},
    ...
  }
}

Tudo em português.`
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    let plan;
    try {
      plan = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      plan = { error: 'Não consegui gerar o plano. Tente novamente.' };
    }

    return NextResponse.json(plan);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
