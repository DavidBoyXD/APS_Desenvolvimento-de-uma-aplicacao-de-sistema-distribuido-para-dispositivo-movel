/**
 * Utilitários de BUSCA APROXIMADA (fuzzy) para linhas e paradas.
 *
 * Motivação: digitar um termo EXATAMENTE como ele aparece no Olho Vivo da
 * SPTrans é difícil (acentos, pontuação, abreviações). Este módulo oferece uma
 * normalização robusta e uma métrica de similaridade (0..1) para tolerar
 * pequenas variações, de modo que termos "próximos o suficiente" (~70-80%) já
 * tragam o resultado desejado entre as primeiras sugestões.
 *
 * COMO É USADO (no cliente, sem depender do back-end):
 *   - A API da SPTrans (/Linha/Buscar, /Parada/Buscar) SEMPRE exige um termo e
 *     faz o match no servidor; não existe "listar tudo". Por isso a fuzzy é
 *     aplicada sobre os RESULTADOS retornados: normalizamos o termo do usuário,
 *     consultamos a API e ORDENAMOS os resultados pela similaridade com o termo
 *     (do mais parecido ao menos).
 *   - Para paradas, geramos variações de abreviação comuns ("avenida" -> "av",
 *     "praça" -> "pca", etc.) para uma 2ª tentativa de consulta quando a 1ª vier
 *     vazia, limitada a poucas tentativas para não sobrecarregar o servidor.
 *
 * Nada aqui quebra a BUSCA LIVRE: a ordenação é estável e preserva todos os
 * resultados; apenas os reorganiza por relevância.
 *
 * Onde é aplicado: src/screens/LinhasScreen.tsx e src/screens/MapaBuscaOverlay.tsx.
 */

/**
 * Normaliza um texto para comparação: minúsculas, remove acentos/diacríticos,
 * troca pontuação comum por espaço e colapsa espaços. Determinístico e sem
 * dependências externas (usa Unicode NFD + remoção da faixa de combinação).
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    // Remove marcas diacríticas combinantes (acentos) da faixa U+0300..U+036F.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Pontuação e símbolos viram espaço (".", "-", "/", etc.).
    .replace(/[^a-z0-9\s]/g, ' ')
    // Colapsa espaços repetidos.
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Distância de edição de Levenshtein entre duas strings (número mínimo de
 * inserções, remoções ou substituições). Implementação iterativa com uma única
 * linha de programação dinâmica, O(n*m) tempo e O(m) espaço.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }
  let linhaAnterior = new Array<number>(b.length + 1);
  let linhaAtual = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) {
    linhaAnterior[j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    linhaAtual[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const custoSubstituicao = a[i - 1] === b[j - 1] ? 0 : 1;
      linhaAtual[j] = Math.min(
        linhaAtual[j - 1] + 1, // inserção
        linhaAnterior[j] + 1, // remoção
        linhaAnterior[j - 1] + custoSubstituicao, // substituição
      );
    }
    const troca = linhaAnterior;
    linhaAnterior = linhaAtual;
    linhaAtual = troca;
  }
  return linhaAnterior[b.length];
}

/**
 * Similaridade 0..1 entre dois textos JÁ considerando a normalização. Combina
 * dois sinais pragmáticos:
 *   - similaridade por distância de Levenshtein normalizada pelo comprimento;
 *   - bônus de SUBSTRING: se o termo do usuário está contido no candidato (ou
 *     vice-versa), a similaridade recebe um piso alto, pois a API já faz match
 *     por substring e queremos valorizá-lo.
 * Retorna 1 para textos idênticos e 0 quando ambos ficam vazios.
 */
export function similaridade(a: string, b: string): number {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (na.length === 0 && nb.length === 0) {
    return 0;
  }
  if (na === nb) {
    return 1;
  }
  const maior = Math.max(na.length, nb.length);
  const distancia = levenshtein(na, nb);
  const porEdicao = maior === 0 ? 0 : 1 - distancia / maior;

  // Bônus de substring: valoriza quando um texto contém o outro (match parcial
  // típico da busca por letreiro/nome). O piso é proporcional à fração coberta.
  let porSubstring = 0;
  if (na.length > 0 && nb.length > 0) {
    if (nb.includes(na)) {
      porSubstring = 0.6 + 0.4 * (na.length / nb.length);
    } else if (na.includes(nb)) {
      porSubstring = 0.6 + 0.4 * (nb.length / na.length);
    }
  }
  return Math.max(porEdicao, porSubstring);
}

/** Limiar padrão a partir do qual uma sugestão é considerada "boa" (~70%). */
export const LIMIAR_SIMILARIDADE = 0.7;

/**
 * Ordena uma lista de itens pela similaridade (decrescente) entre o `termo` do
 * usuário e um texto extraído de cada item por `extrairTexto`. Ordenação
 * ESTÁVEL que PRESERVA todos os itens (não filtra), apenas os reorganiza por
 * relevância. Não altera a lista original (retorna uma nova).
 */
export function ordenarPorSimilaridade<T>(
  itens: T[],
  termo: string,
  extrairTexto: (item: T) => string,
): T[] {
  const termoNormalizado = normalizar(termo);
  if (termoNormalizado.length === 0) {
    return itens.slice();
  }
  return itens
    .map((item, indice) => ({
      item,
      indice,
      escore: similaridade(termoNormalizado, extrairTexto(item)),
    }))
    .sort((a, b) => {
      if (b.escore !== a.escore) {
        return b.escore - a.escore;
      }
      // Empate: mantém a ordem original (ordenação estável).
      return a.indice - b.indice;
    })
    .map((entrada) => entrada.item);
}

/**
 * Mapa de abreviações comuns de logradouros/pontos usadas pela SPTrans. As
 * chaves são palavras normalizadas (sem acento) e os valores, a forma curta que
 * o Olho Vivo costuma reconhecer na busca de paradas.
 */
const ABREVIACOES: Record<string, string> = {
  avenida: 'av',
  praca: 'pca',
  doutor: 'dr',
  doutora: 'dra',
  professor: 'prof',
  professora: 'profa',
  estrada: 'estr',
  rodovia: 'rod',
  terminal: 'term',
  alameda: 'al',
  travessa: 'tv',
  largo: 'lgo',
  rua: 'r',
  marechal: 'mal',
  general: 'gen',
  presidente: 'pres',
  engenheiro: 'eng',
  santo: 'sto',
  santa: 'sta',
  senhor: 'sr',
  nossa: 'na',
  senhora: 'sra',
};

/**
 * Gera uma pequena lista de variações do termo para tentar na busca de PARADAS,
 * sem repetições e com o termo original SEMPRE primeiro. A variação abreviada
 * substitui palavras conhecidas pela forma curta (ex.: "avenida paulista" ->
 * "av paulista"). Limitada a no máximo `maximo` variações (padrão 2) para não
 * sobrecarregar o servidor.
 */
export function variacoesDeTermo(termo: string, maximo = 2): string[] {
  const original = termo.trim();
  const variacoes: string[] = [];
  const vistos = new Set<string>();

  const adicionar = (candidato: string) => {
    const limpo = candidato.trim();
    if (limpo.length === 0) {
      return;
    }
    const chave = normalizar(limpo);
    if (vistos.has(chave)) {
      return;
    }
    vistos.add(chave);
    variacoes.push(limpo);
  };

  adicionar(original);

  // Variação abreviada: troca cada palavra conhecida pela forma curta, usando a
  // versão normalizada como base para casar as chaves do mapa de abreviações.
  const abreviado = normalizar(original)
    .split(' ')
    .map((palavra) => ABREVIACOES[palavra] ?? palavra)
    .join(' ')
    .trim();
  adicionar(abreviado);

  return variacoes.slice(0, Math.max(1, maximo));
}
