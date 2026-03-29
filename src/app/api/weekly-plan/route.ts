import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { routine, mealPlanBase, exercisePlanBase, goals } = await request.json();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `Você é a ninAI. Gere o plano detalhado da semana com base nas informações abaixo.

ROTINA DA SEMANA:
${JSON.stringify(routine, null, 2)}

PLANO ALIMENTAR BASE:
${JSON.stringify(mealPlanBase, null, 2)}

PLANO DE EXERCÍCIOS BASE:
${JSON.stringify(exercisePlanBase, null, 2)}

METAS:
${JSON.stringify(goals, null, 2)}

Retorne APENAS um JSON (sem markdown, sem backticks):
{
  "meal_plan": {
    "segunda": [{"meal": "Café da manhã", "description": "...", "macros": {"protein_g": 0, "carbs_g": 0, "fat_g": 0, "calories": 0}}],
    "terca": [...],
    "quarta": [...],
    "quinta": [...],
    "sexta": [...],
    "sabado": [...],
    "domingo": [...]
  },
  "exercise_plan": {
    "segunda": {"type": "musculação", "description": "...", "has_gym": true},
    "terca": {"type": "corrida", "description": "...", "has_gym": false},
    ...
  }
}

REGRAS:
- Refeições em casa: detalhe ingredientes e preparo simples
- Refeições fora: dê orientações (priorize X, evite Y, peça Z)
- Dias sem academia: sugira alternativas (corrida, alongamento, exercício em casa)
- Dias de descanso: marque como "descanso"
- Tudo em português`
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
