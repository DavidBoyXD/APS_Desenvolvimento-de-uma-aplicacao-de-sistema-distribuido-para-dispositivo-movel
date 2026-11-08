/**
 * Catálogo de NAVEGAÇÃO ASSISTIDA da tela de Linhas e da busca sobre o mapa.
 *
 * Para LINHAS, a navegação assistida mostra apenas os FAVORITOS salvos pelo
 * usuário; a busca livre (campo de texto) cobre o restante e é a forma
 * principal de encontrar QUALQUER linha.
 *
 * Para PARADAS, NÃO há mais sugestões fixas (atalhos de "pontos de referência"):
 * os termos fixos eram suposições e alguns não retornavam resultado na busca
 * real de paradas. Em vez de oferecer atalhos que podem falhar, a aba de
 * Paradas exibe apenas uma orientação curta e deixa a busca livre + aproximada
 * (fuzzy, ver src/ui/busca.ts) como caminho.
 *
 * Por não haver mais dados fixos a catalogar, este módulo deixou de exportar
 * constantes; o arquivo é mantido como ponto de documentação da decisão e para
 * preservar o caminho de import caso sugestões voltem a existir no futuro.
 *
 * Onde é aplicado: src/screens/LinhasScreen.tsx e src/screens/MapaBuscaOverlay.tsx.
 */

/**
 * Texto curto de orientação exibido na aba de PARADAS quando o campo está
 * vazio, no lugar das antigas sugestões fixas.
 */
export const DICA_BUSCA_PARADA =
  'Digite o nome da parada, avenida ou referência para buscar.';

export {};
