/**
 * Catálogo e persistência do ESTILO CARTOGRÁFICO do mapa.
 *
 * O mapa (WebView + Leaflet) pode ser desenhado com diferentes camadas de
 * tiles, todas CARTOGRÁFICAS (NÃO satélite) e SEM chave de API:
 *   - "Padrão": OpenStreetMap;
 *   - "Claro": CARTO Positron (fundo claro, bom contraste com os marcadores);
 *   - "Escuro": CARTO Dark Matter (fundo escuro).
 *
 * Cada estilo guarda a URL de tiles, o zoom máximo e a ATRIBUIÇÃO correta do
 * provedor (OSM e/ou CARTO), exigida pelas respectivas licenças de uso e
 * exibida no canto do mapa pela Leaflet.
 *
 * A troca de estilo NÃO recria o mapa: a tela injeta JS no WebView chamando
 * `window.trocarEstiloMapa(id)`, que remove a tileLayer atual e adiciona a nova
 * preservando os marcadores (ver src/screens/MapaVisualScreen.tsx).
 *
 * A preferência é persistida localmente no aparelho via AsyncStorage, no MESMO
 * padrão protegido de src/ui/favoritos.ts (require isolado, tipagem local,
 * fallback EM MEMÓRIA): assim o typecheck passa sem o pacote instalado e a UI
 * nunca quebra; se o storage não existir, a preferência vale só na sessão.
 *
 * Onde é aplicado: src/screens/MapaVisualScreen.tsx.
 */

/** Identificador estável de cada estilo cartográfico oferecido. */
export type EstiloMapaId = 'padrao' | 'claro' | 'escuro';

/** Definição de um estilo cartográfico (camada de tiles do Leaflet). */
export interface EstiloMapa {
  id: EstiloMapaId;
  /** Rótulo PT-BR exibido no seletor. */
  rotulo: string;
  /** Template de URL de tiles compatível com a Leaflet (com {s}/{z}/{x}/{y}). */
  url: string;
  /** Zoom máximo suportado pela camada. */
  maxZoom: number;
  /** Texto de atribuição do provedor (exibido no canto do mapa). */
  atribuicao: string;
}

/**
 * Lista ordenada dos estilos cartográficos disponíveis. Todos sem chave e sem
 * satélite. O primeiro ("padrao") é o estilo inicial padrão.
 */
export const ESTILOS_MAPA: EstiloMapa[] = [
  {
    id: 'padrao',
    rotulo: 'Padrao',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    atribuicao: '&copy; colaboradores do OpenStreetMap',
  },
  {
    id: 'claro',
    rotulo: 'Claro',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    maxZoom: 20,
    atribuicao:
      '&copy; colaboradores do OpenStreetMap &copy; CARTO',
  },
  {
    id: 'escuro',
    rotulo: 'Escuro',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    maxZoom: 20,
    atribuicao:
      '&copy; colaboradores do OpenStreetMap &copy; CARTO',
  },
];

/** Estilo inicial padrão (OpenStreetMap), usado quando não há preferência. */
export const ESTILO_PADRAO: EstiloMapaId = 'padrao';

/** Retorna a definição de um estilo pelo id, caindo no padrão se desconhecido. */
export function estiloPorId(id: EstiloMapaId): EstiloMapa {
  return ESTILOS_MAPA.find((estilo) => estilo.id === id) ?? ESTILOS_MAPA[0];
}

/**
 * Contrato LOCAL mínimo do AsyncStorage que usamos (mesmo padrão de
 * src/ui/favoritos.ts). Propositalmente frouxo para permitir o typecheck sem o
 * pacote instalado; a API real é compatível.
 */
interface ArmazenamentoChaveValor {
  getItem(chave: string): Promise<string | null>;
  setItem(chave: string, valor: string): Promise<void>;
  removeItem(chave: string): Promise<void>;
}

/** Chave única usada no AsyncStorage para a preferência de estilo do mapa. */
const CHAVE_ESTILO = '@aps:mapa:estilo';

/**
 * Carrega o módulo de AsyncStorage de forma protegida (require isolado dentro
 * de try/catch). Retorna o armazenamento quando disponível, ou `null` quando o
 * pacote não resolve. NUNCA lança.
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

/** Cache EM MEMÓRIA da preferência (fallback e leitura rápida). */
let cacheEstilo: EstiloMapaId | null = null;

/** Valida se um texto corresponde a um id de estilo conhecido. */
function ehEstiloValido(valor: string | null): valor is EstiloMapaId {
  return (
    valor === 'padrao' || valor === 'claro' || valor === 'escuro'
  );
}

/**
 * Carrega a preferência de estilo do aparelho. Em qualquer falha de storage (ou
 * ausência do pacote), devolve o estilo padrão, nunca lançando.
 */
export async function carregarEstiloMapa(): Promise<EstiloMapaId> {
  if (cacheEstilo !== null) {
    return cacheEstilo;
  }
  if (!armazenamento) {
    cacheEstilo = ESTILO_PADRAO;
    return cacheEstilo;
  }
  try {
    const valor = await armazenamento.getItem(CHAVE_ESTILO);
    cacheEstilo = ehEstiloValido(valor) ? valor : ESTILO_PADRAO;
  } catch {
    cacheEstilo = ESTILO_PADRAO;
  }
  return cacheEstilo;
}

/**
 * Persiste a preferência de estilo, ignorando erros de escrita com segurança
 * (mantém ao menos o cache em memória para a sessão atual).
 */
export async function salvarEstiloMapa(id: EstiloMapaId): Promise<void> {
  cacheEstilo = id;
  if (!armazenamento) {
    return;
  }
  try {
    await armazenamento.setItem(CHAVE_ESTILO, id);
  } catch {
    // Falha de escrita: mantém apenas o cache em memória nesta sessão.
  }
}
