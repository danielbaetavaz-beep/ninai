import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { meals } = await request.json();

    const mealDescriptions = meals.map((m: any) => `${m.date} — ${m.meal}: ${m.description}`).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `Você é a ninAI, assistente de nutrição. Gere uma lista de compras de supermercado consolidada para as seguintes refeições em casa:

REFEIÇÕES:
${mealDescriptions}

REGRAS:
- Consolide ingredientes repetidos (some quantidades)
- Agrupe por categoria de supermercado
- Inclua quantidades estimadas (ex: "500g", "1 unidade", "1 maço")
- Considere que itens básicos como sal, azeite, temperos secos provavelmente já existem em casa — inclua apenas se usados em quantidade significativa
- Tudo em português

Retorne APENAS um JSON (sem markdown, sem backticks):
{
  "categories": [
    {
      "category": "Proteínas",
      "items": [
        {"name": "Peito de frango", "quantity": "1kg"},
        {"name": "Ovos", "quantity": "1 dúzia"}
      ]
    },
    {
      "category": "Frutas e Verduras",
      "items": [...]
    },
    ...
  ],
  "note": "Lista para X dias, Y refeições em casa. Estimativa de custo: R$ XX-XX"
}`
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    let list;
    try {
      list = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      list = { categories: [], note: 'Não consegui gerar a lista. Tente novamente.' };
    }

    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
