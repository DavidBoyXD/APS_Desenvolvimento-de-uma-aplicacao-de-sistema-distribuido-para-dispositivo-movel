/**
 * Tipos TypeScript que espelham os schemas Pydantic da API REST.
 *
 * Fonte da verdade: os schemas em server/app/schemas.py.
 *
 * Onde é aplicado: consumidos pelo cliente HTTP (src/api/client.ts) e pelas telas
 * (src/screens/*). Mantidos em inglês por serem código; textos de UI ficam em PT-BR.
 */

/** Tipos de medição suportados pela API (apenas transporte público/SPTrans). */
export type TipoMedicao = 'transporte_publico';

/** Condição de comparação usada nas regras de alerta. */
export type CondicaoAlerta = '>' | '<';

/**
 * Região urbana monitorada. As coordenadas latitude/longitude são exibidas na
 * lista de regiões (MapaScreen) e identificam cada local.
 * Espelha o schema Regiao da API.
 */
export interface Regiao {
  id: number;
  nome: string;
  cidade: string;
  uf: string;
  latitude: number;
  longitude: number;
}

/**
 * Medição genérica (por tipo/parâmetro). Espelha o schema Medicao da API.
 * O campo timestamp é uma string ISO 8601 com timezone.
 */
export interface Medicao {
  id: number;
  regiao_id: number;
  tipo: TipoMedicao;
  parametro: string;
  valor: number;
  unidade: string;
  timestamp: string;
  fonte: string;
}

/**
 * Regra de alerta por limiar. Espelha o schema Alerta da API.
 */
export interface Alerta {
  id: number;
  regiao_id: number;
  tipo: TipoMedicao;
  parametro: string;
  limiar: number;
  condicao: CondicaoAlerta;
  ativo: boolean;
  mensagem: string;
}

/**
 * Payload para criar uma nova regra de alerta (POST /api/v1/alertas).
 * Espelha o schema AlertaCreate da API.
 */
export interface AlertaCreate {
  regiao_id: number;
  tipo: TipoMedicao;
  parametro: string;
  limiar: number;
  condicao: CondicaoAlerta;
  ativo?: boolean;
  mensagem: string;
}

/**
 * Alerta efetivamente disparado ao avaliar as medições recentes contra as regras.
 * Espelha o schema AlertaDisparado da API.
 */
export interface AlertaDisparado {
  alerta_id: number;
  regiao_id: number;
  tipo: TipoMedicao;
  parametro: string;
  limiar: number;
  condicao: CondicaoAlerta;
  valor_observado: number;
  mensagem: string;
}

/**
 * Resumo agregado de um par (tipo, parametro) usado no relatório da região.
 * Espelha o item de RelatorioRegiao.resumos da API.
 */
export interface ResumoRelatorio {
  tipo: TipoMedicao;
  parametro: string;
  unidade: string;
  contagem: number;
  media: number;
  minimo: number;
  maximo: number;
  ultimo_valor: number;
  ultimo_timestamp: string;
}

/**
 * Relatório agregado de uma região. Espelha o schema RelatorioRegiao da API
 * (GET /api/v1/relatorios/regiao/{id}).
 */
export interface RelatorioRegiao {
  regiao: Regiao;
  total_medicoes: number;
  resumos: ResumoRelatorio[];
}

/**
 * Corpo de erro padronizado retornado pela API. Espelha o schema ErroResposta.
 */
export interface ErroResposta {
  codigo: number;
  mensagem: string;
  detalhe?: string | null;
}

// ---------------------------------------------------------------------------
// Acompanhamento de ônibus (SPTrans Olho Vivo): busca de linhas/paradas,
// posição dos veículos e previsão de chegada por parada. Fonte da verdade dos
// formatos: schemas LinhaRead, VeiculoPosicaoRead, PosicaoLinhaRead,
// PrevisaoVeiculoRead, ParadaPrevisaoRead, PrevisaoLinhaRead e ParadaRead em
// server/app/schemas.py. Quando `tempo_real` for false, o back-end devolveu um
// fallback de EXEMPLO (servidor sem token SPTRANS_TOKEN): a UI deve rotular.
// ---------------------------------------------------------------------------

/**
 * Linha de ônibus retornada pela busca (GET /api/v1/linhas/buscar).
 * Espelha o schema LinhaRead da API.
 */
export interface LinhaRead {
  codigo_linha: number;
  letreiro: string;
  /** Sentido da linha: 1 = ida, 2 = volta. */
  sentido: number;
  tipo: number;
  terminal_principal: string;
  terminal_secundario: string;
  circular: boolean;
  tempo_real: boolean;
  fonte: string;
}

/**
 * Posição de um veículo (ônibus) em operação. Espelha o schema
 * VeiculoPosicaoRead da API. O campo timestamp é uma string ISO 8601.
 */
export interface VeiculoPosicaoRead {
  prefixo: string;
  acessivel: boolean;
  timestamp: string;
  latitude: number;
  longitude: number;
}

/**
 * Posição em tempo real dos veículos de uma linha
 * (GET /api/v1/linhas/{codigo_linha}/posicoes). Espelha o schema
 * PosicaoLinhaRead da API.
 */
export interface PosicaoLinhaRead {
  horario_referencia: string;
  veiculos: VeiculoPosicaoRead[];
  tempo_real: boolean;
  fonte: string;
}

/**
 * Previsão de chegada de um veículo a uma parada. Espelha o schema
 * PrevisaoVeiculoRead da API. O campo horario_previsto é o horário estimado
 * de chegada (texto curto, ex.: "00:03"); timestamp é uma string ISO 8601.
 */
export interface PrevisaoVeiculoRead {
  prefixo: string;
  horario_previsto: string;
  acessivel: boolean;
  timestamp: string;
  latitude: number;
  longitude: number;
}

/**
 * Previsão de chegada agrupada por parada. Espelha o schema ParadaPrevisaoRead
 * da API.
 */
export interface ParadaPrevisaoRead {
  codigo_parada: number;
  nome: string;
  latitude: number;
  longitude: number;
  veiculos: PrevisaoVeiculoRead[];
}

/**
 * Previsão de chegada de uma linha, por parada
 * (GET /api/v1/linhas/{codigo_linha}/previsao). Espelha o schema
 * PrevisaoLinhaRead da API.
 */
export interface PrevisaoLinhaRead {
  horario_referencia: string;
  paradas: ParadaPrevisaoRead[];
  tempo_real: boolean;
  fonte: string;
}

/**
 * Parada de ônibus retornada pela busca (GET /api/v1/paradas/buscar).
 * Espelha o schema ParadaRead da API.
 */
export interface ParadaRead {
  codigo: number;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
  tempo_real: boolean;
  fonte: string;
}
