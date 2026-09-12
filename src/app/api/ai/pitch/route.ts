/**
 * API Route: Geração de Pitch com IA
 * POST /api/ai/pitch
 * 
 * Recebe dados minerados e retorna mensagem personalizada para prospecção
 */

import { NextRequest, NextResponse } from 'next/server';
import { generatePitch, PitchRequest } from '@/lib/ai';

// Configuração para edge runtime (mais rápido)
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body: PitchRequest = await request.json();

    // Validação dos campos obrigatórios
    const requiredFields: (keyof PitchRequest)[] = [
      'company_name',
      'niche',
      'city',
      'state',
      'channel',
    ];

    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          error: 'Campos obrigatórios faltando', 
          missing: missingFields,
          message: `Os seguintes campos são obrigatórios: ${missingFields.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Validação do canal
    const validChannels = ['whatsapp', 'email', 'linkedin', 'phone'];
    if (!validChannels.includes(body.channel)) {
      return NextResponse.json(
        { 
          error: 'Canal inválido', 
          message: `Canal deve ser um de: ${validChannels.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Gera o pitch
    const result = await generatePitch(body);

    // Log para auditoria (remover em produção se sensível)
    console.log(`[AI Pitch] ${body.channel} para ${body.company_name} (${body.city}/${body.state}) - ${result.model_used}${result.fallback_used ? ' [FALLBACK]' : ''}`);

    return NextResponse.json({
      success: true,
      data: {
        pitch: result.pitch,
        meta: {
          model_used: result.model_used,
          tokens_used: result.tokens_used,
          fallback_used: result.fallback_used,
          channel: body.channel,
          company: body.company_name,
          niche: body.niche,
          location: `${body.city}/${body.state}`,
        },
      },
    });

  } catch (error) {
    console.error('[AI Pitch] Erro:', error);

    return NextResponse.json(
      { 
        success: false,
        error: 'Erro interno ao gerar pitch',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        fallback: 'Erro ao gerar pitch. Tente novamente.',
      },
      { status: 500 }
    );
  }
}

/**
 * Fallback de emergência caso tudo falhe
 */
function getEmergencyFallback(body: PitchRequest): string {
  const displayName = body.trade_name || body.company_name;
  const greeting = body.decision_maker_name 
    ? `Olá, ${body.decision_maker_name.split(' ')[0]}!` 
    : 'Olá!';

  return `${greeting} Vi que a ${displayName} atua em ${body.niche} em ${body.city}/${body.state} e não tem site próprio. 90% dos clientes pesquisam no Google antes de comprar. Podemos resolver isso em dias com site + WhatsApp + SEO local. Topa uma call de 15 min?`;
}

/**
 * GET /api/ai/pitch - Health check e informações do modelo
 */
export async function GET() {
  const openaiConfigured = !!process.env.OPENAI_API_KEY;
  const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({
    status: 'ok',
    service: 'AI Pitch Generator',
    models: {
      primary: openaiConfigured ? 'gpt-4o-mini (OpenAI)' : 'não configurado',
      fallback: anthropicConfigured ? 'claude-3-haiku (Anthropic)' : 'não configurado',
      static: 'fallback estático (sempre disponível)',
    },
    channels: ['whatsapp', 'email', 'linkedin', 'phone'],
    documentation: {
      openai: 'https://platform.openai.com/docs/api-reference/chat',
      anthropic: 'https://docs.anthropic.com/claude/reference/messages_post',
    },
  });
}