import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { mealName, description, macros } = await request.json();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Você é a ninAI, assistente de nutrição. Gere uma receita detalhada para a seguinte refeição:

REFEIÇÃO: ${mealName}
DESCRIÇÃO: ${description}
${macros ? `MACROS ALVO: Proteína ${macros.protein_g}g, Carboidrato ${macros.carbs_g}g, Gordura ${macros.fat_g}g, ${macros.calories} kcal` : ''}

Retorne APENAS um JSON (sem markdown, sem backticks):
{
  "title": "Nome da receita",
  "prep_time": "15 min",
  "cook_time": "20 min",
  "servings": 1,
  "ingredients": [
    {"item": "Peito de frango", "quantity": "150g"},
    {"item": "Azeite", "quantity": "1 colher de sopa"}
  ],
  "steps": [
    "Tempere o frango com sal e pimenta",
    "Aqueça o azeite em uma frigideira em fogo médio",
    "Grelhe o frango por 5 minutos de cada lado"
  ],
  "tips": "Para mais sabor, marine o frango com limão e ervas por 30 minutos antes de grelhar."
}`
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    let recipe;
    try {
      recipe = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      recipe = { title: mealName, ingredients: [], steps: ['Não foi possível gerar a receita. Tente novamente.'], tips: '' };
    }

    return NextResponse.json(recipe);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
