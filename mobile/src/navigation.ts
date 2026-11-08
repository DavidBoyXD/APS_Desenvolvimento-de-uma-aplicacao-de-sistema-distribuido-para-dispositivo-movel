/**
 * Definição dos parâmetros de rota da navegação (React Navigation, native stack).
 *
 * Referência (tipagem com TypeScript no React Navigation):
 *   https://reactnavigation.org/docs/typescript/
 *
 * Onde é aplicado: App.tsx registra o Stack.Navigator com estas rotas e cada
 * tela em src/screens/* tipa suas props via NativeStackScreenProps<RootStackParamList, 'Nome'>.
 */

export type RootStackParamList = {
  /** Tela inicial: mapa com as regiões monitoradas. */
  Mapa: undefined;
  /** Detalhe de uma região (medições por tipo). Recebe id e nome da região. */
  Detalhe: { regiaoId: number; regiaoNome: string };
  /** Relatório agregado de uma região. */
  Relatorios: { regiaoId: number; regiaoNome: string };
  /** Alertas: listar regras, criar e avaliar. */
  Alertas: undefined;
  /** Linhas de ônibus: buscar linha/parada, ver posição e previsão (SPTrans). */
  Linhas: undefined;
  /**
   * Mapa visual (tela OPCIONAL e SEPARADA, nunca a inicial). Sem parâmetros,
   * plota as regiões monitoradas como marcadores. Com `codigoLinha`, plota a
   * posição em tempo real dos veículos daquela linha (SPTrans); `linhaRotulo`
   * é apenas o letreiro usado no título/legenda.
   *
   * É intencionalmente separada da tela inicial (a LISTA de regiões em "Mapa"):
   * se o mapa nativo falhar, só esta tela é afetada e o app continua abrindo.
   */
  MapaVisual: { codigoLinha?: number; linhaRotulo?: string } | undefined;
  /**
   * Fluxo de CONSENTIMENTO (LGPD) exibido na primeira abertura (ou quando a
   * versão dos Termos muda). `aoConcluir` é o callback que o gate em App.tsx
   * injeta para liberar a navegação principal após ACEITAR/RECUSAR.
   */
  Consentimento: { aoConcluir?: () => void } | undefined;
  /** Política de Privacidade (texto legível, sem WebView). */
  PoliticaPrivacidade: undefined;
  /** Termos de Uso (texto legível, sem WebView). */
  TermosDeUso: undefined;
  /**
   * Privacidade / Direitos do titular (LGPD): ver os dados guardados LOCALMENTE
   * no aparelho, excluí-los e revogar o consentimento de localização.
   */
  Privacidade: undefined;
};
