import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { materialNames, pdfContents, textContent } = await request.json();
    // pdfContents = [{ name: 'file.pdf', base64: '...' }, ...]
    // textContent = fallback text if PDFs couldn't be read client-side

    // Build message content with PDFs
    const contentParts: any[] = [];
    
    if (pdfContents && pdfContents.length > 0) {
      for (const pdf of pdfContents) {
        if (pdf.base64) {
          contentParts.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdf.base64 },
          });
        }
      }
    }

    contentParts.push({
      type: 'text',
      text: `Você é a ninAI. Uma nutricionista (Nina) acabou de fazer upload dos seguintes materiais de referência:

MATERIAIS: ${materialNames.map((n: string, i: number) => `${i + 1}. ${n}`).join(', ')}

${textContent ? `CONTEÚDO ADICIONAL:\n${textContent}` : ''}

Sua tarefa: leia e entenda TODO o conteúdo dos documentos acima. Depois, inicie uma conversa com a Nina para aprender sobre sua abordagem.

Faça perguntas inteligentes sobre:
- Princípios nutricionais que ela segue
- Preferências de alimentos e substituições  
- Abordagem para diferentes perfis de pacientes
- Restrições ou regras que ela sempre aplica
- Filosofia de exercício
- Aspectos psicológicos da alimentação

Comece reconhecendo o que você leu nos materiais (cite pontos específicos que encontrou) e faça a PRIMEIRA pergunta para aprofundar. UMA pergunta por vez.`
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: contentParts }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('Process material error:', error);
    return NextResponse.json({ error: error.message, text: 'Recebi seus materiais. Vou te fazer algumas perguntas para aprender sobre sua abordagem. Quais são os 3 princípios nutricionais mais importantes que você sempre segue ao elaborar um plano alimentar?' });
  }
}
