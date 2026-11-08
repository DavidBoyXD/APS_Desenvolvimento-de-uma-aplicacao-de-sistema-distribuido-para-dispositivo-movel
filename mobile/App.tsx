/**
 * Componente raiz do app "Monitoramento de transporte público em SP".
 *
 * Configura a navegacao em pilha (native stack) do React Navigation e registra
 * as telas do sistema: Mapa (lista inicial), Detalhe, Relatorios, Alertas,
 * Linhas e MapaVisual (mapa opcional e separado, nunca a tela inicial).
 *
 * GATE DE CONSENTIMENTO (LGPD): na primeira abertura (ou quando a versao dos
 * Termos muda), o app NAO libera a navegacao principal antes de o usuario
 * RESPONDER ao aviso. Enquanto le o registro de consentimento do armazenamento
 * local, mostra um estado de carregamento; se ainda NAO ha resposta para a
 * versao vigente dos Termos, exibe o fluxo de Consentimento (com acesso a
 * Politica e Termos). Nada de localizacao/permissao e acionado antes do aceite.
 *
 * Apos ACEITAR ou RECUSAR, a tela de Consentimento apenas GRAVA o registro no
 * armazenamento e pede que o App REAVALIE o consentimento (relendo o registro):
 * nao ha callback passado por params de rota (que seria nao-serializavel). Uma
 * vez respondido para a versao atual, o aviso NAO reaparece a cada abertura;
 * o reconsentimento so volta quando a VERSAO_TERMOS muda. RECUSAR nao trava o
 * app (segue sem o "Voce esta aqui").
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
import PrivacidadeScreen from './src/screens/PrivacidadeScreen';
import { EstadoCarregando } from './src/ui/estados';
import {
  carregarConsentimento,
  temRespostaConsentimento,
} from './src/ui/consentimento';
import { ReavaliarConsentimentoProvider } from './src/ui/consentimentoContexto';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Opcoes compartilhadas de cabecalho (paleta verde da aplicacao). */
const screenOptions = {
  headerStyle: { backgroundColor: '#0B6E4F' },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: '600' as const },
};

export default function App() {
  // `null` = ainda lendo o armazenamento (estado de carregamento);
  // `true`/`false` = ja sabemos se o usuario JA RESPONDEU ao gate da versao
  // vigente (aceitou OU recusou). `true` libera a navegacao principal.
  const [respondido, setRespondido] = useState<boolean | null>(null);

  // Reavalia o consentimento RELENDO o registro do armazenamento. E chamado no
  // boot (useEffect) e pela tela de Consentimento (via Context) apos gravar o
  // registro em ACEITAR/RECUSAR — dispensando qualquer callback por params de
  // rota (que seria nao-serializavel).
  const reavaliarConsentimento = useCallback(async () => {
    const registro = await carregarConsentimento();
    setRespondido(temRespostaConsentimento(registro));
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const registro = await carregarConsentimento();
      if (ativo) {
        setRespondido(temRespostaConsentimento(registro));
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (respondido === null) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <EstadoCarregando texto="Carregando..." />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ReavaliarConsentimentoProvider value={reavaliarConsentimento}>
        <NavigationContainer>
          <StatusBar style="light" />
          {respondido ? (
            <Stack.Navigator
              initialRouteName="Mapa"
              screenOptions={screenOptions}
            >
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
              <Stack.Screen
                name="Privacidade"
                component={PrivacidadeScreen}
                options={{ title: 'Privacidade' }}
              />
            </Stack.Navigator>
          ) : (
            /*
              Fluxo de consentimento: enquanto o usuario NAO respondeu ao aviso
              (para a versao vigente), esta e a UNICA navegacao disponivel. A
              tela de Consentimento GRAVA a resposta no armazenamento e pede a
              reavaliacao do gate via Context (sem callback em params de rota) e
              da acesso a Politica e aos Termos (sem acionar qualquer permissao
              de localizacao).
            */
            <Stack.Navigator
              initialRouteName="Consentimento"
              screenOptions={screenOptions}
            >
              <Stack.Screen
                name="Consentimento"
                component={ConsentimentoScreen}
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
      </ReavaliarConsentimentoProvider>
    </SafeAreaProvider>
  );
}
