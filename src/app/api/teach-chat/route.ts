import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TEACH_SYSTEM = `Você é a ninAI conduzindo uma sessão de aprendizado com a nutricionista Nina.

Seu objetivo é aprender com ela sobre seus materiais, método e filosofia para poder replicar seu estilo ao criar planos para pacientes.

REGRAS:
- Faça UMA pergunta por vez, direta e objetiva
- Aprofunde quando a resposta for vaga
- Cubra aspectos científicos, clínicos e psicológicos
- Depois de 5-8 trocas, sinalize que tem informação suficiente
- Quando tiver informação suficiente, inclua [TEACHING_COMPLETE] na mensagem
- Junto com [TEACHING_COMPLETE], inclua um resumo estruturado entre [KNOWLEDGE] e [/KNOWLEDGE] com:
  - Princípios nutricionais
  - Preferências de alimentos
  - Regras e restrições
  - Abordagem por perfil de paciente
  - Filosofia de exercício
  - Aspectos psicológicos
  - Qualquer outro insight importante
- O resumo deve ser denso e prático — será usado como contexto para gerar planos
- Tudo em português`;

export async function POST(request: NextRequest) {
  try {
    const { messages, materialContext } = await request.json();

    const systemPrompt = TEACH_SYSTEM + (materialContext ? `\n\nCONTEXTO DOS MATERIAIS:\n${materialContext}` : '');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const isComplete = text.includes('[TEACHING_COMPLETE]');
    
    let knowledge = null;
    const knowledgeMatch = text.match(/\[KNOWLEDGE\]([\s\S]*?)\[\/KNOWLEDGE\]/);
    if (knowledgeMatch) knowledge = knowledgeMatch[1].trim();

    const cleanText = text.replace(/\[TEACHING_COMPLETE\]/, '').replace(/\[KNOWLEDGE\][\s\S]*?\[\/KNOWLEDGE\]/, '').trim();

    return NextResponse.json({ text: cleanText, isComplete, knowledge });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
