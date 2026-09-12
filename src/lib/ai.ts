/**
 * Cliente de IA para geração de pitches de prospecção
 * Suporta OpenAI (GPT-4o-mini) e Anthropic (Claude)
 * 
 * Documentação OpenAI: https://platform.openai.com/docs/api-reference/chat
 * Documentação Anthropic: https://docs.anthropic.com/claude/reference/messages_post
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface PitchRequest {
  company_name: string;
  trade_name?: string;
  decision_maker_name?: string;
  niche: string;
  city: string;
  state: string;
  phone_number?: string;
  phone_type?: 'mobile' | 'landline' | 'whatsapp';
  channel: 'whatsapp' | 'email' | 'linkedin' | 'phone';
  custom_context?: string; // Contexto adicional do usuário
}

export interface PitchResponse {
  pitch: string;
  model_used: string;
  tokens_used?: number;
  fallback_used: boolean;
}

/**
 * Templates de prompt por canal
 */
const CHANNEL_PROMPTS = {
  whatsapp: `
Você é um especialista em vendas B2B no Brasil. Escreva uma mensagem de WhatsApp curta, direta e persuasiva para prospecção ativa.

REGRAS OBRIGATÓRIAS:
1. Máximo 160 caracteres por mensagem (pode quebrar em 2 mensagens se necessário)
2. Tom casual, amigável e profissional - NUNCA robótico
3. Use o nome do decisor se disponível (ex: "Olá, João!")
4. Mencione o nicho e cidade especificamente
5. Foque na DOR: "empresas sem site perdem 90% dos clientes que pesquisam no Google"
6. Posicione a solução: "site profissional + WhatsApp integrado + SEO local"
7. CTA claro e de baixo atrito: "Topa uma call de 10 min?" / "Posso enviar um exemplo?"
8. Use no máximo 1-2 emojis
9. Português do Brasil natural
10. SEM placeholders genéricos - use os dados reais fornecidos

FORMATO: Apenas a mensagem final, pronta para copiar e colar no WhatsApp.`,
  
  email: `
Você é um especialista em vendas B2B no Brasil. Escreva um e-mail de prospecção ativa profissional e persuasivo.

REGRAS OBRIGATÓRIAS:
1. Assunto atrativo e relevante (máx 50 caracteres)
2. Estrutura: Saudação → Contexto/Descoberta → Dor → Solução → Prova Social → CTA → Assinatura
3. Tom consultivo, NÃO vendedor agressivo
4. Personalize com nome do decisor se disponível
5. Mencione nicho e cidade especificamente
6. Foque na DOR: "90% dos clientes B2B pesquisam no Google antes de fechar"
7. Posicione: "Site profissional otimizado para SEO local + WhatsApp Business + Formulários inteligentes"
8. CTA claro: "Gostaria de agendar 15 min para mostrar cases do seu nicho?"
9. Inclua placeholders para [Seu Nome], [Sua Empresa], [Link Portfólio]
10. Texto puro bem formatado (sem HTML complexo)`,

  linkedin: `
Você é um especialista em vendas B2B no Brasil. Escreva uma mensagem de conexão/InMail no LinkedIn.

REGRAS OBRIGATÓRIAS:
1. Máximo 300 caracteres (limite de conexão)
2. Tom profissional mas pessoal (como 1ª conexão)
3. Foque em valor e relevância, NÃO em venda direta
4. Personalize com nome do decisor
5. Mencione nicho e cidade
6. CTA suave: "Topa trocar uma ideia rápida?" / "Posso enviar mais info?"
7. Sem emojis excessivos`,

  phone: `
Você é um especialista em vendas B2B no Brasil. Escreva um roteiro de ligação fria (cold call) estruturado.

REGRAS OBRIGATÓRIAS:
1. Estrutura: Abertura → Gancho/Descoberta → Dor → Agendamento → Fechamento
2. Tom conversacional, natural, NÃO decorado
3. Perguntas abertas para engajar
4. Tratamento de objeções comuns ("não tenho tempo", "já tenho site", "não tenho verba")
5. Objetivo: Agendar reunião de 15-20 min, NÃO vender na ligação
6. Inclua pausas sugeridas [PAUSA] e alternativas de resposta`,
};

/**
 * Cliente OpenAI
 */
export function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  
  return new OpenAI({
    apiKey,
    // Configurações recomendadas para produção
    maxRetries: 2,
    timeout: 30000,
  });
}

/**
 * Cliente Anthropic
 */
export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  
  return new Anthropic({
    apiKey,
    maxRetries: 2,
    timeout: 30000,
  });
}

/**
 * Gera pitch usando OpenAI
 */
async function generateWithOpenAI(
  client: OpenAI,
  prompt: string,
  userContent: string
): Promise<{ pitch: string; tokensUsed: number }> {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.7,
    max_tokens: 500,
    top_p: 0.9,
  });

  const pitch = completion.choices[0]?.message?.content?.trim();
  const tokensUsed = completion.usage?.total_tokens || 0;

  if (!pitch) {
    throw new Error('OpenAI retornou resposta vazia');
  }

  return { pitch, tokensUsed };
}

/**
 * Gera pitch usando Anthropic Claude
 */
async function generateWithAnthropic(
  client: Anthropic,
  prompt: string,
  userContent: string
): Promise<{ pitch: string; tokensUsed: number }> {
  const message = await client.messages.create({
    model: 'claude-3-haiku-20240307', // Modelo rápido e barato
    max_tokens: 500,
    temperature: 0.7,
    system: prompt,
    messages: [
      { role: 'user', content: userContent },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Resposta inesperada do Anthropic');
  }

  return { pitch: content.text.trim(), tokensUsed: message.usage?.input_tokens + message.usage?.output_tokens || 0 };
}

/**
 * Constrói o conteúdo do usuário com os dados da empresa
 */
function buildUserContent(request: PitchRequest): string {
  const displayName = request.trade_name || request.company_name;
  const greeting = request.decision_maker_name 
    ? `Olá, ${request.decision_maker_name.split(' ')[0]}!` 
    : 'Olá!';

  return `
Empresa: ${displayName}
Razão Social: ${request.company_name}
${request.decision_maker_name ? `Decisor: ${request.decision_maker_name}` : 'Decisor: Não identificado'}
Nicho: ${request.niche}
Localização: ${request.city}/${request.state}
${request.phone_number ? `Telefone: ${request.phone_number} (${request.phone_type || 'não identificado'})` : ''}
Canal: ${request.channel}
${request.custom_context ? `Contexto adicional: ${request.custom_context}` : ''}

Saudação sugerida: "${greeting}"
  `.trim();
}

/**
 * Função principal para gerar pitch
 * Tenta OpenAI primeiro, cai para Anthropic, depois fallback estático
 */
export async function generatePitch(request: PitchRequest): Promise<PitchResponse> {
  const channelPrompt = CHANNEL_PROMPTS[request.channel] || CHANNEL_PROMPTS.whatsapp;
  const userContent = buildUserContent(request);

  // Tenta OpenAI
  const openai = getOpenAIClient();
  if (openai) {
    try {
      const { pitch, tokensUsed } = await generateWithOpenAI(openai, channelPrompt, userContent);
      return {
        pitch,
        model_used: 'gpt-4o-mini',
        tokens_used: tokensUsed,
        fallback_used: false,
      };
    } catch (error) {
      console.warn('OpenAI falhou, tentando Anthropic:', error);
    }
  }

  // Tenta Anthropic
  const anthropic = getAnthropicClient();
  if (anthropic) {
    try {
      const { pitch, tokensUsed } = await generateWithAnthropic(anthropic, channelPrompt, userContent);
      return {
        pitch,
        model_used: 'claude-3-haiku',
        tokens_used: tokensUsed,
        fallback_used: false,
      };
    } catch (error) {
      console.warn('Anthropic falhou, usando fallback:', error);
    }
  }

  // Fallback estático
  return {
    pitch: getFallbackPitch(request),
    model_used: 'fallback-static',
    fallback_used: true,
  };
}

/**
 * Fallback estático quando nenhuma IA está disponível
 */
function getFallbackPitch(request: PitchRequest): string {
  const displayName = request.trade_name || request.company_name;
  const greeting = request.decision_maker_name 
    ? `Olá, ${request.decision_maker_name.split(' ')[0]}!` 
    : 'Olá!';

  const pitches = {
    whatsapp: `${greeting} Tudo bem? 👋

Vi que a ${displayName} atua em ${request.niche} aqui em ${request.city}/${request.state} e notei que não têm site próprio.

Hoje, 9 em cada 10 clientes pesquisam no Google antes de contratar. Sem site, você perde credibilidade e deixa de aparecer para quem procura exatamente o que você oferece.

Ajudamos empresas como a sua a terem presença digital profissional em poucos dias, com site otimizado para receber contatos pelo WhatsApp.

Topa uma conversa rápida de 10 min para eu mostrar como funciona? Sem compromisso.

Abs!`,

    email: `Assunto: Site para ${displayName} - ${request.niche} em ${request.city}

${greeting},

Escrevo porque identifiquei a ${displayName} como uma excelente oportunidade no segmento de ${request.niche} em ${request.city}/${request.state}.

Notei que a empresa ainda não possui um site próprio - apenas perfis em redes sociais. O problema: 90% dos clientes B2B pesquisam no Google antes de fechar negócio. Sem site, você fica invisível para quem tem intenção de compra.

Nós somos especialistas em criar sites de alta conversão para ${request.niche}. Entregamos:
✅ Site profissional otimizado para SEO local
✅ Integração direta com WhatsApp Business
✅ Formulários de orçamento inteligentes
✅ Hospedagem segura e velocidade máxima

Gostaria de agendar 15 minutos para mostrar cases reais do seu nicho?

Melhores cumprimentos,
[Seu Nome]
[Sua Empresa]
[Link do Portfólio]`,

    linkedin: `${greeting}, vi seu perfil e a atuação da ${displayName} em ${request.niche} aqui em ${request.city}. 

Notei que a empresa ainda não tem site próprio - apenas redes sociais. Para B2B, isso significa perder leads qualificados que buscam no Google.

Ajudo empresas do seu segmento a conquistarem presença digital que converte. Topa trocar uma ideia rápida?`,

    phone: `ROTEIRO DE LIGAÇÃO - ${displayName}

ABERTURA:
"${greeting}, aqui é [Seu Nome] da [Sua Empresa]. Tudo bem?
[PAUSA]
Liguei porque vi que a ${displayName} é referência em ${request.niche} aqui em ${request.city}..."

GANCHO/DEScoberta:
"...e notei que a empresa não tem site próprio, apenas redes sociais. 
[PAUSA]
Como vocês fazem hoje quando um cliente novo procura por vocês no Google?"

DOR:
"Pois é... estudos mostram que 90% dos clientes B2B pesquisam no Google antes de fechar. Sem site, a ${displayName} fica invisível pra quem tem dinheiro na mão pra contratar."

SOLUÇÃO RÁPIDA:
"A gente resolve isso em dias, não meses. Site profissional + WhatsApp integrado + SEO local pra você aparecer nas buscas."

CTA/AGENDAMENTO:
"Topa a gente agendar 15 min essa semana pra eu mostrar uns cases de ${request.niche}? Qual dia funciona melhor, terça ou quinta?"

FECHAMENTO:
"Perfeito, mando o convite pro seu e-mail/WhatsApp. Qual o melhor? Obrigado, ${request.decision_maker_name?.split(' ')[0] || 'pessoal'}!"
`,
  };

  return pitches[request.channel] || pitches.whatsapp;
}

/**
 * Gera múltiplos pitches para A/B testing
 */
export async function generatePitchVariations(
  request: PitchRequest,
  count: number = 3
): Promise<PitchResponse[]> {
  const variations: PitchResponse[] = [];
  
  for (let i = 0; i < count; i++) {
    const variationRequest = {
      ...request,
      custom_context: `${request.custom_context || ''} Variação ${i + 1}: tom ${i === 0 ? 'direto' : i === 1 ? 'consultivo' : 'casual'}.`,
    };
    
    const result = await generatePitch(variationRequest);
    variations.push(result);
  }
  
  return variations;
}