import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { description, mealName, plannedDescription, mealPlanContext } = await request.json();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Você é a ninAI, assistente de nutrição. Analise a descrição de uma refeição que o paciente informou.

DESCRIÇÃO DO PACIENTE: "${description}"

CONTEXTO:
- Refeição: ${mealName}
- O plano previa: ${plannedDescription}
- Plano alimentar geral: ${JSON.stringify(mealPlanContext || {})}

ANALISE E RETORNE UM JSON (sem markdown, sem backticks, apenas o JSON puro):
{
  "flag": "green|yellow|red",
  "feedback": "feedback em português, 2-3 frases curtas e amigáveis",
  "identified_foods": ["alimento 1", "alimento 2"],
  "estimated_macros": {"protein_g": 0, "carbs_g": 0, "fat_g": 0, "calories": 0},
  "adherence_notes": "por que essa bandeira"
}

CRITÉRIOS:
- VERDE: refeição aderente ao plano, macros dentro da faixa
- AMARELO: parcialmente aderente (porção errada, falta um nutriente, substituição razoável)
- VERMELHO: fora do plano (fast food, excesso de açúcar, nada a ver com o previsto)

IMPORTANTE: Estime os macros da forma mais precisa possível com base na descrição. Se a descrição for vaga, faça sua melhor estimativa com porções médias.`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    let analysis;
    try {
      analysis = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      analysis = { flag: 'yellow', feedback: 'Não consegui analisar completamente. Pode descrever melhor?', identified_foods: [], estimated_macros: { protein_g: 0, carbs_g: 0, fat_g: 0, calories: 0 }, adherence_notes: '' };
    }

    return NextResponse.json(analysis);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
