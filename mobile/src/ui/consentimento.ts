/**
 * Registro de CONSENTIMENTO do usuário (LGPD), persistido NO APARELHO.
 *
 * Objetivo: guardar, somente no dispositivo, o fato de a pessoa ter aceitado os
 * Termos de Uso e a Política de Privacidade (com versão e data/hora) e se ela
 * consentiu, OPCIONALMENTE, com o uso da localização (GPS) para o "Você está
 * aqui" no mapa. Esse registro permite:
 *   - comprovar o consentimento (princípio de responsabilização da LGPD);
 *   - não exibir o aviso de consentimento repetidamente a cada abertura;
 *   - condicionar o uso do GPS ao aceite explícito (nada de localização antes do sim).
 *
 * Por que o acesso ao AsyncStorage é ISOLADO aqui (mesmo padrão de
 * src/ui/favoritos.ts e src/ui/webview.ts):
 *   1. ROBUSTEZ EM RUNTIME. `@react-native-async-storage/async-storage` é um
 *      módulo com código NATIVO. Carregamos via `require` dentro de try/catch:
 *      se o pacote não resolver, caímos em um fallback EM MEMÓRIA, de modo que a
 *      UI nunca quebre; apenas o consentimento deixa de persistir entre sessões.
 *   2. TYPECHECK SEM O PACOTE INSTALADO. Neste ambiente o pacote ainda NÃO está
 *      em node_modules: é apenas adicionado ao package.json e o usuário roda
 *      `npx expo install @react-native-async-storage/async-storage` na máquina
 *      dele. Um import estático faria o `tsc --noEmit` falhar. Por isso o único
 *      ponto de contato com o pacote fica ISOLADO neste wrapper, com `require`
 *      tipado como `any` e um contrato LOCAL mínimo declarado abaixo.
 *
 * Todas as operações são tolerantes a falha: qualquer erro de storage é tratado
 * como "sem consentimento" (leitura) ou silenciosamente ignorado após atualizar
 * o cache em memória (escrita), nunca derrubando a tela.
 *
 * Onde é aplicado: gate de consentimento em App.tsx e tela de Consentimento
 * (src/screens/ConsentimentoScreen.tsx).
 */

/**
 * Contrato LOCAL mínimo do AsyncStorage que usamos. Propositalmente frouxo para
 * permitir o typecheck sem o pacote instalado; a API real é compatível.
 */
interface ArmazenamentoChaveValor {
  getItem(chave: string): Promise<string | null>;
  setItem(chave: string, valor: string): Promise<void>;
  removeItem(chave: string): Promise<void>;
}

/**
 * Versão vigente dos Termos de Uso e da Política de Privacidade. Deve ser
 * mantida em sincronia com o cabeçalho de docs/12 e docs/13. Quando a versão
 * muda, consentimentos antigos deixam de ser válidos e o aviso é reexibido.
 */
export const VERSAO_TERMOS = '1.0';

/** Chave única usada no AsyncStorage para o registro de consentimento. */
const CHAVE_CONSENTIMENTO = '@aps:consentimento';

/**
 * Registro do consentimento guardado no aparelho.
 *   - `versaoTermos`: versão dos Termos/Política aceitos (ou vistos ao recusar).
 *   - `aceitouTermos`: true quando a pessoa ACEITOU os Termos e a Política.
 *   - `consentiuLocalizacao`: consentimento OPCIONAL e separado para usar o GPS.
 *   - `timestamp`: data/hora do registro em ISO 8601 (comprovação).
 */
export interface RegistroConsentimento {
  versaoTermos: string;
  aceitouTermos: boolean;
  consentiuLocalizacao: boolean;
  timestamp: string;
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
 * Cache EM MEMÓRIA do registro de consentimento. Serve de fallback quando o
 * AsyncStorage não está disponível (o consentimento não persiste entre sessões,
 * mas a UI continua funcionando na sessão atual) e de cópia sincronizada para
 * leitura rápida após a 1ª carga.
 *   - `undefined`: ainda não carregado do storage.
 *   - `null`: carregado e SEM registro.
 */
let cacheConsentimento: RegistroConsentimento | null | undefined = undefined;

/** Faz o parse seguro do JSON persistido, descartando dados inválidos. */
function parseRegistro(texto: string | null): RegistroConsentimento | null {
  if (!texto) {
    return null;
  }
  try {
    const dados: unknown = JSON.parse(texto);
    if (!dados || typeof dados !== 'object') {
      return null;
    }
    const obj = dados as Partial<RegistroConsentimento>;
    if (
      typeof obj.versaoTermos === 'string' &&
      typeof obj.aceitouTermos === 'boolean' &&
      typeof obj.consentiuLocalizacao === 'boolean' &&
      typeof obj.timestamp === 'string'
    ) {
      return {
        versaoTermos: obj.versaoTermos,
        aceitouTermos: obj.aceitouTermos,
        consentiuLocalizacao: obj.consentiuLocalizacao,
        timestamp: obj.timestamp,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Carrega o registro de consentimento do dispositivo. Em qualquer falha de
 * storage, devolve o cache em memória ou `null`, nunca lançando.
 */
export async function carregarConsentimento(): Promise<RegistroConsentimento | null> {
  if (cacheConsentimento !== undefined) {
    return cacheConsentimento;
  }
  if (!armazenamento) {
    cacheConsentimento = null;
    return cacheConsentimento;
  }
  try {
    cacheConsentimento = parseRegistro(
      await armazenamento.getItem(CHAVE_CONSENTIMENTO),
    );
  } catch {
    // Falha ao ler o storage: trata como "sem consentimento" e segue em memória.
    cacheConsentimento = null;
  }
  return cacheConsentimento;
}

/**
 * Persiste o registro de consentimento no aparelho, ignorando erros de escrita
 * com segurança (mantém ao menos o cache em memória nesta sessão).
 */
export async function salvarConsentimento(
  registro: RegistroConsentimento,
): Promise<void> {
  cacheConsentimento = registro;
  if (!armazenamento) {
    return;
  }
  try {
    await armazenamento.setItem(
      CHAVE_CONSENTIMENTO,
      JSON.stringify(registro),
    );
  } catch {
    // Falha de escrita: mantém apenas o cache em memória nesta sessão.
  }
}

/**
 * Remove o registro de consentimento do aparelho (revogação/exclusão). NUNCA
 * lança; atualiza o cache em memória de qualquer forma.
 */
export async function limparConsentimento(): Promise<void> {
  cacheConsentimento = null;
  if (!armazenamento) {
    return;
  }
  try {
    await armazenamento.removeItem(CHAVE_CONSENTIMENTO);
  } catch {
    // Falha de remoção: o cache em memória já reflete "sem consentimento".
  }
}

/**
 * Indica se há consentimento VÁLIDO para liberar a navegação principal: a
 * pessoa precisa ter aceitado os Termos e o registro precisa ser da versão
 * vigente dos Termos/Política.
 */
export function temConsentimentoValido(
  registro: RegistroConsentimento | null,
): boolean {
  return (
    !!registro &&
    registro.aceitouTermos === true &&
    registro.versaoTermos === VERSAO_TERMOS
  );
}
