import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { patientData } = await request.json();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Você é uma nutricionista experiente criando um plano personalizado. Com base nos dados do paciente abaixo, gere um plano nutricional completo.

DADOS DO PACIENTE:
${patientData}

RETORNE APENAS UM JSON VÁLIDO (sem markdown, sem backticks, sem texto extra) com esta estrutura exata:
{
  "duration_months": 6,
  "goals": [
    {
      "description": "Meta específica e mensurável (ex: Perder 6kg nos próximos 3 meses)",
      "measurement": "Como vai ser medido (ex: Pesagem semanal, meta de -0.5kg/semana)",
      "timeframe": "Prazo realista (ex: 3 meses)"
    },
    {
      "description": "Segunda meta (ex: Atingir 120g de proteína diária consistentemente)",
      "measurement": "Como medir (ex: Registro diário no app)",
      "timeframe": "1 mês"
    },
    {
      "description": "Terceira meta relacionada a hábitos (ex: Cozinhar em casa pelo menos 4x/semana)",
      "measurement": "Como medir",
      "timeframe": "Prazo"
    }
  ],
  "meal_plan_base": {
    "calories": 1800,
    "protein_g": 130,
    "carbs_g": 200,
    "fat_g": 55,
    "meals_per_day": 5,
    "meal_names": ["Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar"]
  },
  "exercise_plan_base": {
    "weekly_frequency": 3,
    "activities": [
      {"type": "Musculação", "frequency": "3x/semana"},
      {"type": "Caminhada", "frequency": "2x/semana"}
    ]
  },
  "scientific_rationale": "Explicação de 2-3 frases sobre por que este plano faz sentido para este paciente específico, mencionando TMB, déficit/superávit calórico, e distribuição de macros."
}

REGRAS PARA AS METAS:
- Gere 3 a 4 metas
- A primeira meta deve ser a principal (relacionada ao objetivo principal do paciente) e DEVE ser específica e numérica (ex: "Perder Xkg", "Ganhar Xkg de massa magra", não apenas "Emagrecer")
- A segunda meta deve ser sobre nutrição/macros (ex: "Atingir Xg de proteína/dia")
- A terceira meta deve ser sobre hábitos (ex: "Manter 80% de aderência ao plano", "Beber 2L de água/dia")
- Se o paciente quer ganhar massa, calcule TMB e adicione superávit. Se quer emagrecer, calcule déficit.
- Adapte as calorias e macros ao perfil: sexo, peso, altura, idade, nível de atividade
- Todas as metas devem ter medição concreta e prazo realista`
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    let planData;
    try {
      planData = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      planData = null;
    }

    return NextResponse.json({ planData });
  } catch (error: any) {
    return NextResponse.json({ planData: null, error: error.message });
  }
}
