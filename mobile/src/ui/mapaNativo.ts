/**
 * Wrapper DEFENSIVO de carregamento do `react-native-maps`.
 *
 * Por que este arquivo existe:
 *   1. ROBUSTEZ EM RUNTIME. O `react-native-maps` e um modulo NATIVO. Se ele
 *      nao estiver presente no bundle (ou falhar ao resolver em uma plataforma
 *      onde nao e suportado, como a web), o `require` abaixo apenas devolve
 *      `null` e a tela de mapa cai no fallback (lista), em vez de derrubar o
 *      app. O import e feito via `require` dentro de try/catch, de propósito,
 *      para nao ser um import estatico de topo que quebraria o carregamento do
 *      modulo inteiro caso o pacote nao exista.
 *   2. TYPECHECK SEM O PACOTE INSTALADO. Neste ambiente o `react-native-maps`
 *      NAO esta em node_modules (ele e adicionado apenas ao package.json e o
 *      usuario roda `npx expo install react-native-maps` na maquina dele).
 *      Um import estatico (`import MapView from 'react-native-maps'`) faria o
 *      `tsc --noEmit` falhar por nao achar a tipagem. Por isso o acesso ao
 *      modulo fica ISOLADO aqui, com `require` tipado como `any` e tipos
 *      LOCAIS minimos declarados abaixo. Assim o restante do app importa estes
 *      tipos/carregador sem jamais referenciar o pacote diretamente.
 *
 * IMPORTANTE (limite desta protecao): este wrapper protege contra a AUSENCIA
 * do modulo e contra erros de resolucao/JS. Ele NAO protege contra um CRASH
 * NATIVO do Google Maps em runtime (ex.: chave da API ausente/invalida no
 * binario). A protecao real contra esse crash e ARQUITETURAL: o mapa vive em
 * uma tela SEPARADA e OPCIONAL (rota "MapaVisual"), nunca na inicializacao do
 * app. A tela inicial continua sendo a LISTA de regioes, que nao depende de
 * nenhum modulo nativo e sempre abre.
 */

import type { ComponentType } from 'react';

/** Coordenada geografica simples (compatível com react-native-maps). */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Regiao visivel do mapa (centro + amplitude), usada em `initialRegion`. */
export interface RegiaoMapa extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Tipos LOCAIS minimos dos componentes do react-native-maps que usamos. São
 * propositalmente frouxos (`any` nas props) para permitir o typecheck sem o
 * pacote instalado; a API real e compativel com estes contratos.
 */
export interface ModuloMapa {
  /** Componente MapView (default export do pacote). */
  MapView: ComponentType<any>;
  /** Componente Marker (named export do pacote). */
  Marker: ComponentType<any>;
  /** Constante de provider do Google Maps (passada em `provider`). */
  PROVIDER_GOOGLE: unknown;
}

/**
 * Tenta carregar o `react-native-maps` de forma protegida.
 *
 * Retorna o modulo (MapView/Marker/PROVIDER_GOOGLE) quando disponivel, ou
 * `null` quando o pacote nao esta instalado/nao resolve. NUNCA lanca: qualquer
 * falha vira `null` para a tela decidir o fallback.
 */
export function carregarModuloMapa(): ModuloMapa | null {
  try {
    // `require` dinamico e tipado como any de proposito: isola o unico ponto
    // de contato com o pacote nativo, de modo que o tsc nao precise da tipagem
    // e o runtime possa cair no fallback se o modulo nao existir.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: any = require('react-native-maps');
    const MapView = mod?.default ?? mod?.MapView;
    const Marker = mod?.Marker;
    const PROVIDER_GOOGLE = mod?.PROVIDER_GOOGLE;
    if (!MapView || !Marker) {
      return null;
    }
    return { MapView, Marker, PROVIDER_GOOGLE };
  } catch {
    return null;
  }
}
