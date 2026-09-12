/**
 * Integração com SerpApi (Google Maps Engine) para busca de empresas locais
 * Documentação: https://serpapi.com/google-maps-api
 * Documentação Local Results: https://serpapi.com/maps-local-results
 */

export interface PlaceSearchParams {
  niche: string;
  city: string;
  state: string;
  country?: string; // default 'Brazil'
}

export interface PlaceResult {
  place_id: string;
  data_id?: string;
  data_cid?: string;
  title: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  types?: string[];
  gps_coordinates?: {
    latitude: number;
    longitude: number;
  };
  thumbnail?: string;
  open_state?: string;
  hours?: string;
  operating_hours?: Record<string, string>;
  description?: string;
  service_options?: {
    dine_in?: boolean;
    takeout?: boolean;
    delivery?: boolean;
  };
  extensions?: Array<Record<string, string[]>>;
  place_id_search?: string;
  reviews_link?: string;
  photos_link?: string;
}

export interface SearchResponse {
  search_metadata?: {
    id: string;
    status: string;
    json_endpoint: string;
    created_at: string;
    processed_at: string;
    google_maps_url: string;
    raw_html_file: string;
    total_time_taken: number;
  };
  search_parameters?: {
    engine: string;
    type: string;
    q: string;
    ll?: string;
    google_domain: string;
    hl: string;
    gl?: string;
  };
  search_information?: {
    local_results_state: string;
    query_displayed: string;
  };
  local_results?: PlaceResult[];
  ads?: PlaceResult[];
  local_map?: {
    gps_coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  serpapi_pagination?: {
    next: string;
    next_page_token: string;
  };
}

export interface EnrichedPlace {
  place_id: string;
  company_name: string;
  trade_name?: string;
  formatted_address?: string;
  phone_number: string;
  phone_type: 'mobile' | 'landline' | 'whatsapp';
  website?: string;
  has_website: boolean;
  website_type: 'own' | 'social' | 'none';
  gps_coordinates?: {
    latitude: number;
    longitude: number;
  };
  rating?: number;
  reviews_count?: number;
  category?: string;
  niche: string;
  city: string;
  state: string;
  country_code: string;
  cnpj?: string;
  decision_maker_name?: string;
}

/**
 * Domínios de redes sociais conhecidos para filtro de website
 */
const SOCIAL_DOMAINS = [
  'facebook.com',
  'fb.com',
  'instagram.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'tiktok.com',
  'wa.me',
  'api.whatsapp.com',
  'web.whatsapp.com',
  'maps.google.com',
  'goo.gl',
  'bit.ly',
  'linktr.ee',
  'linkin.bio',
  'beacons.ai',
  'carrd.co',
  'wixsite.com',
  'wordpress.com',
  'blogspot.com',
];

/**
 * Normaliza número de telefone para formato internacional brasileiro (+55)
 */
export function normalizePhoneBR(phone: string): string {
  if (!phone) return '';
  
  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, '');
  
  // Se já começa com 55, retorna como está
  if (digits.startsWith('55')) {
    return `+${digits}`;
  }
  
  // Se tem 10 ou 11 dígitos (DDD + número), adiciona 55
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  
  // Se tem 8 ou 9 dígitos (sem DDD), assume DDD 11 (SP) como fallback
  if (digits.length === 8 || digits.length === 9) {
    return `+5511${digits}`;
  }
  
  // Retorna com + se não tiver
  return digits.startsWith('+') ? digits : `+${digits}`;
}

/**
 * Verifica se um website é próprio (domínio próprio) ou rede social/genérico
 */
export function classifyWebsite(website?: string): 'own' | 'social' | 'none' {
  if (!website || website.trim() === '') return 'none';
  
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    const hostname = url.hostname.replace('www.', '').toLowerCase();
    
    // Verifica se é domínio de rede social conhecido
    const isSocial = SOCIAL_DOMAINS.some(domain => hostname.includes(domain));
    if (isSocial) return 'social';
    
    // Se chegou aqui, assume que é domínio próprio
    return 'own';
  } catch {
    return 'none';
  }
}

/**
 * Filtra apenas empresas SEM website próprio (mantém as sem site ou só com redes sociais)
 */
export function filterWithoutOwnWebsite(places: PlaceResult[]): PlaceResult[] {
  return places.filter(place => {
    const websiteType = classifyWebsite(place.website);
    return websiteType !== 'own';
  });
}

/**
 * Busca empresas locais via SerpApi Google Maps
 * 
 * @param params - Parâmetros de busca (nicho, cidade, estado)
 * @returns Lista de empresas enriquecidas e filtradas
 */
export async function searchLocalBusinesses(
  params: PlaceSearchParams
): Promise<EnrichedPlace[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  
  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY não configurada. Configure no .env');
  }

  const { niche, city, state, country = 'Brazil' } = params;
  
  // Constrói a query de busca otimizada
  const query = `${niche} ${city} ${state} ${country}`;
  
  // Parâmetros para SerpApi Google Maps
  const searchParams = new URLSearchParams({
    engine: 'google_maps',
    q: query,
    type: 'search',
    hl: 'pt',
    gl: 'br',
    api_key: apiKey,
  });

  const url = `https://serpapi.com/search.json?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'B2B-Prospect-Dashboard/1.0 (contato@seudominio.com)',
        'Accept': 'application/json',
      },
      // Cache de 1 hora para evitar rate limits
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SerpApi erro ${response.status}: ${errorText}`);
    }

    const data: SearchResponse = await response.json();
    
    // Combina local_results e ads
    const allResults = [
      ...(data.local_results || []),
      ...(data.ads || []),
    ];

    // Filtra apenas empresas sem website próprio
    const filtered = filterWithoutOwnWebsite(allResults);

    // Enriquece e normaliza os dados
    return filtered.map(place => enrichPlace(place, niche, city, state));
    
  } catch (error) {
    console.error('Erro na busca SerpApi:', error);
    throw error;
  }
}

/**
 * Enriquece um resultado bruto do SerpApi com dados normalizados
 */
function enrichPlace(
  place: PlaceResult,
  niche: string,
  city: string,
  state: string
): EnrichedPlace {
  const websiteType = classifyWebsite(place.website);
  const phone = place.phone || '';
  
  return {
    place_id: place.place_id || place.data_id || place.data_cid || `serp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    company_name: place.title,
    trade_name: place.title,
    formatted_address: place.address,
    phone_number: normalizePhoneBR(phone),
    phone_type: detectPhoneType(phone),
    website: place.website,
    has_website: websiteType !== 'none',
    website_type: websiteType,
    gps_coordinates: place.gps_coordinates,
    rating: place.rating,
    reviews_count: place.reviews,
    category: place.type || place.types?.[0],
    niche,
    city,
    state,
    country_code: 'BR',
  };
}

/**
 * Detecta tipo de telefone baseado no formato
 */
function detectPhoneType(phone: string): 'mobile' | 'landline' | 'whatsapp' {
  if (!phone) return 'landline';
  
  const digits = phone.replace(/\D/g, '');
  
  // Celular brasileiro: 11 dígitos com 9 no início (após DDD)
  // Ex: 5511999999999 -> 11 99999-9999
  if (digits.length === 13 && digits.startsWith('55')) {
    const afterDDD = digits.substring(4);
    if (afterDDD.length === 9 && afterDDD.startsWith('9')) {
      return 'mobile';
    }
  }
  
  // Se contém "whatsapp" ou "zap" no texto original
  if (phone.toLowerCase().includes('whatsapp') || phone.toLowerCase().includes('zap')) {
    return 'whatsapp';
  }
  
  return 'landline';
}

/**
 * Busca detalhes de um lugar específico pelo place_id
 * Útil para obter informações completas de um resultado específico
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  const apiKey = process.env.SERPAPI_API_KEY;
  
  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY não configurada');
  }

  const params = new URLSearchParams({
    engine: 'google_maps',
    type: 'place',
    place_id: placeId,
    hl: 'pt',
    gl: 'br',
    api_key: apiKey,
  });

  const url = `https://serpapi.com/search.json?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'B2B-Prospect-Dashboard/1.0',
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return null;

    const data: SearchResponse = await response.json();
    return data.local_results?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Busca paginada para obter mais resultados
 */
export async function searchLocalBusinessesPaginated(
  params: PlaceSearchParams,
  maxPages: number = 3
): Promise<EnrichedPlace[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  
  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY não configurada');
  }

  const { niche, city, state, country = 'Brazil' } = params;
  const query = `${niche} ${city} ${state} ${country}`;
  
  let allResults: PlaceResult[] = [];
  let nextPageToken: string | undefined;
  let pagesFetched = 0;

  while (pagesFetched < maxPages) {
    const searchParams = new URLSearchParams({
      engine: 'google_maps',
      q: query,
      type: 'search',
      hl: 'pt',
      gl: 'br',
      api_key: apiKey,
    });

    if (nextPageToken) {
      searchParams.set('page_token', nextPageToken);
    }

    const url = `https://serpapi.com/search.json?${searchParams.toString()}`;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'B2B-Prospect-Dashboard/1.0' },
        next: { revalidate: 3600 },
      });

      if (!response.ok) break;

      const data: SearchResponse = await response.json();
      
      const pageResults = [
        ...(data.local_results || []),
        ...(data.ads || []),
      ];

      allResults = allResults.concat(pageResults);

      // Verifica se há próxima página
      if (data.serpapi_pagination?.next_page_token) {
        nextPageToken = data.serpapi_pagination.next_page_token;
        pagesFetched++;
        
        // Pequena pausa para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        break;
      }
    } catch (error) {
      console.error(`Erro na página ${pagesFetched + 1}:`, error);
      break;
    }
  }

  // Filtra e enriquece todos os resultados
  const filtered = filterWithoutOwnWebsite(allResults);
  return filtered.map(place => enrichPlace(place, niche, city, state));
}