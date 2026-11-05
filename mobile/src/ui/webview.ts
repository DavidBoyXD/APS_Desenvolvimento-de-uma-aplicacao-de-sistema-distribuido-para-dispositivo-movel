/**
 * Wrapper de carregamento do `react-native-webview`.
 *
 * Por que este arquivo existe:
 *   1. ROBUSTEZ EM RUNTIME. O `react-native-webview` e um modulo com codigo
 *      NATIVO (diferente de um pacote 100% JS). Ele e um modulo PADRAO, estavel
 *      e suportado pelo Expo (incluido no Expo Go), mas ainda assim preferimos
 *      carrega-lo via `require` dentro de try/catch: se por algum motivo o
 *      pacote nao resolver (ex.: execucao em uma plataforma onde o componente
 *      nao esteja disponivel), devolvemos `null` e a tela de mapa cai em um
 *      fallback amigavel, em vez de derrubar o app.
 *   2. TYPECHECK SEM O PACOTE INSTALADO. Neste ambiente o `react-native-webview`
 *      ainda NAO esta em node_modules: ele e apenas adicionado ao package.json e
 *      o usuario roda `npx expo install react-native-webview` na maquina dele.
 *      Um import estatico (`import { WebView } from 'react-native-webview'`)
 *      faria o `tsc --noEmit` falhar por nao achar a tipagem. Por isso o unico
 *      ponto de contato com o pacote fica ISOLADO aqui, com `require` tipado
 *      como `any` e um tipo LOCAL minimo declarado abaixo. Assim o restante do
 *      app importa o componente por este wrapper sem jamais referenciar o pacote
 *      diretamente, e o typecheck passa com ou sem o pacote instalado.
 *
 * Observacao importante: diferente do mapa nativo anterior (Google Maps via
 * `react-native-maps`), o `react-native-webview` NAO precisa de chave de API e
 * NAO traz a dependencia que quebrava a inicializacao do app. O mapa desenhado
 * dentro do WebView usa OpenStreetMap/Leaflet, que so requer internet para
 * baixar os tiles e a biblioteca Leaflet por CDN.
 */

import type { ComponentType } from 'react';

/**
 * Tipo LOCAL minimo do componente WebView que usamos. E propositalmente frouxo
 * (`any` nas props) para permitir o typecheck sem o pacote instalado; a API real
 * do `react-native-webview` e compativel com este contrato (source, style,
 * originWhitelist, onMessage, onError, etc.).
 */
export type ComponenteWebView = ComponentType<any>;

/**
 * Tenta carregar o componente WebView do `react-native-webview` de forma
 * protegida. Retorna o componente quando disponivel, ou `null` quando o pacote
 * nao resolve. NUNCA lanca: qualquer falha vira `null` para a tela decidir o
 * fallback.
 */
export function carregarWebView(): ComponenteWebView | null {
  try {
    // `require` dinamico tipado como any de proposito: isola o unico ponto de
    // contato com o pacote nativo, de modo que o tsc nao precise da tipagem e o
    // runtime possa cair no fallback se o modulo nao existir.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: any = require('react-native-webview');
    const WebView = mod?.WebView ?? mod?.default;
    return WebView ?? null;
  } catch {
    return null;
  }
}
