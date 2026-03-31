import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { days, mealPlanBase, exercisePlanBase, goals, ninaMaterials, ninaKnowledge, favorites } = await request.json();

    const dayInstructions = days.map((d: any) => 
      `${d.date} (${d.dayLabel}): Manhã=${d.morning}, Tarde=${d.afternoon}, Noite=${d.evening}. Academia=${d.has_gym ? 'sim' : 'não'}`
    ).join('\n');

    const materialsContext = ninaMaterials?.length > 0 
      ? `\n\nMATERIAIS DE REFERÊNCIA DA NUTRICIONISTA:\n${ninaMaterials.map((m: any) => m.content_summary || '').filter(Boolean).join('\n---\n')}`
      : '';

    const knowledgeContext = ninaKnowledge?.length > 0
      ? `\n\nCONHECIMENTO DA NUTRICIONISTA (use como base para estilo e abordagem):\n${ninaKnowledge.map((k: any) => k.content).join('\n---\n')}`
      : '';

    const favoritesContext = favorites?.length > 0
      ? `\n\nREFEIÇÕES FAVORITAS DO PACIENTE (priorize incluir quando possível):\n${favorites.map((f: any) => `- ${f.meal_name}: ${f.description}`).join('\n')}`
      : '';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: `Você é a ninAI. Gere o plano detalhado de alimentação e exercício para os dias abaixo.

PROGRAMAÇÃO DOS DIAS:
${dayInstructions}

PLANO ALIMENTAR BASE:
${JSON.stringify(mealPlanBase, null, 2)}

PLANO DE EXERCÍCIOS BASE:
${JSON.stringify(exercisePlanBase, null, 2)}

METAS:
${JSON.stringify(goals, null, 2)}
${materialsContext}${knowledgeContext}${favoritesContext}

REGRAS:
- Para cada dia, gere as refeições baseadas no plano alimentar base
- O número de refeições por dia deve seguir meals_per_day do plano base
- Use os meal_names definidos no plano base
- Manhã em casa → café da manhã e lanche da manhã com receitas detalhadas
- Manhã fora → café e lanche com orientações de o que pedir/buscar fora
- Tarde em casa → almoço e lanche da tarde com receitas
- Tarde fora → almoço e lanche com orientações
- Noite em casa → jantar com receita
- Noite fora → jantar com orientações
- Dias com academia → exercício do plano base
- Dias sem academia → exercício alternativo (caminhada, alongamento, descanso)
- Cada refeição deve ter macros estimados
- Tudo em português

Retorne APENAS um JSON (sem markdown, sem backticks):
{
  "days": [
    {
      "date": "2026-03-30",
      "meals": [
        {"meal": "Café da manhã", "description": "...", "macros": {"protein_g": 0, "carbs_g": 0, "fat_g": 0, "calories": 0}, "location": "casa"},
        ...
      ],
      "exercise": {"type": "musculação", "description": "Treino de peito e tríceps"}
    },
    ...
  ]
}`
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
