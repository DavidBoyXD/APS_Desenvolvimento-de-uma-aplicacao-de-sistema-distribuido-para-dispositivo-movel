/**
 * Rótulos amigáveis em PT-BR para os tipos de medição e formatação de valores.
 * Mantém os textos de UI em Português, enquanto o código/dados permanecem com
 * a chave técnica usada pela API (transporte_publico).
 *
 * Onde é aplicado: telas de Detalhe, Relatorios e Alertas.
 */

import { TipoMedicao } from '../types';

const ROTULOS_TIPO: Record<TipoMedicao, string> = {
  transporte_publico: 'Transporte público (SPTrans)',
};

/**
 * Rótulos PT-BR dos parâmetros técnicos usados pela API. As chaves espelham o
 * campo `parametro` persistido pelo back-end (ver server/app/services/*). Os
 * parâmetros de transporte_publico vêm da SPTrans Olho Vivo:
 * `linhas_monitoradas` e `veiculos_em_operacao` (caminho com token, tempo
 * real) e `linhas_exemplo` (caminho de fallback sem token, dado de exemplo).
 */
const ROTULOS_PARAMETRO: Record<string, string> = {
  linhas_monitoradas: 'Linhas monitoradas',
  veiculos_em_operacao: 'Veículos em operação',
  linhas_exemplo: 'Linhas (exemplo, sem token)',
};

/** Retorna o rótulo PT-BR de um tipo de medição. */
export function rotuloTipo(tipo: TipoMedicao): string {
  return ROTULOS_TIPO[tipo] ?? tipo;
}

/**
 * Retorna o rótulo PT-BR de um parâmetro técnico. Caso o parâmetro não tenha
 * rótulo mapeado, devolve a própria chave (comportamento seguro para dados
 * novos vindos da API).
 */
export function rotuloParametro(parametro: string): string {
  return ROTULOS_PARAMETRO[parametro] ?? parametro;
}

/** Formata um número com até 2 casas decimais no padrão pt-BR. */
export function formatarNumero(valor: number): string {
  if (!Number.isFinite(valor)) {
    return '-';
  }
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Aviso padrão exibido quando um dado da SPTrans Olho Vivo veio do fallback de
 * EXEMPLO (servidor sem token SPTRANS_TOKEN), ou seja, não é tempo real.
 */
export const AVISO_DADO_EXEMPLO =
  'Dado de EXEMPLO (não é tempo real): o servidor está sem token da SPTrans.';

/** Rótulo PT-BR do sentido de uma linha (1 = ida, 2 = volta). */
export function rotuloSentido(sentido: number): string {
  if (sentido === 1) {
    return 'Ida';
  }
  if (sentido === 2) {
    return 'Volta';
  }
  return `Sentido ${sentido}`;
}

/** Rótulo PT-BR de acessibilidade de um veículo (ex.: piso baixo/elevador). */
export function rotuloAcessivel(acessivel: boolean): string {
  return acessivel ? 'Acessível' : 'Não acessível';
}

/** Formata um timestamp ISO 8601 para data/hora local legível (pt-BR). */
export function formatarTimestamp(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return iso;
  }
  return data.toLocaleString('pt-BR');
}

/** Formata apenas a HORA (hh:mm:ss) de uma data local no padrão pt-BR. */
export function formatarHora(data: Date): string {
  if (Number.isNaN(data.getTime())) {
    return '-';
  }
  return data.toLocaleTimeString('pt-BR');
}

/**
 * Rótulo PT-BR da contagem de veículos em operação de uma linha. Deixa claro
 * quando o dado é de EXEMPLO (servidor sem token da SPTrans), para manter a
 * coerência com o restante do app.
 */
export function rotuloVeiculosEmOperacao(
  quantidade: number,
  tempoReal: boolean,
): string {
  const sufixo = tempoReal ? '' : ' (exemplo)';
  if (quantidade <= 0) {
    return `Sem veículos no momento${sufixo}`;
  }
  if (quantidade === 1) {
    return `1 em operação${sufixo}`;
  }
  return `${quantidade} em operação${sufixo}`;
}
