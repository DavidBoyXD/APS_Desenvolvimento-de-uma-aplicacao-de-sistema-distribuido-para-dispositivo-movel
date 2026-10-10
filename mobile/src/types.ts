/**
 * Tipos TypeScript que espelham os schemas Pydantic da API REST (back-end FEAT-002).
 *
 * Fonte da verdade: contrato documentado em
 *   .agents/tasks/task-aps-sistema-ambiental-distribuido/features/FEAT-002.json
 * e nos schemas em server/app/schemas.py.
 *
 * Onde e aplicado: consumidos pelo cliente HTTP (src/api/client.ts) e pelas telas
 * (src/screens/*). Mantidos em ingles por serem codigo; textos de UI ficam em PT-BR.
 */

/** Tipos de medicao ambiental suportados pela API. */
export type TipoMedicao = 'qualidade_ar' | 'transito' | 'alagamento';

/** Condicao de comparacao usada nas regras de alerta. */
export type CondicaoAlerta = '>' | '<';

/**
 * Regiao urbana monitorada. As coordenadas latitude/longitude sao usadas para
 * posicionar os marcadores no react-native-maps (MapaScreen).
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
 * Medicao ambiental generica (por tipo/parametro). Espelha o schema Medicao da API.
 * O campo timestamp e uma string ISO 8601 com timezone.
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
 * Alerta efetivamente disparado ao avaliar as medicoes recentes contra as regras.
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
 * Resumo agregado de um par (tipo, parametro) usado no relatorio da regiao.
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
 * Relatorio agregado de uma regiao. Espelha o schema RelatorioRegiao da API
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
