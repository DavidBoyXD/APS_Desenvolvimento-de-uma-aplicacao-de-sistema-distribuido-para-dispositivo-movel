/**
 * Tela de relatorios: consome GET /api/v1/relatorios/regiao/{id} e exibe as
 * agregacoes (media, minimo, maximo, contagem, ultimo valor) por parametro/tipo.
 * Cobre o requisito de "relatorios adicionais" da APS.
 *
 * Referencias:
 *   - FlatList: https://reactnative.dev/docs/flatlist
 *
 * Onde e aplicado: rota "Relatorios" em App.tsx.
 */

import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getRelatorio, ApiError } from '../api/client';
import { RelatorioRegiao, ResumoRelatorio } from '../types';
import { RootStackParamList } from '../navigation';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../ui/estados';
import { formatarNumero, formatarTimestamp, rotuloTipo } from '../ui/rotulos';

type Props = NativeStackScreenProps<RootStackParamList, 'Relatorios'>;

export default function RelatoriosScreen({ route }: Props) {
  const { regiaoId } = route.params;
  const [relatorio, setRelatorio] = useState<RelatorioRegiao | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await getRelatorio(regiaoId);
      setRelatorio(dados);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.mensagem
          : 'Ocorreu um erro inesperado ao carregar o relatorio.';
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  }, [regiaoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando) {
    return <EstadoCarregando texto="Gerando relatorio..." />;
  }

  if (erro) {
    return <EstadoErro mensagem={erro} aoTentarNovamente={carregar} />;
  }

  if (!relatorio || relatorio.resumos.length === 0) {
    return (
      <EstadoVazio mensagem="Sem dados suficientes para gerar o relatorio desta regiao." />
    );
  }

  const renderItem = ({ item }: { item: ResumoRelatorio }) => (
    <View style={styles.card}>
      <View style={styles.cardTopo}>
        <Text style={styles.cardParametro}>{item.parametro}</Text>
        <Text style={styles.cardTipo}>{rotuloTipo(item.tipo)}</Text>
      </View>
      <View style={styles.grade}>
        <Metrica rotulo="Media" valor={`${formatarNumero(item.media)} ${item.unidade}`} />
        <Metrica rotulo="Minimo" valor={`${formatarNumero(item.minimo)} ${item.unidade}`} />
        <Metrica rotulo="Maximo" valor={`${formatarNumero(item.maximo)} ${item.unidade}`} />
        <Metrica rotulo="Amostras" valor={formatarNumero(item.contagem)} />
      </View>
      <Text style={styles.cardUltimo}>
        Ultimo: {formatarNumero(item.ultimo_valor)} {item.unidade} em{' '}
        {formatarTimestamp(item.ultimo_timestamp)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.cabecalho}>
        <Text style={styles.cabecalhoTitulo}>
          {relatorio.regiao.nome} - {relatorio.regiao.cidade}/{relatorio.regiao.uf}
        </Text>
        <Text style={styles.cabecalhoSubtitulo}>
          Total de medicoes: {formatarNumero(relatorio.total_medicoes)}
        </Text>
      </View>
      <FlatList
        data={relatorio.resumos}
        keyExtractor={(item) => `${item.tipo}-${item.parametro}`}
        contentContainerStyle={styles.lista}
        renderItem={renderItem}
      />
    </View>
  );
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.metrica}>
      <Text style={styles.metricaRotulo}>{rotulo}</Text>
      <Text style={styles.metricaValor}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6',
  },
  cabecalho: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cabecalhoTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cabecalhoSubtitulo: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  lista: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardParametro: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  cardTipo: {
    fontSize: 12,
    color: '#0B6E4F',
    fontWeight: '600',
  },
  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metrica: {
    minWidth: '40%',
  },
  metricaRotulo: {
    fontSize: 12,
    color: '#64748B',
  },
  metricaValor: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  cardUltimo: {
    marginTop: 10,
    fontSize: 12,
    color: '#94A3B8',
  },
});
