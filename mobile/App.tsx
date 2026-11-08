/**
 * Componente raiz do app "Monitoramento de transporte público em SP".
 *
 * Configura a navegacao em pilha (native stack) do React Navigation e registra
 * as telas do sistema: Mapa (lista inicial), Detalhe, Relatorios, Alertas,
 * Linhas e MapaVisual (mapa opcional e separado, nunca a tela inicial).
 *
 * Referencias:
 *   - React Navigation (getting started): https://reactnavigation.org/docs/getting-started
 *   - Native Stack Navigator: https://reactnavigation.org/docs/native-stack-navigator
 *
 * Onde e aplicado: este e o entrypoint de UI (registrado por index.ts do Expo).
 */

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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName="Mapa"
          screenOptions={{
            headerStyle: { backgroundColor: '#0B6E4F' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: '600' },
          }}
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
              title: `Relatorio: ${route.params.regiaoNome}`,
            })}
          />
          <Stack.Screen
            name="Alertas"
            component={AlertasScreen}
            options={{ title: 'Alertas do transporte' }}
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
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
