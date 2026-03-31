import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { fileUrl, fileName } = await request.json();

    // Fetch the PDF
    const pdfResponse = await fetch(fileUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json({ error: 'Could not fetch PDF', text: '' });
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const base64 = Buffer.from(pdfBuffer).toString('base64');

    // Use Claude to read the PDF
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          {
            type: 'text',
            text: `Extraia todo o conteúdo textual deste documento PDF de forma estruturada. Inclua:
- Dados do paciente (se houver)
- Objetivos e metas
- Distribuição de macronutrientes
- Todas as refeições com detalhes
- Orientações gerais
- Princípios e regras da nutricionista
- Substituições permitidas
- Qualquer outra informação relevante

Retorne o texto completo e organizado, sem omitir nada importante.`
          }
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ text, fileName });
  } catch (error: any) {
    console.error('PDF extraction error:', error);
    return NextResponse.json({ error: error.message, text: '' });
  }
}
