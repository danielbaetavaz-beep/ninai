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
        content: `Você é uma nutricionista profissional. Gere um PLANO ALIMENTAR MENSAL FIXO para o paciente.

O plano deve ter para CADA REFEIÇÃO:
- Uma OPÇÃO PRINCIPAL detalhada com ingredientes e gramagens exatas
- 3-4 ALTERNATIVAS de substituição equivalentes (mesmo perfil nutricional)
- Macros estimados da opção principal

PLANO BASE:
${JSON.stringify(mealPlanBase, null, 2)}

EXERCÍCIOS:
${JSON.stringify(exercisePlanBase, null, 2)}

METAS:
${JSON.stringify(goals, null, 2)}

RESTRIÇÕES: ${restrictions || 'nenhuma'}
${knowledgeContext}${favoritesContext}

Retorne APENAS um JSON (sem markdown, sem backticks):
{
  "meals": [
    {
      "meal_name": "Café da manhã",
      "time_suggestion": "7:00",
      "main_option": {
        "description": "Descrição completa com gramagens (ex: 1 ovo inteiro + 2 claras mexidas, 2 fatias de pão integral, 1 banana (90g))",
        "ingredients": ["1 ovo inteiro", "2 claras de ovo", "2 fatias pão integral", "1 banana (90g)"],
        "macros": {"protein_g": 25, "carbs_g": 40, "fat_g": 10, "calories": 350}
      },
      "alternatives": [
        {
          "description": "Iogurte grego (200ml) com granola (20g) e morango (100g)",
          "ingredients": ["Iogurte grego 200ml", "Granola 20g", "Morango 100g"]
        },
        {
          "description": "Tapioca (50g) com queijo branco (40g) e tomate",
          "ingredients": ["Tapioca 50g", "Queijo branco 40g", "Tomate fatiado"]
        },
        {
          "description": "Vitamina: leite desnatado (250ml) + whey (20g) + banana + aveia (30g)",
          "ingredients": ["Leite desnatado 250ml", "Whey protein 20g", "1 banana", "Aveia 30g"]
        }
      ]
    }
  ],
  "exercise_plan": {
    "description": "Descrição geral do plano de exercícios",
    "weekly_schedule": [
      {"day": "Segunda", "activity": "Musculação - Peito e Tríceps", "duration": "45-60 min"},
      {"day": "Terça", "activity": "Descanso ou caminhada leve", "duration": "30 min"},
      {"day": "Quarta", "activity": "Musculação - Costas e Bíceps", "duration": "45-60 min"}
    ]
  },
  "hydration": "Beber pelo menos 2.5L de água por dia",
  "general_notes": "Observações gerais como temperos, modo de preparo, dicas"
}

REGRAS:
- Gere uma entrada para CADA refeição listada em meal_names
- Cada refeição deve ter EXATAMENTE 3 alternativas
- As alternativas devem ter perfil nutricional SIMILAR à opção principal
- Inclua gramagens exatas em TUDO
- Adapte os horários sugeridos para uma rotina normal
- Tudo em português brasileiro
- Seja específico e prático (o paciente vai seguir isso no dia a dia)`
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
