import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { conversation, planData } = await request.json();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `Você é a ninAI gerando um diagnóstico técnico para a nutricionista Nina.

CONVERSA DO ONBOARDING:
${JSON.stringify(conversation)}

DADOS DO PLANO:
${JSON.stringify(planData)}

Gere um relatório técnico em português com as seguintes seções:

1. MAPA FÍSICO DO PACIENTE
- Composição corporal estimada, nível de condicionamento, limitações físicas identificadas

2. VISÃO PSICOLÓGICA
- Relação com comida, histórico de dietas, gatilhos emocionais, nível de motivação, possíveis barreiras

3. RECOMENDAÇÕES CLÍNICAS
- Exames necessários (hemograma, glicemia, perfil lipídico, hormônios tireoidianos, etc.)
- Consultas recomendadas (endocrinologista, cardiologista, etc.)
- Suplementação que pode ser considerada

4. O QUE NÃO FICOU CLARO
- Pontos que a conversa não esclareceu e que a Nina precisa investigar pessoalmente

5. ALERTAS
- Qualquer sinal de atenção identificado (compulsão, restrição excessiva, expectativas irreais, condições de saúde que precisam de acompanhamento médico)

Seja técnica e direta. Esse relatório é para uma profissional de nutrição, não para o paciente.`
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ diagnosis: text });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
