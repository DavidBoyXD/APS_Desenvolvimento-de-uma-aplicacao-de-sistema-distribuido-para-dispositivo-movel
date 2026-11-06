/**
 * Favoritos locais do usuário (linhas de ônibus), persistidos NO APARELHO.
 *
 * Objetivo: permitir que a pessoa salve as linhas que mais acompanha e volte a
 * elas rapidamente, sem depender do back-end. Os favoritos ficam no próprio
 * dispositivo via AsyncStorage (armazenamento chave-valor assíncrono).
 *
 * Por que o acesso ao AsyncStorage é ISOLADO aqui (mesmo padrão de
 * src/ui/webview.ts):
 *   1. ROBUSTEZ EM RUNTIME. `@react-native-async-storage/async-storage` é um
 *      módulo com código NATIVO. Carregamos via `require` dentro de try/catch:
 *      se o pacote não resolver (ex.: ambiente sem o módulo nativo), caímos em
 *      um fallback EM MEMÓRIA, de modo que a UI nunca quebre; apenas os
 *      favoritos deixam de persistir entre sessões.
 *   2. TYPECHECK SEM O PACOTE INSTALADO. Neste ambiente o pacote ainda NÃO está
 *      em node_modules: ele é apenas adicionado ao package.json e o usuário roda
 *      `npx expo install @react-native-async-storage/async-storage` na máquina
 *      dele. Um import estático faria o `tsc --noEmit` falhar. Por isso o único
 *      ponto de contato com o pacote fica ISOLADO neste wrapper, com `require`
 *      tipado como `any` e um contrato LOCAL mínimo declarado abaixo.
 *
 * Todas as operações são tolerantes a falha: qualquer erro de storage é tratado
 * como "sem favoritos" (leitura) ou silenciosamente ignorado após atualizar o
 * cache em memória (escrita), nunca derrubando a tela.
 *
 * Onde é aplicado: tela de Linhas (src/screens/LinhasScreen.tsx).
 */

import { LinhaRead } from '../types';

/**
 * Contrato LOCAL mínimo do AsyncStorage que usamos. Propositalmente frouxo para
 * permitir o typecheck sem o pacote instalado; a API real é compatível.
 */
interface ArmazenamentoChaveValor {
  getItem(chave: string): Promise<string | null>;
  setItem(chave: string, valor: string): Promise<void>;
  removeItem(chave: string): Promise<void>;
}

/** Chave única usada no AsyncStorage para a lista de linhas favoritas. */
const CHAVE_LINHAS = '@aps:favoritos:linhas';

/**
 * Dados mínimos guardados de uma linha favorita. Guardamos o suficiente para
 * RE-EXIBIR o favorito na lista e para RE-BUSCAR a linha pelo fluxo normal
 * (preencher o campo de busca com `letreiro` e disparar buscarLinhas). O
 * `codigo_linha` é mantido apenas como referência; a busca real usa o letreiro,
 * pois o código interno da SPTrans pode variar entre consultas.
 */
export interface LinhaFavorita {
  codigo_linha: number;
  letreiro: string;
  terminal_principal: string;
  terminal_secundario: string;
}

/**
 * Carrega o módulo de AsyncStorage de forma protegida. Retorna o armazenamento
 * quando disponível, ou `null` quando o pacote não resolve. NUNCA lança.
 */
function carregarArmazenamento(): ArmazenamentoChaveValor | null {
  try {
    // `require` dinâmico tipado como any de propósito: isola o único ponto de
    // contato com o pacote nativo, para o tsc não precisar da tipagem e o
    // runtime poder cair no fallback em memória se o módulo não existir.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: any = require('@react-native-async-storage/async-storage');
    const storage = mod?.default ?? mod;
    if (
      storage &&
      typeof storage.getItem === 'function' &&
      typeof storage.setItem === 'function' &&
      typeof storage.removeItem === 'function'
    ) {
      return storage as ArmazenamentoChaveValor;
    }
    return null;
  } catch {
    return null;
  }
}

const armazenamento = carregarArmazenamento();

/**
 * Cache EM MEMÓRIA da lista de linhas favoritas. Serve de duas formas:
 *   - fallback quando o AsyncStorage não está disponível (favoritos não
 *     persistem entre sessões, mas a UI continua funcionando na sessão atual);
 *   - cópia sincronizada para leitura rápida após a 1ª carga.
 * `null` significa "ainda não carregado do storage".
 */
let cacheLinhas: LinhaFavorita[] | null = null;

/** Converte uma LinhaRead no formato mínimo persistido. */
export function paraLinhaFavorita(linha: LinhaRead): LinhaFavorita {
  return {
    codigo_linha: linha.codigo_linha,
    letreiro: linha.letreiro,
    terminal_principal: linha.terminal_principal,
    terminal_secundario: linha.terminal_secundario,
  };
}

/**
 * Identidade de uma linha favorita para comparação. Usamos o `letreiro`
 * normalizado (sem caixa/espaços) porque é o termo com que o usuário volta a
 * buscar a linha; o código interno pode variar entre consultas.
 */
function identidade(letreiro: string): string {
  return letreiro.trim().toLowerCase();
}

/** Faz o parse seguro do JSON persistido, descartando dados inválidos. */
function parseLista(texto: string | null): LinhaFavorita[] {
  if (!texto) {
    return [];
  }
  try {
    const dados: unknown = JSON.parse(texto);
    if (!Array.isArray(dados)) {
      return [];
    }
    return dados.filter(
      (item): item is LinhaFavorita =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as LinhaFavorita).letreiro === 'string' &&
        typeof (item as LinhaFavorita).codigo_linha === 'number',
    );
  } catch {
    return [];
  }
}

/**
 * Carrega as linhas favoritas do dispositivo. Em qualquer falha de storage,
 * devolve uma lista (vazia ou o cache em memória), nunca lançando.
 */
export async function carregarFavoritosLinhas(): Promise<LinhaFavorita[]> {
  if (cacheLinhas !== null) {
    return cacheLinhas;
  }
  if (!armazenamento) {
    cacheLinhas = [];
    return cacheLinhas;
  }
  try {
    cacheLinhas = parseLista(await armazenamento.getItem(CHAVE_LINHAS));
  } catch {
    // Falha ao ler o storage: trata como "sem favoritos" e segue em memória.
    cacheLinhas = [];
  }
  return cacheLinhas;
}

/** Persiste o cache atual no storage, ignorando erros de escrita com segurança. */
async function salvar(lista: LinhaFavorita[]): Promise<void> {
  cacheLinhas = lista;
  if (!armazenamento) {
    return;
  }
  try {
    await armazenamento.setItem(CHAVE_LINHAS, JSON.stringify(lista));
  } catch {
    // Falha de escrita: mantém apenas o cache em memória nesta sessão.
  }
}

/** Indica se uma linha (pelo letreiro) já está favoritada. */
export async function isLinhaFavorita(letreiro: string): Promise<boolean> {
  const lista = await carregarFavoritosLinhas();
  const alvo = identidade(letreiro);
  return lista.some((item) => identidade(item.letreiro) === alvo);
}

/**
 * Adiciona uma linha aos favoritos (idempotente: não duplica pelo letreiro) e
 * devolve a lista atualizada.
 */
export async function adicionarFavoritoLinha(
  linha: LinhaRead,
): Promise<LinhaFavorita[]> {
  const lista = await carregarFavoritosLinhas();
  const alvo = identidade(linha.letreiro);
  if (lista.some((item) => identidade(item.letreiro) === alvo)) {
    return lista;
  }
  const atualizada = [...lista, paraLinhaFavorita(linha)];
  await salvar(atualizada);
  return atualizada;
}

/**
 * Remove uma linha dos favoritos pelo letreiro e devolve a lista atualizada.
 */
export async function removerFavoritoLinha(
  letreiro: string,
): Promise<LinhaFavorita[]> {
  const lista = await carregarFavoritosLinhas();
  const alvo = identidade(letreiro);
  const atualizada = lista.filter((item) => identidade(item.letreiro) !== alvo);
  if (atualizada.length !== lista.length) {
    await salvar(atualizada);
  }
  return atualizada;
}

/**
 * Alterna o estado de favorito de uma linha e devolve a lista atualizada.
 * Útil para o botão de estrela, que não precisa saber o estado atual.
 */
export async function alternarFavoritoLinha(
  linha: LinhaRead,
): Promise<LinhaFavorita[]> {
  if (await isLinhaFavorita(linha.letreiro)) {
    return removerFavoritoLinha(linha.letreiro);
  }
  return adicionarFavoritoLinha(linha);
}
