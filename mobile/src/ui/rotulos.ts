/**
 * Rotulos amigaveis em PT-BR para os tipos de medicao e formatacao de valores.
 * Mantem os textos de UI em Portugues, enquanto o codigo/dados permanecem com
 * as chaves tecnicas usadas pela API (qualidade_ar, transito, alagamento,
 * transporte_publico).
 *
 * Onde e aplicado: telas de Detalhe, Relatorios e Alertas.
 */

import { TipoMedicao } from '../types';

const ROTULOS_TIPO: Record<TipoMedicao, string> = {
  qualidade_ar: 'Qualidade do ar',
  transito: 'Transito',
  alagamento: 'Alagamento',
  transporte_publico: 'Transporte publico (SPTrans)',
};

/**
 * Rotulos PT-BR dos parametros tecnicos usados pela API. As chaves espelham o
 * campo `parametro` persistido pelo back-end (ver server/app/services/*). Os
 * parametros de transporte_publico vem da SPTrans Olho Vivo:
 * `linhas_monitoradas` e `veiculos_em_operacao` (caminho com token, tempo
 * real) e `linhas_exemplo` (caminho de fallback sem token, dado de exemplo).
 */
const ROTULOS_PARAMETRO: Record<string, string> = {
  linhas_monitoradas: 'Linhas monitoradas',
  veiculos_em_operacao: 'Veiculos em operacao',
  linhas_exemplo: 'Linhas (exemplo, sem token)',
};

/** Retorna o rotulo PT-BR de um tipo de medicao. */
export function rotuloTipo(tipo: TipoMedicao): string {
  return ROTULOS_TIPO[tipo] ?? tipo;
}

/**
 * Retorna o rotulo PT-BR de um parametro tecnico. Caso o parametro nao tenha
 * rotulo mapeado, devolve a propria chave (comportamento seguro para dados
 * novos vindos da API).
 */
export function rotuloParametro(parametro: string): string {
  return ROTULOS_PARAMETRO[parametro] ?? parametro;
}

/** Formata um numero com ate 2 casas decimais no padrao pt-BR. */
export function formatarNumero(valor: number): string {
  if (!Number.isFinite(valor)) {
    return '-';
  }
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/** Formata um timestamp ISO 8601 para data/hora local legivel (pt-BR). */
export function formatarTimestamp(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return iso;
  }
  return data.toLocaleString('pt-BR');
}
