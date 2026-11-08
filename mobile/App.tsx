/**
 * Componente raiz do app "Monitoramento de transporte público em SP".
 *
 * Configura a navegacao em pilha (native stack) do React Navigation e registra
 * as telas do sistema: Mapa (lista inicial), Detalhe, Relatorios, Alertas,
 * Linhas e MapaVisual (mapa opcional e separado, nunca a tela inicial).
 *
 * GATE DE CONSENTIMENTO (LGPD): na primeira abertura (ou quando a versao dos
 * Termos muda), o app NAO libera a navegacao principal antes do consentimento.
 * Enquanto le o registro de consentimento do armazenamento local, mostra um
 * estado de carregamento; sem consentimento valido, exibe o fluxo de
 * Consentimento (com acesso a Politica e Termos). Nada de localizacao/permissao
 * e acionado antes do aceite. Apos ACEITAR/RECUSAR, segue para a navegacao
 * normal (RECUSAR nao trava o app).
 *
 * Referencias:
 *   - React Navigation (getting started): https://reactnavigation.org/docs/getting-started
 *   - Native Stack Navigator: https://reactnavigation.org/docs/native-stack-navigator
 *
 * Onde e aplicado: este e o entrypoint de UI (registrado por index.ts do Expo).
 */

import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootStackParamList } from './src/navigation';
import MapaScreen from './src/screens/MapaScreen';
import DetalheScreen from './src/screens/DetalheScreen';
import RelatoriosScreen from './src/screens/RelatoriosScreen';
import AlertasScreen from './src/screens/AlertasScreen';
import LinhasScreen from './src/screens/LinhasScreen';
import MapaVisualScreen from './src/screens/MapaVisualScreen';
import ConsentimentoScreen from './src/screens/ConsentimentoScreen';
import PoliticaPrivacidadeScreen from './src/screens/PoliticaPrivacidadeScreen';
import TermosDeUsoScreen from './src/screens/TermosDeUsoScreen';
import { EstadoCarregando } from './src/ui/estados';
import {
  carregarConsentimento,
  temConsentimentoValido,
} from './src/ui/consentimento';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Opcoes compartilhadas de cabecalho (paleta verde da aplicacao). */
const screenOptions = {
  headerStyle: { backgroundColor: '#0B6E4F' },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: '600' as const },
};

export default function App() {
  // `null` = ainda lendo o armazenamento (estado de carregamento);
  // `true`/`false` = ja sabemos se ha consentimento valido.
  const [consentido, setConsentido] = useState<boolean | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const registro = await carregarConsentimento();
      if (ativo) {
        setConsentido(temConsentimentoValido(registro));
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  // Callback injetado na tela de Consentimento: apos ACEITAR/RECUSAR, libera a
  // navegacao principal. (RECUSAR tambem libera o app, apenas sem o GPS.)
  const liberarNavegacao = useCallback(() => {
    setConsentido(true);
  }, []);

  if (consentido === null) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <EstadoCarregando texto="Carregando..." />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        {consentido ? (
          <Stack.Navigator initialRouteName="Mapa" screenOptions={screenOptions}>
            <Stack.Screen
              name="Mapa"
              component={MapaScreen}
              options={{ title: 'Monitoramento de transporte público em SP' }}
            />
            <Stack.Screen
              name="Detalhe"
              component={DetalheScreen}
              options={({ route }) => ({ title: route.params.regiaoNome })}
            />
            <Stack.Screen
              name="Relatorios"
              component={RelatoriosScreen}
              options={({ route }) => ({
                title: `Relatório: ${route.params.regiaoNome}`,
              })}
            />
            <Stack.Screen
              name="Alertas"
              component={AlertasScreen}
              options={{ title: 'Alertas' }}
            />
            <Stack.Screen
              name="Linhas"
              component={LinhasScreen}
              options={{ title: 'Linhas de ônibus' }}
            />
            <Stack.Screen
              name="MapaVisual"
              component={MapaVisualScreen}
              options={({ route }) => ({
                title: route.params?.linhaRotulo
                  ? `Mapa: ${route.params.linhaRotulo}`
                  : 'Mapa',
              })}
            />
            <Stack.Screen
              name="PoliticaPrivacidade"
              component={PoliticaPrivacidadeScreen}
              options={{ title: 'Política de Privacidade' }}
            />
            <Stack.Screen
              name="TermosDeUso"
              component={TermosDeUsoScreen}
              options={{ title: 'Termos de Uso' }}
            />
          </Stack.Navigator>
        ) : (
          /*
            Fluxo de consentimento: enquanto NAO ha consentimento valido, esta e
            a UNICA navegacao disponivel. A tela de Consentimento recebe o
            callback para liberar a navegacao principal e da acesso a Politica e
            aos Termos (sem acionar qualquer permissao de localizacao).
          */
          <Stack.Navigator
            initialRouteName="Consentimento"
            screenOptions={screenOptions}
          >
            <Stack.Screen
              name="Consentimento"
              component={ConsentimentoScreen}
              initialParams={{ aoConcluir: liberarNavegacao }}
              options={{ title: 'Consentimento' }}
            />
            <Stack.Screen
              name="PoliticaPrivacidade"
              component={PoliticaPrivacidadeScreen}
              options={{ title: 'Política de Privacidade' }}
            />
            <Stack.Screen
              name="TermosDeUso"
              component={TermosDeUsoScreen}
              options={{ title: 'Termos de Uso' }}
            />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
