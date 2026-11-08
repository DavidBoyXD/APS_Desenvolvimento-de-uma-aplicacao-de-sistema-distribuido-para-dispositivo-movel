/**
 * Contexto do GATE DE CONSENTIMENTO (LGPD).
 *
 * Objetivo: permitir que a tela de Consentimento peça ao App.tsx para REAVALIAR
 * o consentimento (relendo o registro do armazenamento) DEPOIS de gravar a
 * resposta do usuário em ACEITAR/RECUSAR, SEM passar uma função por params de
 * rota. Funções não são serializáveis; passá-las via `initialParams` dispara o
 * aviso "Non-serializable values were found in the navigation state" do React
 * Navigation e quebra persistência de estado/deep linking daquela rota.
 *
 * Em vez disso, o App.tsx expõe `reavaliarConsentimento` por este Context e a
 * tela de Consentimento o consome com `useReavaliarConsentimento()`.
 *
 * Onde é aplicado: provido em App.tsx (Provider em volta do NavigationContainer)
 * e consumido em src/screens/ConsentimentoScreen.tsx.
 */

import { createContext, useContext } from 'react';

/**
 * Função que reavalia o consentimento relendo o armazenamento local e atualiza
 * o estado do gate. O valor padrão é um no-op seguro (nunca lança) para o caso
 * de a tela ser montada fora do Provider.
 */
export type ReavaliarConsentimento = () => void | Promise<void>;

const ReavaliarConsentimentoContexto = createContext<ReavaliarConsentimento>(
  () => {},
);

export const ReavaliarConsentimentoProvider =
  ReavaliarConsentimentoContexto.Provider;

/** Hook de conveniência para consumir a função de reavaliação do gate. */
export function useReavaliarConsentimento(): ReavaliarConsentimento {
  return useContext(ReavaliarConsentimentoContexto);
}
