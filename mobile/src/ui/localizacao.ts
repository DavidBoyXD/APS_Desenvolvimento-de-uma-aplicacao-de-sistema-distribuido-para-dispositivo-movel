/**
 * Wrapper protegido do `expo-location` para o "Você está aqui" no mapa.
 *
 * Objetivo: obter a posição atual do aparelho (latitude/longitude) APENAS para
 * desenhar o marcador "Você está aqui" no mapa, no próprio dispositivo. A
 * coordenada NUNCA é enviada ao back-end (ver src/screens/MapaVisualScreen.tsx).
 *
 * Por que o acesso ao expo-location é ISOLADO aqui (mesmo padrão de
 * src/ui/webview.ts e src/ui/favoritos.ts):
 *   1. ROBUSTEZ EM RUNTIME. `expo-location` é um módulo com código NATIVO.
 *      Carregamos via `require` dentro de try/catch: se o pacote não resolver
 *      (ex.: ambiente sem o módulo nativo), devolvemos o status 'indisponivel'
 *      e a tela de mapa segue funcionando normalmente, sem derrubar o app.
 *   2. TYPECHECK SEM O PACOTE INSTALADO. Neste ambiente o `expo-location` ainda
 *      NÃO está em node_modules: ele é apenas adicionado ao package.json e o
 *      usuário roda `npx expo install expo-location` na máquina dele. Um import
 *      estático faria o `tsc --noEmit` falhar por não achar a tipagem. Por isso
 *      o único ponto de contato com o pacote fica ISOLADO neste wrapper, com
 *      `require` tipado como `any` e um contrato LOCAL mínimo declarado abaixo.
 *
 * IMPORTANTE (LGPD): esta função NÃO decide consentimento. Ela só pode ser
 * chamada por quem JÁ verificou o consentimento explícito de localização
 * (consentiuLocalizacao === true em src/ui/consentimento.ts). Nada de pedir
 * permissão de SO antes do "sim" do usuário.
 *
 * Onde é aplicado: tela de Mapa Visual (src/screens/MapaVisualScreen.tsx),
 * no controle flutuante "Você está aqui".
 */

/**
 * Contrato LOCAL mínimo do expo-location que usamos. Propositalmente frouxo para
 * permitir o typecheck sem o pacote instalado; a API real do SDK 58 é
 * compatível (confirmado em https://docs.expo.dev/versions/v58.0.0/sdk/location/).
 */
interface ApiLocalizacao {
  hasServicesEnabledAsync(): Promise<boolean>;
  requestForegroundPermissionsAsync(): Promise<{ status: string }>;
  getCurrentPositionAsync(opcoes: Record<string, unknown>): Promise<{
    coords: { latitude: number; longitude: number };
  }>;
}

/**
 * Resultado da tentativa de obter a posição atual. Nunca lança; sempre devolve
 * um `status` que a tela trata sem derrubar o mapa:
 *   - 'ok': posição obtida (latitude/longitude preenchidos);
 *   - 'sem_permissao': o SO negou (ou não concedeu) a permissão de localização;
 *   - 'servico_desligado': os serviços de localização do aparelho estão off;
 *   - 'indisponivel': o módulo nativo não resolveu (ex.: Expo Go sem o pacote);
 *   - 'erro': falha inesperada ao obter a posição.
 */
export interface ResultadoLocalizacao {
  status: 'ok' | 'sem_permissao' | 'servico_desligado' | 'indisponivel' | 'erro';
  latitude?: number;
  longitude?: number;
}

/**
 * Carrega o módulo expo-location de forma protegida. Retorna a API quando
 * disponível, ou `null` quando o pacote não resolve. NUNCA lança.
 */
function carregarLocalizacao(): ApiLocalizacao | null {
  try {
    // `require` dinâmico tipado como any de propósito: isola o único ponto de
    // contato com o pacote nativo, para o tsc não precisar da tipagem e o
    // runtime poder cair no fallback ('indisponivel') se o módulo não existir.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: any = require('expo-location');
    const api = mod?.default ?? mod;
    if (
      api &&
      typeof api.hasServicesEnabledAsync === 'function' &&
      typeof api.requestForegroundPermissionsAsync === 'function' &&
      typeof api.getCurrentPositionAsync === 'function'
    ) {
      return api as ApiLocalizacao;
    }
    return null;
  } catch {
    return null;
  }
}

const localizacao = carregarLocalizacao();

/**
 * Obtém a posição atual do aparelho, de forma defensiva e tolerante a falha.
 *
 * Ordem de verificação (curto-circuito a cada etapa):
 *   1. módulo não resolve                    -> 'indisponivel';
 *   2. hasServicesEnabledAsync() === false    -> 'servico_desligado';
 *   3. requestForegroundPermissionsAsync()    -> status !== 'granted' => 'sem_permissao';
 *   4. getCurrentPositionAsync({})            -> 'ok' com latitude/longitude.
 *
 * ATENÇÃO: o passo 3 pede a permissão de SO. Só chame esta função depois de
 * confirmar o consentimento explícito de localização (consentiuLocalizacao).
 */
export async function obterPosicaoAtual(): Promise<ResultadoLocalizacao> {
  if (!localizacao) {
    return { status: 'indisponivel' };
  }
  try {
    const servicosLigados = await localizacao.hasServicesEnabledAsync();
    if (!servicosLigados) {
      return { status: 'servico_desligado' };
    }
    const { status } = await localizacao.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { status: 'sem_permissao' };
    }
    const posicao = await localizacao.getCurrentPositionAsync({});
    const coords = posicao?.coords;
    if (
      !coords ||
      typeof coords.latitude !== 'number' ||
      typeof coords.longitude !== 'number'
    ) {
      return { status: 'erro' };
    }
    return {
      status: 'ok',
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
  } catch {
    // Qualquer falha inesperada vira 'erro': o mapa e as demais funções seguem.
    return { status: 'erro' };
  }
}
