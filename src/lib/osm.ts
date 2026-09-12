/**
 * Busca gratuita e ilimitada via OpenStreetMap (Overpass API)
 * Sem chave, sem rate limit, dados abertos
 * Docs: https://wiki.openstreetmap.org/wiki/Overpass_API
 */

export interface OSMSearchParams {
  niche: string;
  city: string;
  state: string;
  country?: string; // default 'Brazil'
}

export interface OSMPlace {
  place_id: string;
  company_name: string;
  trade_name?: string;
  formatted_address?: string;
  phone_number?: string;
  website?: string;
  gps_coordinates?: { latitude: number; longitude: number };
  niche?: string;
  city: string;
  state: string;
  country_code: string;
  tags: Record<string, string>;
}

// Mapeamento de nichos para tags OSM
export const NICHE_TO_OSM_TAGS: Record<string, string[]> = {
  'oficina': ['shop=car_repair', 'craft=mechanic'],
  'mecânica': ['shop=car_repair', 'craft=mechanic'],
  'auto': ['shop=car_repair', 'shop=car_parts'],
  'restaurante': ['amenity=restaurant'],
  'lanchonete': ['amenity=fast_food', 'amenity=cafe'],
  'café': ['amenity=cafe'],
  'bar': ['amenity=bar', 'amenity=pub'],
  'padaria': ['shop=bakery'],
  'supermercado': ['shop=supermarket', 'shop=convenience'],
  'mercado': ['shop=supermarket', 'shop=convenience'],
  'farmácia': ['amenity=pharmacy'],
  'drogaria': ['amenity=pharmacy'],
  'clínica': ['amenity=clinic', 'amenity=doctors'],
  'hospital': ['amenity=hospital'],
  'dentista': ['amenity=dentist'],
  'veterinário': ['amenity=veterinary'],
  'pet shop': ['shop=pet'],
  'academia': ['leisure=fitness_centre', 'sport=fitness'],
  'salão': ['shop=hairdresser', 'shop=beauty'],
  'barbearia': ['shop=barber'],
  'escola': ['amenity=school'],
  'creche': ['amenity=kindergarten'],
  'faculdade': ['amenity=university'],
  'curso': ['amenity=college'],
  'hotel': ['tourism=hotel'],
  'pousada': ['tourism=guest_house'],
  'hostel': ['tourism=hostel'],
  'imobiliária': ['office=real_estate'],
  'advogado': ['office=lawyer'],
  'contador': ['office=accountant'],
  'escritório': ['office=company'],
  'consultoria': ['office=consulting'],
  'marketing': ['office=marketing'],
  'ti': ['office=it'],
  'informática': ['shop=computer', 'office=it'],
  'celular': ['shop=mobile_phone'],
  'eletrônicos': ['shop=electronics'],
  'móveis': ['shop=furniture'],
  'decoração': ['shop=interior_decoration'],
  'construção': ['shop=building_materials', 'craft=construction'],
  'pintura': ['craft=painter'],
  'eletricista': ['craft=electrician'],
  'encanador': ['craft=plumber'],
  'chaveiro': ['craft=locksmith'],
  'lavanderia': ['shop=laundry', 'amenity=laundry'],
  'costureira': ['craft=tailor'],
  'gráfica': ['shop=printing'],
  'copiadora': ['shop=copyshop'],
  'foto': ['shop=photo'],
  'ótica': ['shop=optician'],
  'joalheria': ['shop=jewelry'],
  'relojoaria': ['shop=watch'],
  'floricultura': ['shop=florist'],
  'presente': ['shop=gift'],
  'brinquedo': ['shop=toys'],
  'livraria': ['shop=books'],
  'papelaria': ['shop=stationery'],
  'artigos esportivos': ['shop=sports'],
  'esportes': ['shop=sports'],
  'tenis': ['shop=sports'],
  'tênis': ['shop=sports'],
  'pizzaria': ['cuisine=pizza'],
  'bicicletaria': ['shop=bicycle', 'craft=bicycle'],
  'moto': ['shop=motorcycle'],
  'pneus': ['shop=tyres'],
  'posto': ['amenity=fuel'],
  'borracharia': ['shop=tyres'],
  'lava jato': ['shop=car_wash'],
  'estacionamento': ['amenity=parking'],
  'transporte': ['office=transport'],
  'logística': ['office=logistics'],
  'segurança': ['office=security'],
  'limpeza': ['office=cleaning'],
  'jardinagem': ['craft=gardener'],
  'paisagismo': ['craft=landscaper'],
  'piscina': ['craft=pool_construction'],
  'ar condicionado': ['craft=hvac'],
  'refrigeração': ['craft=refrigeration'],
  'soldas': ['craft=welder'],
  'serralheria': ['craft=blacksmith', 'shop=metal_construction'],
  'marcenaria': ['craft=carpenter', 'shop=carpentry'],
  'vidraçaria': ['craft=glazier'],
  'alumínio': ['shop=aluminium'],
  'esquadrias': ['shop=window'],
  'toldos': ['shop=awning'],
  'coberturas': ['shop=roofing'],
  'impermeabilização': ['craft=waterproofing'],
  'isolamento': ['craft=insulation'],
  'drywall': ['craft=drywall'],
  'gesso': ['craft=plasterer'],
  'piso': ['shop=flooring'],
  'azulejo': ['shop=tiles'],
  'pedra': ['shop=stone'],
  'mármore': ['shop=marble'],
  'granito': ['shop=granite'],
};

/** Remove acentos/diacríticos para comparar "farmacia" == "farmácia" */
export function unaccent(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeNiche(niche: string): string[] {
  const normalized = niche.toLowerCase().trim();
  const flat = unaccent(normalized);

  // 1. Match direto
  const direct = NICHE_TO_OSM_TAGS[normalized] || NICHE_TO_OSM_TAGS[flat];
  if (direct) return direct;

  // 2. Match por chave normalizada (comparando sem acento)
  for (const [key, value] of Object.entries(NICHE_TO_OSM_TAGS)) {
    if (unaccent(key.toLowerCase()) === flat) return value;
  }

  // 3. Busca parcial (sem acento nos dois lados)
  for (const [key, value] of Object.entries(NICHE_TO_OSM_TAGS)) {
    const flatKey = unaccent(key);
    if (flat.includes(flatKey) || flatKey.includes(flat)) {
      return value;
    }
  }
  // Fallback genérico
  return [`amenity~"${flat}"`, `shop~"${flat}"`, `craft~"${flat}"`];
}

// Tags RELACIONADAS que ampliam a busca (retornam mais resultados) mas NÃO
// são qualificação exata. Ex: buscando "barbearia", a tag hairdresser traz
// salões de beleza (relacionados), mas estes só são qualificados se o nome
// confirmar que é barbearia de fato.
// Formato: chave = nicho, valor = tags extras para a busca
const RELATED_NICHE_TAGS: Record<string, string[]> = {
  'barbearia': ['shop=hairdresser'],
  'salão': ['shop=hairdresser'],
  'veterinário': ['shop=pet'],
  'pet shop': ['amenity=veterinary'],
  'restaurante': ['amenity=fast_food', 'amenity=cafe', 'cuisine=pizza', 'cuisine=hamburger'],
  'pizzaria': ['amenity=restaurant', 'cuisine=hamburger'],
  'lanchonete': ['amenity=restaurant'],
  'padaria': ['shop=confectionery'],
  'academia': ['leisure=sports_centre'],
  'clínica': ['amenity=doctors'],
  'drogaria': ['shop=cosmetics'],
  'celular': ['shop=electronics'],
};

/**
 * Retorna as tags de busca (exatas + relacionadas) para um nicho.
 * Usado na query Overpass para ampliar resultados.
 */
export function normalizeNicheWithRelated(niche: string): string[] {
  const normalized = niche.toLowerCase().trim();
  const flat = unaccent(normalized);
  const base = normalizeNiche(niche).slice();
  // Relacionadas: tenta a forma com acento e sem acento
  const related = RELATED_NICHE_TAGS[normalized] || RELATED_NICHE_TAGS[flat];
  if (related) base.push(...related);
  // Chaves do dicionário com acento: compara normalizado
  for (const [key, vals] of Object.entries(RELATED_NICHE_TAGS)) {
    if (key !== normalized && unaccent(key) === flat) base.push(...vals);
  }
  return base;
}

function buildOverpassQuery(params: OSMSearchParams): string {
  const { niche, city, state, country = 'Brazil' } = params;
  const tags = normalizeNicheWithRelated(niche);

  // Busca por bbox ao invés de area (mais rápido e confiável)
  let bboxFilter: string;
  if (city && city.trim()) {
    // Bbox da cidade (predefinido para cidades grandes, senão usa estado)
    const cityBbox = CITY_BBOXES[city.toLowerCase()];
    if (cityBbox) {
      bboxFilter = `(${cityBbox.south},${cityBbox.west},${cityBbox.north},${cityBbox.east});`;
    } else {
      // Fallback: usa bbox do estado
      const stateBbox = STATE_BBOXES[state] || STATE_BBOXES['SP'];
      bboxFilter = `(${stateBbox.south},${stateBbox.west},${stateBbox.north},${stateBbox.east});`;
    }
  } else {
    // Busca por estado inteiro
    const stateBbox = STATE_BBOXES[state] || STATE_BBOXES['SP'];
    bboxFilter = `(${stateBbox.south},${stateBbox.west},${stateBbox.north},${stateBbox.east});`;
  }

  // Constrói condições de tag para Overpass.
  // SEMÂNTICA OR: cada tag esperada vira uma declaração própria no union,
  // pois um estabelecimento pode ter apenas UMA das tags (ex: shop=car_repair
  // OU craft=mechanic). Usar AND retornaria sempre vazio.
  const unionBody = tags.flatMap(tag => [
    `node[${tag}]${bboxFilter}`,
    `way[${tag}]${bboxFilter}`,
  ]).join(`
      `);

  // Query Overpass QL com bbox (muito mais rápido que area)
  // ATENCAO: bboxFilter ja termina com ';' - nao adicionar outro
  return `
    [out:json][timeout:25];
    (
      ${unionBody}
    );
    out center tags;
  `.trim();
}

// Bounding boxes de cidades brasileiras principais
const CITY_BBOXES: Record<string, { south: number; west: number; north: number; east: number }> = {
  'são paulo': { south: -23.75, west: -46.85, north: -23.30, east: -46.30 },
  'sao paulo': { south: -23.75, west: -46.85, north: -23.30, east: -46.30 },
  'rio de janeiro': { south: -23.10, west: -43.80, north: -22.75, east: -43.10 },
  'belo horizonte': { south: -20.05, west: -44.05, north: -19.75, east: -43.70 },
  'brasília': { south: -16.05, west: -48.30, north: -15.50, east: -47.30 },
  'brasilia': { south: -16.05, west: -48.30, north: -15.50, east: -47.30 },
  'salvador': { south: -13.05, west: -38.55, north: -12.80, east: -38.25 },
  'fortaleza': { south: -3.85, west: -38.65, north: -3.70, east: -38.45 },
  'curitiba': { south: -25.65, west: -49.40, north: -25.30, east: -49.15 },
  'recife': { south: -8.15, west: -35.05, north: -7.90, east: -34.80 },
  'porto alegre': { south: -30.15, west: -51.25, north: -29.90, east: -51.05 },
  'manaus': { south: -3.20, west: -60.10, north: -2.95, east: -59.85 },
  'belém': { south: -1.55, west: -48.60, north: -1.35, east: -48.35 },
  'belem': { south: -1.55, west: -48.60, north: -1.35, east: -48.35 },
  'goiânia': { south: -16.80, west: -49.40, north: -16.60, east: -49.15 },
  'goiania': { south: -16.80, west: -49.40, north: -16.60, east: -49.15 },
  'campinas': { south: -22.90, west: -47.20, north: -22.70, east: -47.00 },
  'guarulhos': { south: -23.50, west: -46.60, north: -23.35, east: -46.40 },
  'são bernardo do campo': { south: -23.80, west: -46.65, north: -23.65, east: -46.45 },
  'santo andré': { south: -23.70, west: -46.60, north: -23.55, east: -46.40 },
  'osasco': { south: -23.55, west: -46.80, north: -23.45, east: -46.70 },
  'sorocaba': { south: -23.55, west: -47.55, north: -23.40, east: -47.35 },
  'ribeirão preto': { south: -21.25, west: -47.85, north: -21.10, east: -47.70 },
  'uberlândia': { south: -18.95, west: -48.35, north: -18.80, east: -48.15 },
  'contagem': { south: -19.95, west: -44.10, north: -19.85, east: -43.95 },
  'juiz de fora': { south: -21.80, west: -43.45, north: -21.65, east: -43.25 },
  'niterói': { south: -22.95, west: -43.15, north: -22.85, east: -43.05 },
  'joão Pessoa': { south: -7.20, west: -34.90, north: -7.05, east: -34.75 },
  'vila velha': { south: -20.40, west: -40.35, north: -20.25, east: -40.20 },
  'feira de Santana': { south: -12.30, west: -39.00, north: -12.15, east: -38.85 },
  'camaçari': { south: -12.75, west: -38.40, north: -12.55, east: -38.20 },
  'mossoró': { south: -5.25, west: -37.40, north: -5.10, east: -37.25 },
  'mossoro': { south: -5.25, west: -37.40, north: -5.10, east: -37.25 },
};

// Bounding boxes dos estados brasileiros
const STATE_BBOXES: Record<string, { south: number; west: number; north: number; east: number }> = {
  'AC': { south: -8.00, west: -74.00, north: 0.00, east: -66.50 },
  'AL': { south: -10.50, west: -37.50, north: -8.80, east: -35.00 },
  'AM': { south: -9.80, west: -73.80, north: 2.20, east: -56.00 },
  'AP': { south: -1.00, west: -51.00, north: 4.40, east: -49.50 },
  'BA': { south: -18.50, west: -46.50, north: -7.30, east: -37.30 },
  'CE': { south: -7.90, west: -41.50, north: -2.80, east: -37.50 },
  'DF': { south: -16.05, west: -48.30, north: -15.50, east: -47.30 },
  'ES': { south: -21.30, west: -41.90, north: -18.10, east: -39.60 },
  'GO': { south: -19.50, west: -53.50, north: -12.40, east: -45.50 },
  'MA': { south: -10.50, west: -48.50, north: -1.00, east: -44.00 },
  'MG': { south: -22.90, west: -51.10, north: -14.20, east: -39.90 },
  'MS': { south: -24.10, west: -58.00, north: -17.20, east: -50.50 },
  'MT': { south: -18.00, west: -61.50, north: -7.80, east: -50.00 },
  'PA': { south: -9.80, west: -58.50, north: 1.50, east: -46.00 },
  'PB': { south: -8.30, west: -38.80, north: -6.00, east: -34.70 },
  'PE': { south: -9.50, west: -41.00, north: -7.30, east: -34.50 },
  'PI': { south: -9.50, west: -45.50, north: -2.70, east: -40.50 },
  'PR': { south: -26.00, west: -54.60, north: -22.50, east: -48.00 },
  'RJ': { south: -23.40, west: -44.90, north: -20.70, east: -40.90 },
  'RN': { south: -6.90, west: -38.60, north: -4.80, east: -34.80 },
  'RO': { south: -13.70, west: -66.60, north: -7.90, east: -57.50 },
  'RR': { south: -5.30, west: -64.80, north: 1.30, east: -58.90 },
  'RS': { south: -33.75, west: -57.60, north: -27.50, east: -49.50 },
  'SC': { south: -29.40, west: -53.80, north: -25.90, east: -48.50 },
  'SE': { south: -11.60, west: -38.20, north: -9.50, east: -36.40 },
  'SP': { south: -25.30, west: -53.10, north: -19.70, east: -44.00 },
  'TO': { south: -13.50, west: -50.50, north: -5.20, east: -45.50 },
};

function parseOSMElement(el: any, city: string, state: string): OSMPlace | null {
  const tags = el.tags || {};
  const name = tags.name || tags['name:pt'] || tags['official_name'];
  if (!name) return null;

  const phone = tags.phone || tags['contact:phone'] || tags['phone:mobile'] || tags['mobile'];
  const website = tags.website || tags['contact:website'] || tags.url;

  let lat = el.lat;
  let lon = el.lon;
  if ((!lat || !lon) && el.center) {
    lat = el.center.lat;
    lon = el.center.lon;
  }

  const addressParts = [
    tags['addr:street'],
    tags['addr:housenumber'],
    tags['addr:neighbourhood'],
    tags['addr:suburb'],
    tags['addr:city'],
    tags['addr:state'],
    tags['addr:postcode'],
  ].filter(Boolean);

  // Cidade real: usa addr:city quando presente, senão o filtro da busca
  const realCity = tags['addr:city'] || tags['addr:suburb'] || city || '';
  const realState = tags['addr:state'] || state || '';

  return {
    place_id: `osm_${el.type}_${el.id}`,
    company_name: name,
    trade_name: tags['brand'] || tags['operator'] || name,
    formatted_address: addressParts.join(', ') || undefined,
    phone_number: phone,
    website,
    gps_coordinates: (lat && lon) ? { latitude: lat, longitude: lon } : undefined,
    niche: tags.shop || tags.amenity || tags.craft || tags.office || tags.tourism,
    city: realCity,
    state: realState,
    country_code: 'BR',
    tags,
  };
}

// Mirrors públicos e gratuitos do Overpass API.
// Se um estiver sobrecarregado (rate limit 429), o sistema tenta o próximo automaticamente.
// Todos servem os MESMOS dados do OpenStreetMap (fonte aberta, gratuita, sem limite).
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

export async function searchOSM(params: OSMSearchParams): Promise<OSMPlace[]> {
  const query = buildOverpassQuery(params);
  let lastError: Error | null = null;

  // Tenta cada mirror até conseguir resposta válida (retry automático em 429/timeouts)
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const response = await fetch(mirror, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'B2B-Prospect-Dashboard/1.0 (contato@seudominio.com)',
        },
        body: `data=${encodeURIComponent(query)}`,
        // Cache por 1 hora (dados OSM mudam pouco)
        next: { revalidate: 3600 },
      });

      if (response.status === 429) {
        console.warn(`[osm] Mirror ${mirror} retornou 429 (rate limit), tentando próximo...`);
        lastError = new Error(`Overpass 429 em ${mirror}`);
        continue;
      }

      if (!response.ok) {
        lastError = new Error(`Overpass API erro ${response.status} em ${mirror}`);
        console.warn(`[osm] Mirror ${mirror} falhou (${response.status}), tentando próximo...`);
        continue;
      }

      const data: { elements?: any[]; error?: string; remark?: string } = await response.json();

      if (data.error) {
        lastError = new Error(`Overpass erro: ${data.error}`);
        console.warn(`[osm] Mirror ${mirror} retornou erro, tentando próximo...`);
        continue;
      }

      const places = (data.elements || [])
        .map((el: any) => parseOSMElement(el, params.city, params.state))
        .filter((p: OSMPlace | null): p is OSMPlace => p !== null);

      // Remove duplicatas por nome + endereço
      const seen = new Set<string>();
      const unique = places.filter((p: OSMPlace) => {
        const key = `${p.company_name}|${p.formatted_address || p.gps_coordinates?.latitude}|${p.gps_coordinates?.longitude}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      console.log(`[osm] Mirror ${mirror} OK: ${unique.length} empresas`);
      return unique;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[osm] Mirror ${mirror} falhou (exceção), tentando próximo...`);
    }
  }

  throw lastError || new Error('Todos os mirrors Overpass falharam');
}

/**
 * Busca paginada para grandes resultados
 */
export async function searchOSMPaginated(
  params: OSMSearchParams,
  maxResults: number = 500
): Promise<OSMPlace[]> {
  // Overpass não tem paginação nativa, mas podemos dividir por bounding box
  // Para simplicidade, usamos limite no timeout e confiamos no filtro
  const places = await searchOSM(params);
  return places.slice(0, maxResults);
}