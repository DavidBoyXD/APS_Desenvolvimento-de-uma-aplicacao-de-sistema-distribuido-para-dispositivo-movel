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
};
