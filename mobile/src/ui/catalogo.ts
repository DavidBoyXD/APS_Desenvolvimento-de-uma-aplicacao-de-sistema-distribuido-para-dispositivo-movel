/**
 * Catálogo de NAVEGAÇÃO ASSISTIDA da tela de Linhas.
 *
 * Objetivo: ajudar quem NÃO SABE o que pesquisar, oferecendo atalhos. Estes são
 * apenas SUGESTÕES: a busca livre (campo de texto) continua disponível e é a
 * forma principal de encontrar QUALQUER linha, inclusive linhas pouco usadas que
 * não aparecem nesta lista. Ao tocar numa sugestão, a tela PREENCHE o campo de
 * busca com o `termo` abaixo e dispara a busca normal (buscarLinhas), deixando a
 * API devolver o `codigo_linha` real; não fixamos códigos internos aqui, pois
 * eles podem variar entre consultas da SPTrans.
 *
 * Onde é aplicado: src/screens/LinhasScreen.tsx (seção exibida só quando o campo
 * de busca está vazio e ainda não há resultados).
 */

/** Uma linha popular sugerida. `termo` é o letreiro usado para buscar. */
export interface LinhaPopular {
  /** Termo de busca (letreiro da linha). É o que vai para o campo de busca. */
  termo: string;
  /** Descrição curta do trajeto, apenas para exibição. */
  descricao: string;
}

/**
 * Lista CURADA de linhas conhecidas de São Paulo, para servir de ponto de
 * partida. A busca usa o `termo` (letreiro); a `descricao` é só informativa.
 * Mantida enxuta de propósito (atalhos, não um catálogo completo).
 */
export const LINHAS_POPULARES: LinhaPopular[] = [
  { termo: '8000', descricao: 'Term. Lapa – Term. Pinheiros' },
  { termo: '875A', descricao: 'Metrô Santa Cruz – Lapa' },
  { termo: '477P', descricao: 'Term. Princ. Isabel – Jd. Ângela' },
  { termo: '702U', descricao: 'Term. Lapa – Butantã (USP)' },
  { termo: '5154', descricao: 'Term. Santo Amaro – Jd. Miriam' },
  { termo: '6262', descricao: 'Term. Pirituba – Lapa' },
  { termo: '917M', descricao: 'Term. Pirituba – Pompeia' },
  { termo: '809H', descricao: 'Term. Lapa – Cidade Universitária' },
  { termo: '701U', descricao: 'Term. Princ. Isabel – Butantã' },
  { termo: '1177', descricao: 'Metrô Santana – Jaçanã' },
];

/**
 * Pontos de referência conhecidos para a aba de PARADAS, no mesmo espírito de
 * sugestão. O `termo` é usado na busca de paradas (buscarParadas).
 */
export interface ParadaReferencia {
  termo: string;
  descricao: string;
}

export const PARADAS_REFERENCIA: ParadaReferencia[] = [
  { termo: 'Terminal Lapa', descricao: 'Terminal Lapa' },
  { termo: 'Terminal Pinheiros', descricao: 'Terminal Pinheiros' },
  { termo: 'Avenida Paulista', descricao: 'Avenida Paulista' },
  { termo: 'Terminal Santo Amaro', descricao: 'Terminal Santo Amaro' },
];

/**
 * Atalhos OPCIONAIS por número/letra inicial. Ao tocar, o campo é preenchido com
 * o caractere e a busca é disparada (apenas um auxílio; a busca livre continua).
 */
export const ATALHOS_INICIAIS: string[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
];
