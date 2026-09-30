/**
 * Componente raiz do app "Monitor Ambiental Urbano".
 *
 * Configura a navegacao em pilha (native stack) do React Navigation e registra
 * as quatro telas do sistema: Mapa, Detalhe, Relatorios e Alertas.
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
            options={{ title: 'Monitor Ambiental Urbano' }}
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
            options={{ title: 'Alertas ambientais' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
