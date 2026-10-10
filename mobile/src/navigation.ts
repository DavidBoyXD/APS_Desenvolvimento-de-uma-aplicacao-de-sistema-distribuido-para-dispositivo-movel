/**
 * Definicao dos parametros de rota da navegacao (React Navigation, native stack).
 *
 * Referencia (tipagem com TypeScript no React Navigation):
 *   https://reactnavigation.org/docs/typescript/
 *
 * Onde e aplicado: App.tsx registra o Stack.Navigator com estas rotas e cada
 * tela em src/screens/* tipa suas props via NativeStackScreenProps<RootStackParamList, 'Nome'>.
 */

export type RootStackParamList = {
  /** Tela inicial: mapa com as regioes monitoradas. */
  Mapa: undefined;
  /** Detalhe de uma regiao (medicoes por tipo). Recebe id e nome da regiao. */
  Detalhe: { regiaoId: number; regiaoNome: string };
  /** Relatorio agregado de uma regiao. */
  Relatorios: { regiaoId: number; regiaoNome: string };
  /** Alertas: listar regras, criar e avaliar. */
  Alertas: undefined;
};
