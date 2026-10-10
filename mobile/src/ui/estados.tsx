/**
 * Componentes reutilizaveis de estado de tela: carregando, erro (com botao de
 * tentar novamente) e mensagem vazia. Centralizam o feedback visual em PT-BR e
 * garantem que falhas de rede NAO derrubem o app (sempre ha uma tela de erro).
 *
 * Referencias:
 *   - ActivityIndicator: https://reactnative.dev/docs/activityindicator
 *   - Pressable: https://reactnative.dev/docs/pressable
 *
 * Onde e aplicado: usado por todas as telas em src/screens/*.
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export function EstadoCarregando({ texto }: { texto?: string }) {
  return (
    <View style={styles.centro}>
      <ActivityIndicator size="large" color="#0B6E4F" />
      <Text style={styles.textoNeutro}>{texto ?? 'Carregando...'}</Text>
    </View>
  );
}

export function EstadoErro({
  mensagem,
  aoTentarNovamente,
}: {
  mensagem: string;
  aoTentarNovamente?: () => void;
}) {
  return (
    <View style={styles.centro}>
      <Text style={styles.icone}>⚠️</Text>
      <Text style={styles.textoErro}>{mensagem}</Text>
      {aoTentarNovamente ? (
        <Pressable
          style={styles.botao}
          onPress={aoTentarNovamente}
          accessibilityRole="button"
        >
          <Text style={styles.botaoTexto}>Tentar novamente</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EstadoVazio({ mensagem }: { mensagem: string }) {
  return (
    <View style={styles.centro}>
      <Text style={styles.textoNeutro}>{mensagem}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  icone: {
    fontSize: 32,
  },
  textoNeutro: {
    color: '#555555',
    fontSize: 15,
    textAlign: 'center',
  },
  textoErro: {
    color: '#B00020',
    fontSize: 15,
    textAlign: 'center',
  },
  botao: {
    marginTop: 8,
    backgroundColor: '#0B6E4F',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  botaoTexto: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
