import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { mealPlanBase, exercisePlanBase, goals, restrictions, ninaKnowledge, favorites } = await request.json();

    const knowledgeContext = ninaKnowledge?.length > 0
      ? `\n\nCONHECIMENTO DA NUTRICIONISTA:\n${ninaKnowledge.map((k: any) => k.content).join('\n---\n')}`
      : '';

    const favoritesContext = favorites?.length > 0
      ? `\n\nREFEIÇÕES FAVORITAS DO PACIENTE:\n${favorites.map((f: any) => `- ${f.meal_name}: ${f.description}`).join('\n')}`
      : '';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      messages: [{
        role: 'user',
        content: `Você é uma nutricionista profissional. Gere um PLANO ALIMENTAR MENSAL FIXO.

Para CADA REFEIÇÃO, organize em LINHAS DE INGREDIENTES (como uma tabela de substituição):
- Cada linha é uma CATEGORIA (proteína, carboidrato, leguminosa, complemento, fruta, etc.)
- Cada linha tem 1 OPÇÃO PRINCIPAL e 3-4 ALTERNATIVAS equivalentes com gramagens
- O paciente escolhe 1 item de cada linha para montar sua refeição

PLANO BASE:
${JSON.stringify(mealPlanBase, null, 2)}

EXERCÍCIOS:
${JSON.stringify(exercisePlanBase, null, 2)}

METAS:
${JSON.stringify(goals, null, 2)}

RESTRIÇÕES: ${restrictions || 'nenhuma'}
${knowledgeContext}${favoritesContext}

Retorne APENAS JSON (sem markdown, sem backticks):
{
  "meals": [
    {
      "meal_name": "Café da manhã",
      "time_suggestion": "7:00",
      "ingredient_rows": [
        {
          "category": "Proteína",
          "main": {"item": "Ovo de galinha", "quantity": "1 unidade"},
          "alternatives": [
            {"item": "Leite desnatado", "quantity": "250ml"},
            {"item": "Requeijão light", "quantity": "40g"},
            {"item": "Iogurte natural", "quantity": "200ml"}
          ]
        },
        {
          "category": "Proteína extra",
          "main": {"item": "Clara de ovo", "quantity": "2 unidades"},
          "alternatives": [
            {"item": "Atum", "quantity": "50g"},
            {"item": "Frango desfiado", "quantity": "50g"},
            {"item": "Whey protein", "quantity": "20g"}
          ]
        },
        {
          "category": "Carboidrato",
          "main": {"item": "Pão de forma", "quantity": "2 fatias"},
          "alternatives": [
            {"item": "Pão de sal", "quantity": "1 unidade (50g)"},
            {"item": "Farelo de aveia", "quantity": "50g"},
            {"item": "Aveia em flocos", "quantity": "30g"}
          ]
        },
        {
          "category": "Fruta",
          "main": {"item": "Banana", "quantity": "90g"},
          "alternatives": [
            {"item": "Maçã", "quantity": "150g"},
            {"item": "Morango", "quantity": "200g"},
            {"item": "Mamão", "quantity": "210g"}
          ]
        }
      ],
      "suggestions": [
        "1 ovo + 2 claras mexidos no pão + 1 fruta",
        "Pão com requeijão + iogurte com fruta",
        "Vitamina: leite + whey + fruta + aveia"
      ],
      "macros": {"protein_g": 30, "carbs_g": 45, "fat_g": 12, "calories": 410}
    }
  ],
  "exercise_plan": {
    "weekly_schedule": [
      {"day": "Segunda", "activity": "Musculação - Superior", "duration": "45 min"},
      {"day": "Terça", "activity": "Cardio leve ou descanso", "duration": "30 min"}
    ]
  },
  "hydration": "Beber 2.5L de água por dia. Dica: tenha uma garrafa sempre por perto.",
  "general_notes": "Observações sobre temperos, modo de preparo, etc."
}

REGRAS:
- Gere uma entrada para CADA refeição em meal_names
- Cada refeição tem 3-5 ingredient_rows dependendo da complexidade
- Cada ingredient_row tem categoria, opção principal e 3-4 alternativas
- TODAS com gramagens exatas
- Inclua 2-3 sugestões de combinação por refeição (como um chef recomendaria)
- Macros estimados da opção principal completa
- Exercise_plan com 7 dias da semana
- Tudo em português brasileiro`
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    let plan;
    try {
      plan = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      plan = null;
    }

    return NextResponse.json({ monthlyPlan: plan });
  } catch (error: any) {
    return NextResponse.json({ monthlyPlan: null, error: error.message }, { status: 500 });
  }
}
