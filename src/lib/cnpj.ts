/**
 * Enriquecimento de CNPJ via BrasilAPI e MinhaReceita (fallback)
 * 
 * Documentação BrasilAPI: https://brasilapi.com.br/docs#tag/CNPJ
 * Documentação MinhaReceita: https://docs.minhareceita.org/como-usar/
 * 
 * IMPORTANTE: A BrasilAPI exige User-Agent descritivo para evitar 429/403
 * Ex: 'B2B-Prospect-Dashboard/1.0 (contato@seudominio.com)'
 */

// Tipos para BrasilAPI
export interface BrasilAPICNPJResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: number;
  descricao_situacao_cadastral: string;
  data_situacao_cadastral: string;
  porte: string;
  descricao_porte: string;
  natureza_juridica: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  uf: string;
  municipio: string;
  ddd_telefone_1: string;
  ddd_telefone_2: string;
  ddd_fax: string;
  email: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  cnaes_secundarios: Array<{
    codigo: number;
    descricao: string;
  }>;
  qsa: Array<{
    nome_socio: string;
    cnpj_cpf_do_socio: string;
    qualificacao_socio: string;
    codigo_qualificacao_socio: number;
    data_entrada_sociedade: string;
    pais: string | null;
    codigo_pais: number | null;
    faixa_etaria: string;
    codigo_faixa_etaria: number;
    identificador_de_socio: number;
    cpf_representante_legal: string | null;
    nome_representante_legal: string | null;
    codigo_qualificacao_representante_legal: number;
    qualificacao_representante_legal: string | null;
  }>;
  capital_social: number;
  identificador_matriz_filial: number;
  descricao_identificador_matriz_filial: string;
  data_inicio_atividade: string;
  situacao_especial: string;
  data_situacao_especial: string;
}

// Tipos para MinhaReceita (estrutura similar mas campos em camelCase)
export interface MinhaReceitaCNPJResponse {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacaoCadastral: number;
  descricaoSituacaoCadastral: string;
  dataSituacaoCadastral: string;
  porte: string;
  descricaoPorte: string;
  naturezaJuridica: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  uf: string;
  municipio: string;
  dddTelefone1: string;
  dddTelefone2: string;
  dddFax: string;
  email: string;
  cnaeFiscal: number;
  cnaeFiscalDescricao: string;
  cnaesSecundarios: Array<{
    codigo: number;
    descricao: string;
  }>;
  socios: Array<{
    nome: string;
    cpfCnpj: string;
    qualificacao: string;
    codigoQualificacao: number;
    dataEntradaSociedade: string;
    faixaEtaria: string;
    codigoFaixaEtaria: number;
  }>;
  capitalSocial: number;
  tipoUnidade: string;
  dataInicioAtividade: string;
}

// Tipo unificado para saída
export interface CNPJEnrichedData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  telefone: string;
  email: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cep: string;
    cidade: string;
    uf: string;
  };
  cnae_fiscal: string;
  socios: Array<{
    nome: string;
    qualificacao: string;
    is_admin: boolean; // true se sócio-administrador/presidente
  }>;
  decision_maker_name: string | null; // Nome do sócio administrador principal
  source: 'brasilapi' | 'minhareceita' | null;
}

/**
 * Mapeamento de qualificações de sócio que indicam poder de decisão
 */
const ADMIN_QUALIFICATIONS = [
  'administrador',
  'presidente',
  'diretor',
  'socio administrador',
  'sócio administrador',
  'gerente',
  'representante legal',
  'titular',
  'socio titular',
  'sócio titular',
];

/**
 * Normaliza CNPJ para 14 dígitos apenas números
 */
export function normalizeCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '').padStart(14, '0');
}

/**
 * Formata CNPJ para exibição (XX.XXX.XXX/XXXX-XX)
 */
export function formatCNPJ(cnpj: string): string {
  const clean = normalizeCNPJ(cnpj);
  if (clean.length !== 14) return cnpj;
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Identifica o sócio tomador de decisão (administrador/presidente)
 */
function identifyDecisionMaker(
  socios: Array<{
    nome: string;
    qualificacao: string;
  }>
): string | null {
  if (!socios || socios.length === 0) return null;

  // Primeiro, busca por qualificações administrativas
  const admin = socios.find(s => 
    ADMIN_QUALIFICATIONS.some(q => s.qualificacao.toLowerCase().includes(q))
  );
  
  if (admin) return admin.nome;

  // Fallback: primeiro sócio da lista (geralmente o principal)
  return socios[0]?.nome || null;
}

/**
 * Consulta CNPJ na BrasilAPI
 * 
 * @param cnpj - CNPJ com ou sem formatação
 * @returns Dados enriquecidos ou null se não encontrado
 */
export async function fetchCNPJFromBrasilAPI(cnpj: string): Promise<CNPJEnrichedData | null> {
  const cleanCNPJ = normalizeCNPJ(cnpj);
  
  if (cleanCNPJ.length !== 14) {
    console.warn('CNPJ inválido:', cnpj);
    return null;
  }

  const url = `https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'B2B-Prospect-Dashboard/1.0 (contato@seudominio.com)',
        'Accept': 'application/json',
      },
      // Cache de 24h para CNPJs (dados mudam pouco)
      next: { revalidate: 86400 },
    });

    if (response.status === 404) {
      return null;
    }

    if (response.status === 429 || response.status === 403) {
      // Rate limit ou bloqueio da Vercel - será tratado no fallback
      throw new Error(`BrasilAPI bloqueada: ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(`BrasilAPI erro ${response.status}`);
    }

    const data: BrasilAPICNPJResponse = await response.json();

    // Extrai sócios com qualificação
    const socios = (data.qsa || []).map(s => ({
      nome: s.nome_socio,
      qualificacao: s.qualificacao_socio,
    }));

    const decisionMaker = identifyDecisionMaker(socios);

    return {
      cnpj: formatCNPJ(data.cnpj),
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia || data.razao_social,
      telefone: data.ddd_telefone_1 || data.ddd_telefone_2 || '',
      email: data.email || '',
      endereco: {
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        cep: data.cep,
        cidade: data.municipio,
        uf: data.uf,
      },
      cnae_fiscal: `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}`,
      socios: socios.map(s => ({
        nome: s.nome,
        qualificacao: s.qualificacao,
        is_admin: ADMIN_QUALIFICATIONS.some(q => s.qualificacao.toLowerCase().includes(q)),
      })),
      decision_maker_name: decisionMaker,
      source: 'brasilapi',
    };
  } catch (error) {
    console.warn('BrasilAPI falhou:', error);
    throw error; // Propaga para tentar fallback
  }
}

/**
 * Consulta CNPJ na MinhaReceita (fallback)
 * 
 * @param cnpj - CNPJ com ou sem formatação
 * @returns Dados enriquecidos ou null se não encontrado
 */
export async function fetchCNPJFromMinhaReceita(cnpj: string): Promise<CNPJEnrichedData | null> {
  const cleanCNPJ = normalizeCNPJ(cnpj);
  
  if (cleanCNPJ.length !== 14) {
    return null;
  }

  const url = `https://minhareceita.org/${cleanCNPJ}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'B2B-Prospect-Dashboard/1.0 (contato@seudominio.com)',
        'Accept': 'application/json',
      },
      next: { revalidate: 86400 },
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`MinhaReceita erro ${response.status}`);

    const data: MinhaReceitaCNPJResponse = await response.json();

    const socios = (data.socios || []).map(s => ({
      nome: s.nome,
      qualificacao: s.qualificacao,
    }));

    const decisionMaker = identifyDecisionMaker(socios);

    return {
      cnpj: formatCNPJ(data.cnpj),
      razao_social: data.razaoSocial,
      nome_fantasia: data.nomeFantasia || data.razaoSocial,
      telefone: data.dddTelefone1 || data.dddTelefone2 || '',
      email: data.email || '',
      endereco: {
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        cep: data.cep,
        cidade: data.municipio,
        uf: data.uf,
      },
      cnae_fiscal: `${data.cnaeFiscal} - ${data.cnaeFiscalDescricao}`,
      socios: socios.map(s => ({
        nome: s.nome,
        qualificacao: s.qualificacao,
        is_admin: ADMIN_QUALIFICATIONS.some(q => s.qualificacao.toLowerCase().includes(q)),
      })),
      decision_maker_name: decisionMaker,
      source: 'minhareceita',
    };
  } catch (error) {
    console.warn('MinhaReceita falhou:', error);
    return null;
  }
}

/**
 * Tenta localizar CNPJ por nome da empresa (busca textual)
 * Nota: BrasilAPI não tem busca por nome, apenas por CNPJ exato.
 * Para busca por nome, seria necessário usar MinhaReceita com query params
 * ou outro serviço. Esta função retorna null por enquanto.
 */
export async function findCNPJByCompanyName(
  companyName: string
): Promise<string | null> {
  // BrasilAPI não suporta busca por nome
  // MinhaReceita suporta busca paginada mas requer parâmetros específicos
  // Para implementar, usar: GET /?razao_social={nome}&limit=10
  // Mas a API não documenta claramente este endpoint
  
  console.warn('Busca de CNPJ por nome não implementada - requer CNPJ exato');
  return null;
}

/**
 * Função principal de enriquecimento com fallback automático
 * Tenta BrasilAPI primeiro, cai para MinhaReceita em caso de falha
 */
export async function enrichWithCNPJ(
  companyName: string,
  knownCNPJ?: string
): Promise<CNPJEnrichedData | null> {
  // Se já temos o CNPJ, consulta direto
  if (knownCNPJ) {
    try {
      return await fetchCNPJFromBrasilAPI(knownCNPJ);
    } catch {
      // Fallback para MinhaReceita
      return await fetchCNPJFromMinhaReceita(knownCNPJ);
    }
  }

  // TODO: Implementar busca de CNPJ por nome da empresa
  // Por enquanto, retorna null se não tem CNPJ conhecido
  console.log('CNPJ não conhecido para:', companyName);
  return null;
}

/**
 * Enriquecimento em lote para múltiplas empresas
 * Útil quando já temos lista de CNPJs
 */
export async function enrichMultipleCNPJs(
  cnpjs: string[]
): Promise<Map<string, CNPJEnrichedData>> {
  const results = new Map<string, CNPJEnrichedData>();
  
  // Processa em paralelo com concorrência limitada (3 por vez)
  const concurrency = 3;
  for (let i = 0; i < cnpjs.length; i += concurrency) {
    const batch = cnpjs.slice(i, i + concurrency);
    const promises = batch.map(async (cnpj) => {
      try {
        const data = await fetchCNPJFromBrasilAPI(cnpj);
        if (data) {
          results.set(normalizeCNPJ(cnpj), data);
        }
      } catch {
        // Tenta fallback
        const fallback = await fetchCNPJFromMinhaReceita(cnpj);
        if (fallback) {
          results.set(normalizeCNPJ(cnpj), fallback);
        }
      }
    });
    await Promise.all(promises);
    
    // Pausa entre batches para evitar rate limit
    if (i + concurrency < cnpjs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}