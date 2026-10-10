/**
 * Rotulos amigaveis em PT-BR para os tipos de medicao e formatacao de valores.
 * Mantem os textos de UI em Portugues, enquanto o codigo/dados permanecem com
 * as chaves tecnicas usadas pela API (qualidade_ar, transito, alagamento).
 *
 * Onde e aplicado: telas de Detalhe, Relatorios e Alertas.
 */

import { TipoMedicao } from '../types';

const ROTULOS_TIPO: Record<TipoMedicao, string> = {
  qualidade_ar: 'Qualidade do ar',
  transito: 'Transito',
  alagamento: 'Alagamento',
};

/** Retorna o rotulo PT-BR de um tipo de medicao. */
export function rotuloTipo(tipo: TipoMedicao): string {
  return ROTULOS_TIPO[tipo] ?? tipo;
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
