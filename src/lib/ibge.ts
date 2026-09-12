/**
 * Helper para API de Localidades do IBGE
 * 
 * Documentação oficial: https://servicodados.ibge.gov.br/api/docs/localidades
 * Base URL: https://servicodados.ibge.gov.br/api/v1/localidades
 * 
 * Endpoints usados:
 * - GET /estados - Lista todas as UFs
 * - GET /estados/{UF}/municipios - Lista municípios de uma UF
 */

const IBGE_BASE_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades';

export interface IBGEState {
  id: number;
  sigla: string;
  nome: string;
  regiao: {
    id: number;
    sigla: string;
    nome: string;
  };
}

export interface IBGECity {
  id: number;
  nome: string;
  microrregiao: {
    id: number;
    nome: string;
    mesorregiao: {
      id: number;
      nome: string;
      UF: IBGEState;
    };
  };
}

export interface SimpleState {
  id: number;
  sigla: string;
  nome: string;
  regiao: string;
}

export interface SimpleCity {
  id: number;
  nome: string;
  uf: string;
}

/**
 * Headers padrão para requisições IBGE
 */
const defaultHeaders = {
  'User-Agent': 'B2B-Prospect-Dashboard/1.0 (contato@seudominio.com)',
  'Accept': 'application/json',
};

/**
 * Busca todos os estados brasileiros (UFs)
 * 
 * @returns Lista de estados ordenada alfabeticamente por nome
 * @example
 * const states = await getStates();
 * // [{ id: 35, sigla: 'SP', nome: 'São Paulo', regiao: 'Sudeste' }, ...]
 */
export async function getStates(): Promise<SimpleState[]> {
  try {
    const response = await fetch(`${IBGE_BASE_URL}/estados?orderBy=nome`, {
      headers: defaultHeaders,
      // Cache de 7 dias (dados mudam raramente)
      next: { revalidate: 604800 },
    });

    if (!response.ok) {
      throw new Error(`IBGE API erro ${response.status}: ${response.statusText}`);
    }

    const data: IBGEState[] = await response.json();

    // Mapeia para formato simplificado
    return data.map(state => ({
      id: state.id,
      sigla: state.sigla,
      nome: state.nome,
      regiao: state.regiao.nome,
    }));
  } catch (error) {
    console.error('Erro ao buscar estados IBGE:', error);
    // Retorna lista estática como fallback
    return getFallbackStates();
  }
}

/**
 * Busca municípios de uma UF específica
 * 
 * @param uf - Sigla do estado (ex: 'SP', 'RJ', 'MG')
 * @returns Lista de municípios ordenada alfabeticamente por nome
 * @example
 * const cities = await getCitiesByState('SP');
 * // [{ id: 3550308, nome: 'São Paulo', uf: 'SP' }, ...]
 */
export async function getCitiesByState(uf: string): Promise<SimpleCity[]> {
  const ufUpper = uf.toUpperCase();
  
  // Validação básica de UF
  if (!/^[A-Z]{2}$/.test(ufUpper)) {
    throw new Error(`UF inválida: ${uf}. Use sigla de 2 letras (ex: SP, RJ)`);
  }

  try {
    const response = await fetch(`${IBGE_BASE_URL}/estados/${ufUpper}/municipios?orderBy=nome`, {
      headers: defaultHeaders,
      next: { revalidate: 604800 },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`UF não encontrada: ${ufUpper}`);
      }
      throw new Error(`IBGE API erro ${response.status}: ${response.statusText}`);
    }

    const data: IBGECity[] = await response.json();

    return data.map(city => ({
      id: city.id,
      nome: city.nome,
      uf: city.microrregiao.mesorregiao.UF.sigla,
    }));
  } catch (error) {
    console.error(`Erro ao buscar municípios para ${ufUpper}:`, error);
    return [];
  }
}

/**
 * Busca um estado específico por sigla
 */
export async function getStateByUF(uf: string): Promise<SimpleState | null> {
  const states = await getStates();
  return states.find(s => s.sigla === uf.toUpperCase()) || null;
}

/**
 * Busca um município específico por ID
 */
export async function getCityById(id: number): Promise<SimpleCity | null> {
  try {
    const response = await fetch(`${IBGE_BASE_URL}/municipios/${id}`, {
      headers: defaultHeaders,
      next: { revalidate: 604800 },
    });

    if (!response.ok) return null;

    const data: IBGECity = await response.json();
    return {
      id: data.id,
      nome: data.nome,
      uf: data.microrregiao.mesorregiao.UF.sigla,
    };
  } catch {
    return null;
  }
}

/**
 * Busca municípios por nome (busca parcial)
 * Útil para autocomplete no frontend
 */
export async function searchCitiesByName(query: string, uf?: string): Promise<SimpleCity[]> {
  const searchTerm = query.toLowerCase().trim();
  if (searchTerm.length < 2) return [];

  let cities: SimpleCity[];

  if (uf) {
    cities = await getCitiesByState(uf);
  } else {
    // Busca em todos os estados (mais lento)
    const states = await getStates();
    const allCities: SimpleCity[] = [];
    
    for (const state of states) {
      const stateCities = await getCitiesByState(state.sigla);
      allCities.push(...stateCities);
    }
    cities = allCities;
  }

  return cities
    .filter(city => city.nome.toLowerCase().includes(searchTerm))
    .slice(0, 20); // Limita a 20 resultados
}

/**
 * Retorna apenas siglas das UFs para uso em selects simples
 */
export async function getStateOptions(): Promise<Array<{ value: string; label: string }>> {
  const states = await getStates();
  return states.map(s => ({
    value: s.sigla,
    label: `${s.nome} (${s.sigla})`,
  }));
}

/**
 * Retorna opções de cidades para um select
 */
export async function getCityOptions(uf: string): Promise<Array<{ value: string; label: string }>> {
  const cities = await getCitiesByState(uf);
  return cities.map(c => ({
    value: c.nome,
    label: c.nome,
  }));
}

/**
 * Fallback estático de estados caso a API falhe
 */
function getFallbackStates(): SimpleState[] {
  return [
    { id: 11, sigla: 'RO', nome: 'Rondônia', regiao: 'Norte' },
    { id: 12, sigla: 'AC', nome: 'Acre', regiao: 'Norte' },
    { id: 13, sigla: 'AM', nome: 'Amazonas', regiao: 'Norte' },
    { id: 14, sigla: 'RR', nome: 'Roraima', regiao: 'Norte' },
    { id: 15, sigla: 'PA', nome: 'Pará', regiao: 'Norte' },
    { id: 16, sigla: 'AP', nome: 'Amapá', regiao: 'Norte' },
    { id: 17, sigla: 'TO', nome: 'Tocantins', regiao: 'Norte' },
    { id: 21, sigla: 'MA', nome: 'Maranhão', regiao: 'Nordeste' },
    { id: 22, sigla: 'PI', nome: 'Piauí', regiao: 'Nordeste' },
    { id: 23, sigla: 'CE', nome: 'Ceará', regiao: 'Nordeste' },
    { id: 24, sigla: 'RN', nome: 'Rio Grande do Norte', regiao: 'Nordeste' },
    { id: 25, sigla: 'PB', nome: 'Paraíba', regiao: 'Nordeste' },
    { id: 26, sigla: 'PE', nome: 'Pernambuco', regiao: 'Nordeste' },
    { id: 27, sigla: 'AL', nome: 'Alagoas', regiao: 'Nordeste' },
    { id: 28, sigla: 'SE', nome: 'Sergipe', regiao: 'Nordeste' },
    { id: 29, sigla: 'BA', nome: 'Bahia', regiao: 'Nordeste' },
    { id: 31, sigla: 'MG', nome: 'Minas Gerais', regiao: 'Sudeste' },
    { id: 32, sigla: 'ES', nome: 'Espírito Santo', regiao: 'Sudeste' },
    { id: 33, sigla: 'RJ', nome: 'Rio de Janeiro', regiao: 'Sudeste' },
    { id: 35, sigla: 'SP', nome: 'São Paulo', regiao: 'Sudeste' },
    { id: 41, sigla: 'PR', nome: 'Paraná', regiao: 'Sul' },
    { id: 42, sigla: 'SC', nome: 'Santa Catarina', regiao: 'Sul' },
    { id: 43, sigla: 'RS', nome: 'Rio Grande do Sul', regiao: 'Sul' },
    { id: 50, sigla: 'MS', nome: 'Mato Grosso do Sul', regiao: 'Centro-Oeste' },
    { id: 51, sigla: 'MT', nome: 'Mato Grosso', regiao: 'Centro-Oeste' },
    { id: 52, sigla: 'GO', nome: 'Goiás', regiao: 'Centro-Oeste' },
    { id: 53, sigla: 'DF', nome: 'Distrito Federal', regiao: 'Centro-Oeste' },
  ];
}

/**
 * Cache em memória para evitar requisições repetidas na mesma execução
 */
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hora

function getFromCache<T>(key: string): T | null {
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: any): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Versão com cache em memória para getStates
 */
export async function getStatesCached(): Promise<SimpleState[]> {
  const cached = getFromCache<SimpleState[]>('ibge:states');
  if (cached) return cached;

  const states = await getStates();
  setCache('ibge:states', states);
  return states;
}

/**
 * Versão com cache em memória para getCitiesByState
 */
export async function getCitiesByStateCached(uf: string): Promise<SimpleCity[]> {
  const key = `ibge:cities:${uf.toUpperCase()}`;
  const cached = getFromCache<SimpleCity[]>(key);
  if (cached) return cached;

  const cities = await getCitiesByState(uf);
  setCache(key, cities);
  return cities;
}