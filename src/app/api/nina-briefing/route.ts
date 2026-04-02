import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { patients, patientStats, alerts, pending, unreadMessages } = await request.json();

    const patientSummaries = patients.map((p: any) => {
      const stats = patientStats[p.id] || {};
      return `- ${p.profiles?.name || 'Paciente'}: aderência ${stats.adherence || 0}%, ${stats.greenMeals || 0} refeições verdes de ${stats.totalMeals || 0}, ${stats.exerciseDone || 0} exercícios, ${stats.daysNoRegistration || 0} dias sem registro`;
    }).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Você é a ninAI, assistente da nutricionista Nina. Gere um briefing diário curto e profissional (máximo 4 frases). Tom: caloroso mas direto, como uma assistente executiva. Use o nome Nina.

DADOS DE HOJE:
- ${patients.length} pacientes ativos
- ${pending} planos para aprovar
- ${alerts} alertas pendentes
- ${unreadMessages} mensagens não lidas

RESUMO DOS PACIENTES (últimos 7 dias):
${patientSummaries || 'Nenhum dado ainda.'}

REGRAS:
- Comece com "Bom dia, Nina!" ou similar baseado na hora
- Destaque o paciente com melhor performance
- Mencione se alguém precisa de atenção (3+ dias sem registro ou aderência < 30%)
- Termine com uma frase motivacional curta
- Não use bullet points, escreva em texto corrido natural
- Tudo em português`
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ briefing: text });
  } catch (error: any) {
    return NextResponse.json({ briefing: '', error: error.message });
  }
}
