import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { materialSummaries, materialNames } = await request.json();
    // materialSummaries = text content from uploaded files
    // materialNames = filenames for reference

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Você é a ninAI. Uma nutricionista (Nina) acabou de fazer upload dos seguintes materiais de referência:

MATERIAIS:
${materialNames.map((n: string, i: number) => `${i + 1}. ${n}`).join('\n')}

CONTEÚDO EXTRAÍDO:
${materialSummaries}

Sua tarefa: leia e entenda o conteúdo. Depois, gere perguntas inteligentes para a Nina sobre os pontos mais importantes — científicos, clínicos e de abordagem. O objetivo é extrair o conhecimento prático dela para que você possa replicar o estilo dela nos planos futuros.

Gere entre 5-8 perguntas que cubram:
- Princípios nutricionais que ela segue
- Preferências de alimentos/substituições
- Abordagem para diferentes perfis de pacientes
- Restrições ou regras que ela sempre aplica
- Filosofia de exercício/atividade física
- Aspectos psicológicos da alimentação

Comece com uma mensagem amigável reconhecendo o material e depois faça a primeira pergunta. Faça UMA pergunta por vez.

Retorne APENAS a primeira mensagem (saudação + primeira pergunta). As próximas perguntas virão na conversa.`
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ text });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
