/**
 * Qualificação de leads por IA (OpenAI GPT-4o-mini / Anthropic Claude).
 *
 * SEM RESTRIÇÃO DE BUSCAS: em vez de consultar o Google lead a lead (limite
 * do SerpApi), envia TODOS os leads da pesquisa em UMA chamada de IA que
 * classifica cada um como qualificado/não para o nicho pesquisado.
 *
 * A IA recebe o nicho + nome/tag OSM de cada lead e decide se a empresa
 * realmente atua nesse nicho (conhecimento semântico de mundo real), além de
 * sugerir a categoria no Google e o motivo da decisão.
 */

import { getOpenAIClient, getAnthropicClient } from '@/lib/ai';
import { OSMPlace } from '@/lib/osm';

export interface AIQualificationEntry {
  index: number;
  qualified: boolean;
  match_score: number; // 0-100
  reason: string;
  google_category?: string;
}

export interface AIQualificationResult {
  entries: AIQualificationEntry[];
  model_used: string;
  fallback_used: boolean;
}

const SYSTEM_PROMPT = `Você é um especialista em qualificação de leads B2B para empresas brasileiras.

Sua tarefa: para cada empresa listada, julgue se ela REALMENTE atua no nicho pesquisado pelo usuário. Uma lead é QUALIFICADA apenas se a empresa claramente pertence ao nicho. Use seu conhecimento de mundo (nomes de marcas, categorias de negócios, áreas de atuação).

REGRA CRÍTICA: SEJA RIGOROSO. Falsos positivos custam dinheiro real em prospecção. Se houver dúvida razoável de que a empresa NÃO é do nicho, marque como não qualificada (match_score baixo). Marcas que parecem relevantes mas não confirmam o nicho devem ser rejeitadas.

Para cada empresa retorne:
- index: número do item no array (obrigatório para correlacionar)
- qualified: true/false
- match_score: 0-100 (quanto mais certo, maior)
- reason: justificativa curta em pt-BR (máx 25 palavras)
- google_category: a categoria provável no Google Maps em pt-BR (ex: "Loja de artigos esportivos", "Padaria", "Veterinária")

RESPONDA APENAS JSON válido no formato:
{"entries":[{"index":0,"qualified":true,"match_score":92,"reason":"Loja de tênis especializada com nome do nicho","google_category":"Loja de calçados esportivos"}]}`;

function buildUserContent(
  niche: string,
  city: string,
  state: string,
  leads: OSMPlace[]
): string {
  const list = leads
    .map((lead, i) => {
      const name = [lead.company_name, lead.trade_name !== lead.company_name ? lead.trade_name : ''].filter(Boolean).join(' / ');
      return `[${i}] Nome: "${name}" | Tag OSM: ${lead.niche || 'não informada'} | Endereço: ${lead.formatted_address || ''}, ${lead.city || city} - ${lead.state || state}`;
    })
    .join('\n');

  return `NICHO PESQUISADO: "${niche}"
CIDADE/ESTADO: ${city}/${state}
TOTAL DE EMPRESAS: ${leads.length}

EMPRESAS:
${list}`;
}

/**
 * Executa a qualificação por IA em batch.
 * Retorna null se nenhum provedor de IA estiver disponível.
 */
export async function qualifyLeadsWithAI(
  niche: string,
  city: string,
  state: string,
  leads: OSMPlace[]
): Promise<AIQualificationResult | null> {
  if (leads.length === 0) return null;

  const userContent = buildUserContent(niche, city, state, leads);

  // ── 1. OpenAI (primário) ──────────────────────────────────────────────
  const openai = getOpenAIClient();
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Rápido e barato
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1, // Determinístico para decisões
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('OpenAI retornou resposta vazia');

      const parsed = JSON.parse(content);
      const entries: AIQualificationEntry[] = (parsed.entries || []).map((e: any) => ({
        index: Number(e.index),
        qualified: !!e.qualified,
        match_score: Math.max(0, Math.min(100, Number(e.match_score) || 0)),
        reason: String(e.reason || ''),
        google_category: e.google_category ? String(e.google_category) : undefined,
      }));

      console.log(`[qualify-ai] OpenAI: ${entries.filter(e => e.qualified).length}/${entries.length} qualificadas em 1 chamada (${leads.length} leads)`);
      return { entries, model_used: 'gpt-4o-mini', fallback_used: false };
    } catch (error) {
      console.warn('[qualify-ai] OpenAI falhou, tentando Anthropic:', error);
    }
  }

  // ── 2. Anthropic (fallback) ───────────────────────────────────────────
  const anthropic = getAnthropicClient();
  if (anthropic) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest', // Rápido e barato
        max_tokens: 3000,
        temperature: 0.1,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      });

      const content = message.content[0];
      if (content.type !== 'text') throw new Error('Anthropic retornou resposta inesperada');

      const parsed = JSON.parse(content.text);
      const entries: AIQualificationEntry[] = (parsed.entries || []).map((e: any) => ({
        index: Number(e.index),
        qualified: !!e.qualified,
        match_score: Math.max(0, Math.min(100, Number(e.match_score) || 0)),
        reason: String(e.reason || ''),
        google_category: e.google_category ? String(e.google_category) : undefined,
      }));

      console.log(`[qualify-ai] Claude: ${entries.filter(e => e.qualified).length}/${entries.length} qualificadas em 1 chamada (${leads.length} leads)`);
      return { entries, model_used: 'claude-3-5-haiku', fallback_used: false };
    } catch (error) {
      console.warn('[qualify-ai] Anthropic falhou:', error);
    }
  }

  return null;
}

/**
 * Aplica os resultados da IA na lista de leads (em ordem).
 * Leads sem resposta da IA são consideradas não qualificadas (rigoroso).
 */
export function applyAIQualification(
  osmLeads: OSMPlace[],
  aiResult: AIQualificationResult | null
): Map<number, AIQualificationEntry> {
  const byIndex = new Map<number, AIQualificationEntry>();
  if (!aiResult) return byIndex;

  for (const entry of aiResult.entries) {
    if (entry.index >= 0 && entry.index < osmLeads.length) {
      byIndex.set(entry.index, entry);
    }
  }
  return byIndex;
}