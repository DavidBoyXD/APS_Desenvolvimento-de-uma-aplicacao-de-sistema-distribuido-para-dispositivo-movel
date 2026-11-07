/**
 * Catálogo de NAVEGAÇÃO ASSISTIDA da tela de Linhas e da busca sobre o mapa.
 *
 * Objetivo: ajudar quem ainda não sabe o que pesquisar na aba de PARADAS,
 * oferecendo alguns PONTOS DE REFERÊNCIA conhecidos. São apenas SUGESTÕES: a
 * busca livre (campo de texto) continua disponível e é a forma principal de
 * encontrar QUALQUER parada. Ao tocar numa sugestão, a tela PREENCHE o campo de
 * busca com o `termo` abaixo e dispara a busca normal (buscarParadas).
 *
 * Observação: NÃO há mais sugestões de linhas ("linhas populares" ou atalhos por
 * número inicial). Para linhas, a navegação assistida mostra apenas os
 * FAVORITOS salvos pelo usuário; a busca livre cobre o restante.
 *
 * Onde é aplicado: src/screens/LinhasScreen.tsx e src/screens/MapaBuscaOverlay.tsx.
 */

/**
 * Ponto de referência conhecido para a aba de PARADAS. O `termo` é usado na
 * busca de paradas (buscarParadas) e deve usar as formas ABREVIADAS que a
 * SPTrans reconhece (ex.: "Av." em vez de "Avenida", "Pça." em vez de "Praça",
 * "Term." em vez de "Terminal"); a `descricao` é só informativa.
 */
export interface ParadaReferencia {
  termo: string;
  descricao: string;
}

/**
 * Lista CURADA e enxuta de pontos de referência de São Paulo, com termos nas
 * formas oficiais/abreviadas usadas pela SPTrans, para servir de ponto de
 * partida na busca de paradas.
 */
export const PARADAS_REFERENCIA: ParadaReferencia[] = [
  { termo: 'Av. Paulista', descricao: 'Avenida Paulista' },
  { termo: 'Pça. da Se', descricao: 'Praça da Sé' },
  { termo: 'Term. Bandeira', descricao: 'Terminal Bandeira' },
  { termo: 'Term. Lapa', descricao: 'Terminal Lapa' },
  { termo: 'Term. Pinheiros', descricao: 'Terminal Pinheiros' },
  { termo: 'Av. Brasil', descricao: 'Avenida Brasil' },
];
