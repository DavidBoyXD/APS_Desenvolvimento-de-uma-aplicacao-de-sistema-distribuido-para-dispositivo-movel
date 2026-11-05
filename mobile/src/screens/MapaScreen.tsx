/**
 * Tela inicial: lista das regiões monitoradas em São Paulo (requisito de consulta
 * por região da APS). Carrega as regiões da API e permite tocar em cada uma para
 * abrir o Detalhe. Também oferece acesso rápido aos Alertas.
 *
 * A tela trata os três estados de carregamento de dados: carregando, erro (com
 * opção de tentar novamente) e vazio (nenhuma região cadastrada). Em qualquer
 * plataforma (Android, iOS ou web) o conteúdo é a mesma lista clicável, sem
 * dependência de módulos nativos de mapa, garantindo que a tela SEMPRE abra.
 *
 * Referências:
 *   - FlatList: https://reactnative.dev/docs/flatlist
 *
 * Onde é aplicado: registrada como rota "Mapa" em App.tsx.
 */

import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getRegioes, ApiError } from '../api/client';
import { Regiao } from '../types';
import { RootStackParamList } from '../navigation';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../ui/estados';

type Props = NativeStackScreenProps<RootStackParamList, 'Mapa'>;

export default function MapaScreen({ navigation }: Props) {
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  // Detalhe técnico da falha (URL chamada e causa), exibido para diagnóstico.
  const [detalheErro, setDetalheErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setDetalheErro(null);
    try {
      const dados = await getRegioes();
      setRegioes(dados);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.mensagem
          : 'Ocorreu um erro inesperado ao carregar as regioes.';
      setErro(msg);
      setDetalheErro(e instanceof ApiError ? e.detalhe ?? null : null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirDetalhe = useCallback(
    (regiao: Regiao) => {
      navigation.navigate('Detalhe', {
        regiaoId: regiao.id,
        regiaoNome: regiao.nome,
      });
    },
    [navigation],
  );

  if (carregando) {
    return <EstadoCarregando texto="Carregando regioes..." />;
  }

  if (erro) {
    return (
      <EstadoErro
        mensagem={erro}
        detalhe={detalheErro}
        aoTentarNovamente={carregar}
      />
    );
  }

  if (regioes.length === 0) {
    return (
      <EstadoVazio mensagem="Nenhuma regiao de Sao Paulo cadastrada no servidor." />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.listaCabecalho}>
        <Text style={styles.listaTitulo}>Regioes monitoradas em Sao Paulo</Text>
        <View style={styles.cabecalhoAcoes}>
          {/*
            "Ver no mapa" abre a tela de mapa visual (OPCIONAL e SEPARADA). Se o
            mapa falhar, o usuario volta para esta lista, que e a tela inicial e
            nunca depende do modulo nativo de mapa.
          */}
          <Pressable
            style={styles.botaoAlertas}
            onPress={() => navigation.navigate('MapaVisual')}
            accessibilityRole="button"
          >
            <Text style={styles.botaoAlertasTexto}>Ver no mapa</Text>
          </Pressable>
          <Pressable
            style={styles.botaoAlertas}
            onPress={() => navigation.navigate('Linhas')}
            accessibilityRole="button"
          >
            <Text style={styles.botaoAlertasTexto}>Linhas de onibus</Text>
          </Pressable>
          <Pressable
            style={styles.botaoAlertas}
            onPress={() => navigation.navigate('Alertas')}
            accessibilityRole="button"
          >
            <Text style={styles.botaoAlertasTexto}>Ver alertas</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={regioes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listaConteudo}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => abrirDetalhe(item)}
            accessibilityRole="button"
          >
            <Text style={styles.cardTitulo}>{item.nome}</Text>
            <Text style={styles.cardSubtitulo}>
              {item.cidade} - {item.uf}
            </Text>
            <Text style={styles.cardCoords}>
              lat {item.latitude.toFixed(2)}, lon {item.longitude.toFixed(2)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6',
  },
  listaCabecalho: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  listaTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  cabecalhoAcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  botaoAlertas: {
    backgroundColor: '#0B6E4F',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  botaoAlertasTexto: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listaConteudo: {
    padding: 16,
    paddingTop: 4,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitulo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  cardSubtitulo: {
    fontSize: 14,
    color: '#475569',
    marginTop: 2,
  },
  cardCoords: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
});
