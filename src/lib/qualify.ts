/**
 * Qualificação de leads: confere o nicho da empresa no Google (Google Maps via SerpApi)
 * e cruza com os leads do OpenStreetMap. Só considera QUALIFICADA a lead cujo
 * Google confirma que faz parte do nicho pesquisado.
 *
 * Com SERPAPI_API_KEY configurada: verificação real no Google (rating, reviews, categoria).
 * Sem chave: heurística local por tags OSM + palavras-chave do nicho no nome.
 */

import { searchLocalBusinesses, EnrichedPlace } from '@/lib/places';
import { OSMPlace, NICHE_TO_OSM_TAGS, normalizeNiche, normalizeNicheWithRelated, unaccent } from '@/lib/osm';
import { qualifyLeadsWithAI, applyAIQualification, AIQualificationResult } from '@/lib/ai-qualify';

// Palavras-chave por nicho para confirmar no NOME da empresa quando a tag OSM
// é apenas RELACIONADA (ex: hairdresser para "barbearia"). Sem confirmação
// no nome, a lead é descartada — garante qualificação qualificada, não genérica.
const NICHES_NAME_KEYWORDS: Array<[string, string[]]> = [
  ['barbearia', ['barbear', 'barber', 'corte masculino', 'barba']],
  ['salao', ['salao', 'beleza', 'estetica', 'cabeleireiro', 'manicure']],
  ['veterinario', ['veterinario', 'vet ', 'animal', 'pet']],
  ['pet', ['pet', 'animal', 'petshop']],
  ['restaurante', ['restaurante', 'churrascaria', 'bistro']],
  ['pizzaria', ['pizza', 'pizzaria']],
  ['hamburguer', ['hamburguer', 'burger', 'lanche']],
  ['lanchonete', ['lanchonete', 'lanches']],
  ['padaria', ['padaria', 'pao', 'confeitaria', 'bolos']],
  ['oficina', ['oficina', 'mecanica', 'mecanico', 'auto', 'pneus']],
  ['academia', ['academia', 'fitness', 'crossfit', 'musculacao']],
  ['farmacia', ['farmacia', 'drogaria', 'remedio']],
  ['celular', ['celular', 'telefone', 'smartphone', 'informatica']],
];

export interface QualifiedLead extends OSMPlace {
  qualified: boolean;
  match_score: number; // 0-100
  verification: 'google' | 'ai' | 'osm';
  google_rating?: number | null;
  google_reviews?: number | null;
  google_category?: string | null;
  google_title?: string | null;
  // IU da IA
  ai_reason?: string;
  model_used?: string;
}

export interface QualificationResult {
  leads: QualifiedLead[];
  qualified: QualifiedLead[];
  discarded: QualifiedLead[];
  verification: 'google' | 'ai' | 'osm';
  google_results_count: number;
  ai_model?: string;
}

// ── Normalização para matching de nomes ──────────────────────────────────
const GENERIC_TOKENS = new Set([
  'sup', 'supermercado', 'mercado', 'ltda', 'ltda', 'me', 'eireli', 'epp',
  'center', 'centro', 'shop', 'loja', 'distribuidor', 'atacadista', 'com',
  'de', 'da', 'do', 'das', 'dos', 'e', 'av', 'avenida', 'rua', 'r', 'unidade',
  'filial', 'sao', 'san', 'santa', 'santo', 'tradicao', 'desde', 'clube',
]);

/** Normaliza nome para matching: lowercase, sem acentos, sem pontuação, sem tokens genéricos */
function normalizeName(name?: string): string {
  if (!name) return '';
  return (name as string)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !GENERIC_TOKENS.has(t))
    .join(' ');
}

function tokenSet(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter(Boolean));
}

/** Similaridade Jaccard entre dois conjuntos de tokens */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const aArray = Array.from(a);
  for (const t of aArray) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function normalizePhone(p?: string): string {
  return (p || '').replace(/\D/g, '');
}

/** Distância haversine em metros */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Cruza um lead OSM com resultados do Google Maps e calcula score de match (0-100).
 * Pontos fortes: nome idêntico, telefone igual, mesmo lugar quase na mesma coordenada.
 */
function matchLead(lead: OSMPlace, googlePlaces: EnrichedPlace[]): {
  matched: boolean;
  score: number;
  google?: EnrichedPlace;
} {
  const osmName = normalizeName(lead.company_name || lead.trade_name);
  const osmTokens = tokenSet(osmName);
  const osmPhone = normalizePhone(lead.phone_number);

  let best: { score: number; google?: EnrichedPlace; reason: string } = { score: 0, reason: 'none' };

  for (const gp of googlePlaces) {
    let score = 0;
    let reason = '';

    // 1. Nome: Jaccard dos tokens
    const gpName = normalizeName(gp.company_name || gp.trade_name);
    const gpTokens = tokenSet(gpName);
    const jac = jaccard(osmTokens, gpTokens);

    if (osmTokens.size > 0 && gpTokens.size > 0 && jac > 0.45) {
      score = Math.max(score, Math.round(jac * 80));
      reason = `nome ${Math.round(jac * 100)}%`;
    }

    // 2. Telefone: match exato de dígitos é confirmação fortíssima
    const gpPhone = normalizePhone(gp.phone_number);
    if (osmPhone && gpPhone && osmPhone.length >= 8 && osmPhone === gpPhone) {
      score = Math.max(score, 95);
      reason = reason || 'telefone';
    }

    // 3. Coordenadas: mesmo lugar a menos de ~500m dá forte indicação
    if (lead.gps_coordinates && gp.gps_coordinates) {
      const dist = haversineMeters(
        lead.gps_coordinates.latitude,
        lead.gps_coordinates.longitude,
        gp.gps_coordinates.latitude,
        gp.gps_coordinates.longitude
      );
      if (dist < 200) score = Math.max(score, 90);
      else if (dist < 500) score = Math.max(score, 70);
    }

    if (score > best.score) {
      best = { score, google: gp, reason };
    }
  }

  // Qualificada: nome substancialmente igual OU telefone/coordenada confirmando
  const matched = best.score >= 55;
  return { matched, score: best.score, google: best.google };
}

/**
 * Qualifica uma lista de leads OSM contra o Google.
 * Retorna a lista completa + separação qualificadas/descartadas.
 */
export async function qualifyLeads(
  osmLeads: OSMPlace[],
  params: { niche: string; city: string; state: string }
): Promise<QualificationResult> {
  const apiKey = process.env.SERPAPI_API_KEY;
  let googlePlaces: EnrichedPlace[] = [];
  let verification: 'google' | 'ai' | 'osm' = 'osm';
  let aiModel: string | undefined;
  let aiEntries: Map<number, { qualified: boolean; match_score: number; reason: string; google_category?: string }> | null = null;

  // ── Modo GOOGLE REAL (SerpApi) ────────────────────────────────────────
  if (apiKey && apiKey.trim().length > 5 && !apiKey.includes('your_serpapi')) {
    try {
      const places = await searchLocalBusinesses({
        niche: `${params.niche}`,
        city: params.city,
        state: params.state,
      });
      googlePlaces = places;
      verification = 'google';
      console.log(`[qualify] Google retornou ${googlePlaces.length} empresas para "${params.niche}"`);
    } catch (err) {
      console.error('[qualify] Falha na busca Google via SerpApi, caindo p/ IA:', err);
      verification = 'osm';
    }
  }

  // ── Modo IA (sem chave SerpApi, com OpenAI/Claude) ─────────────────────
  // Envia TODOS os leads em 1 chamada batch — sem restrição de buscas.
  if (verification !== 'google' && (validateAIKey(process.env.OPENAI_API_KEY) || validateAIKey(process.env.ANTHROPIC_API_KEY))) {
    try {
      const aiResult = await qualifyLeadsWithAI(params.niche, params.city, params.state, osmLeads);
      if (aiResult) {
        aiEntries = applyAIQualification(osmLeads, aiResult);
        aiModel = aiResult.model_used;
        if (aiEntries.size > 0) {
          verification = 'ai';
          console.log(`[qualify] IA (${aiResult.model_used}): ${osmLeads.length} leads avaliados em 1 chamada`);
        }
      }
    } catch (err) {
      console.error('[qualify] IA falhou, caindo p/ heurística:', err);
      verification = 'osm';
    }
  }

  // ── Matching (Google) OU decisão por IA ───────────────────────────────
  const nicheLower = params.niche.toLowerCase();
  const nicheTokens = tokenSet(normalizeName(params.niche));

  const leads: QualifiedLead[] = osmLeads.map((lead, index) => {
    // ── Decisão por IA (verification === 'ai') ─────────────────────────
    if (aiEntries && aiEntries.size > 0) {
      const ai = aiEntries.get(index);
      if (ai) {
        return {
          ...lead,
          qualified: ai.qualified,
          match_score: ai.match_score,
          verification: 'ai' as const,
          google_rating: null,
          google_reviews: null,
          google_category: ai.google_category || null,
          google_title: lead.company_name,
          ai_reason: ai.reason,
          model_used: undefined,
        };
      }
      return {
        ...lead,
        qualified: false,
        match_score: 0,
        verification: 'ai' as const,
        google_category: null,
        google_title: null,
        ai_reason: 'Sem resposta da IA',
      };
    }

    // ── Modo Google ─────────────────────────────────────────────────────
    if (verification === 'google' && googlePlaces.length > 0) {
      const { matched, score, google } = matchLead(lead, googlePlaces);
      let matchScore = score;

      if (google?.category && nicheTokens.size > 0) {
        const catTokens = tokenSet(normalizeName(google.category));
        const catJac = jaccard(catTokens, nicheTokens);
        if (catJac > 0.3) matchScore = Math.max(matchScore, 60);
      }

      return {
        ...lead,
        qualified: matched || matchScore >= 60,
        match_score: Math.min(100, matchScore),
        verification: 'google' as const,
        google_rating: google?.rating ?? null,
        google_reviews: google?.reviews_count ?? null,
        google_category: google?.category ?? null,
        google_title: google?.company_name ?? null,
      };
    }

    // ── Heurística local 100% gratuita (sem Google e sem IA) ──────────────
    // Usa TODAS as tags OSM da empresa (shop, amenity, craft, office, leisure,
    // tourism, healthcare, building, brand...) — dados abertos, sem limite.
    const nameNorm = normalizeName(lead.company_name || lead.trade_name);
    const nameTokens = tokenSet(nameNorm);

    let score = 0;
    const tagHits: string[] = [];

    // Tags esperadas para o nicho pesquisado.
    // strictTags = mapeadas EXATAMENTE para o nicho (barber p/ barbearia)
    // looseTags  = tags substitutas do mapa ampliado (hairdresser p/ barbearia)
    const strictNicheTags = new Set<string>();
    const looseNicheTags = new Set<string>();
    try {
      const nicheKey = params.niche.toLowerCase().trim();
      // strict = tags exatas do nicho (barber p/ barbearia)
      for (const t of normalizeNiche(params.niche)) {
        const val = (t.split('=')[1] || t).replace(/[~"]/g, '');
        strictNicheTags.add(val);
      }
      // loose = tags relacionadas da busca ampliada (hairdresser p/ barbearia)
      for (const t of normalizeNicheWithRelated(params.niche)) {
        const val = (t.split('=')[1] || t).replace(/[~"]/g, '');
        if (!strictNicheTags.has(val)) looseNicheTags.add(val);
      }
      // Tags de nichos vizinhos (busca parcial) também entram em loose
      const flatNicheKey = unaccent(nicheKey);
      for (const [key, vals] of Object.entries(NICHE_TO_OSM_TAGS)) {
        const flatKey = unaccent(key);
        if (flatKey !== flatNicheKey && (flatKey.includes(flatNicheKey) || flatNicheKey.includes(flatKey))) {
          for (const v of vals) looseNicheTags.add((v.split('=')[1] || v).replace(/[~"]/g, ''));
        }
      }
    } catch { /* ignore */ }

    // Coleta todas as tags da empresa que indicam atividade (ignora metadados)
    const activityKeys = ['shop', 'amenity', 'craft', 'office', 'leisure', 'tourism', 'healthcare', 'building', 'brand', 'sport', 'industrial', 'services', 'cuisine'];
    const activityValues: string[] = [];
    const leadTags = lead.tags || {};
    for (const key of activityKeys) {
      const val = leadTags[key];
      if (val) activityValues.push(String(val).toLowerCase());
    }
    if (!activityValues.length && lead.niche) activityValues.push(String(lead.niche).toLowerCase());

    // (a) Tag OSM bate com o esperado?
    //     Tag EXATA do nicho → score alto. Tag substituta → score médio e exige nome.
    let strongTagHit = false;
    let mediumTagHit = false;
    for (const val of activityValues) {
      if (strictNicheTags.has(val)) {
        strongTagHit = true;
        tagHits.push(val);
      } else if (looseNicheTags.has(val)) {
        mediumTagHit = true;
        tagHits.push(val);
      }
    }
    if (strongTagHit) score = Math.max(score, 85);

    // Tag relacionada (mediumTagHit) exige confirmação no NOME da empresa.
    // Ex: "barbearia" + loja com tag hairdresser só qualifica se o nome
    // reafirmar (Barbearia X, Martins Barbear...), excluindo salões de beleza.
    if (mediumTagHit && !strongTagHit) {
      const nameReinforces = NICHES_NAME_KEYWORDS.some(([niche, words]) => {
        const nk = unaccent(params.niche.toLowerCase());
        const flatNiche = unaccent(niche);
        if (nk.includes(flatNiche) || flatNiche.includes(nk)) {
          return words.some(w => nameNorm.includes(unaccent(w)));
        }
        return false;
      });
      score = Math.max(score, nameReinforces ? 70 : 40);
    }

    // (b) Dicionário: tags comuns do OSM → termos do nicho em português
    //     Ex: nicho "tenis/esportes" → shop=sports; "pizzaria" → cuisine=pizza
    const tagToNicheMap: Record<string, string[]> = {
      sports: ['tenis', 'esporte', 'esportes', 'artigos esportivos', 'futebol'],
      shoes: ['tenis', 'calcado', 'calcados', 'sapatos'],
      clothes: ['roupa', 'vestuario', 'moda'],
      bakery: ['padaria', 'pao', 'confeitaria'],
      restaurant: ['restaurante', 'comida', 'pizzaria', 'hamburguer'],
      fast_food: ['lanchonete', 'comida rapida', 'hamburguer', 'pizza'],
      cafe: ['cafe', 'cafeteria', 'lanchonete'],
      pharmacy: ['farmacia', 'drogaria', 'remedio'],
      barber: ['barbearia', 'barbeiro', 'cabelo'],
      hairdresser: ['salao', 'cabeleireiro', 'beleza'],
      beauty: ['salao', 'beleza', 'estetica'],
      car_repair: ['oficina', 'mecanica', 'mecanico', 'conserto', 'auto'],
      mechanic: ['oficina', 'mecanica', 'mecanico'],
      veterinary: ['veterinario', 'veterinaria', 'pet', 'animal'],
      pet: ['pet shop', 'pet', 'animal', 'veterinario'],
      fitness_centre: ['academia', 'fitness', 'musculacao', 'ginastica'],
      furniture: ['moveis', 'mobilia'],
      computer: ['informatica', 'computador', 'ti', 'tecnologia'],
      electronics: ['eletronicos', 'celular', 'eletro'],
      mobile_phone: ['celular', 'telefone', 'smartphone'],
    };

    // Bônus: tag de dicionário + confirmação NO NOME juntas. Sem nome, não passa.
    // Ex: nicho "pizzaria", tag restaurant → só vale se o nome tiver "pizza/pizzaria".
    if (!strongTagHit && nameNorm) {
      const nicheLower = unaccent(params.niche.toLowerCase());
      for (const val of activityValues) {
        const related = tagToNicheMap[val];
        if (!related) continue;
        const dictWord = related.find(r =>
          nicheLower.includes(unaccent(r.replace(/\s+/g, ''))) || nicheLower.includes(val)
        );
        if (dictWord && nameNorm.includes(unaccent(dictWord.replace(/\s+/g, '')))) {
          score = Math.max(score, 70);
          tagHits.push(val);
          break;
        }
      }
    }

    // (c) Nome da empresa contém palavra-chave do nicho (ex: "Tenys Pé" contém "tenis")
    const nicheTokenArray = Array.from(nicheTokens);
    let nameHit = false;
    for (const token of nicheTokenArray) {
      if (nameTokens.has(token) || nameNorm.includes(token)) {
        nameHit = true;
        score = Math.max(score, 45);
        break;
      }
    }
    // (d) Prefixo de token do nicho no nome ("sport" → "sports", "esport" → "esportivo")
    if (!nameHit) {
      for (const token of nicheTokenArray) {
        if (token.length >= 4 && nameNorm.includes(token.slice(0, 4))) {
          score = Math.max(score, 40);
          break;
        }
      }
    }

    // (e) Bônus: mesma cidade do filtro (relevância geográfica)
    if (lead.city && params.city && normalizeName(lead.city) === normalizeName(params.city)) {
      score = Math.min(100, score + 5);
    }

    return {
      ...lead,
      qualified: score >= 55,
      match_score: Math.min(100, score),
      verification: 'osm' as const,
      google_rating: null,
      google_reviews: null,
      google_category: activityValues[0] || osmNicheFallback(lead) || null,
      google_title: lead.company_name,
    };
  });

  return {
    leads,
    qualified: leads.filter(l => l.qualified),
    discarded: leads.filter(l => !l.qualified),
    verification,
    google_results_count: googlePlaces.length,
    ai_model: aiModel,
  };
}

/** Valida se a chave de IA existe e é plausível */
function validateAIKey(key?: string): boolean {
  return !!key && key.trim().length > 10 && !key.includes('your_');
}

/** Fallback para o campo google_category: usa a primeira tag de atividade OSM */
function osmNicheFallback(lead: OSMPlace): string | null {
  const tags = lead.tags || {};
  for (const key of ['shop', 'amenity', 'craft', 'office', 'leisure', 'tourism']) {
    if (tags[key]) return tags[key];
  }
  return lead.niche || null;
}