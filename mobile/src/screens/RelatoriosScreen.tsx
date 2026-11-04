/**
 * Tela de relatórios: consome GET /api/v1/relatorios/regiao/{id} e exibe as
 * agregações (média, mínimo, máximo, contagem, último valor) por parâmetro/tipo.
 * Cobre o requisito de "relatórios adicionais" da APS. A agregação é genérica
 * por (tipo, parametro), então o novo tipo transporte_publico (SPTrans) entra
 * automaticamente nos cards e no gráfico de barras quando há medições.
 *
 * Além da exibição tabular (FlatList de cards), a tela apresenta um GRÁFICO de
 * barras com as médias por parâmetro, resumindo visualmente os dados agregados.
 *
 * Biblioteca de gráfico: react-native-chart-kit (BarChart).
 *   - npm:    https://www.npmjs.com/package/react-native-chart-kit
 *   - GitHub: https://github.com/indiespirit/react-native-chart-kit
 * Por que foi escolhida: é compatível com o stack atual (Expo SDK 57, React 19.2.3,
 * React Native 0.86.3) e sua única dependência nativa é o react-native-svg, que é
 * um módulo suportado pelo Expo (instalado via `npx expo install`). Alternativas
 * como react-native-gifted-charts (exige react-native-linear-gradient nativo) e
 * victory-native (peer dependencies mais pesadas) foram descartadas por adicionarem
 * dependências nativas extras.
 * Onde é aplicado: renderizada no cabeçalho desta tela (rota "Relatorios" em App.tsx),
 * acima da lista tabular. As demais telas (Mapa, Detalhe, Alertas) não são afetadas.
 *
 * Referências:
 *   - FlatList: https://reactnative.dev/docs/flatlist
 *   - useWindowDimensions: https://reactnative.dev/docs/usewindowdimensions
 *   - BarChart (react-native-chart-kit): https://github.com/indiespirit/react-native-chart-kit#bar-chart
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BarChart } from 'react-native-chart-kit';

import { getRelatorio, ApiError } from '../api/client';
import { RelatorioRegiao, ResumoRelatorio } from '../types';
import { RootStackParamList } from '../navigation';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../ui/estados';
import {
  formatarNumero,
  formatarTimestamp,
  rotuloParametro,
  rotuloTipo,
} from '../ui/rotulos';

type Props = NativeStackScreenProps<RootStackParamList, 'Relatorios'>;

export default function RelatoriosScreen({ route }: Props) {
  const { regiaoId } = route.params;
  const { width: larguraJanela } = useWindowDimensions();
  const [relatorio, setRelatorio] = useState<RelatorioRegiao | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  // Detalhe técnico da falha (URL chamada e causa), exibido para diagnóstico.
  const [detalheErro, setDetalheErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setDetalheErro(null);
    try {
      const dados = await getRelatorio(regiaoId);
      setRelatorio(dados);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.mensagem
          : 'Ocorreu um erro inesperado ao carregar o relatorio.';
      setErro(msg);
      setDetalheErro(e instanceof ApiError ? e.detalhe ?? null : null);
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
    return (
      <EstadoErro
        mensagem={erro}
        detalhe={detalheErro}
        aoTentarNovamente={carregar}
      />
    );
  }

  if (!relatorio || relatorio.resumos.length === 0) {
    return (
      <EstadoVazio mensagem="Sem dados suficientes para gerar o relatorio desta regiao." />
    );
  }

  const renderItem = ({ item }: { item: ResumoRelatorio }) => (
    <View style={styles.card}>
      <View style={styles.cardTopo}>
        <Text style={styles.cardParametro}>
          {rotuloParametro(item.parametro)}
        </Text>
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

  const cabecalho = (
    <View>
      <View style={styles.cabecalho}>
        <Text style={styles.cabecalhoTitulo}>
          {relatorio.regiao.nome} - {relatorio.regiao.cidade}/{relatorio.regiao.uf}
        </Text>
        <Text style={styles.cabecalhoSubtitulo}>
          Total de medicoes: {formatarNumero(relatorio.total_medicoes)}
        </Text>
      </View>
      <GraficoMedias resumos={relatorio.resumos} larguraJanela={larguraJanela} />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={relatorio.resumos}
        keyExtractor={(item) => `${item.tipo}-${item.parametro}`}
        contentContainerStyle={styles.lista}
        ListHeaderComponent={cabecalho}
        renderItem={renderItem}
      />
    </View>
  );
}

/**
 * Gráfico de barras com a média de cada par (tipo/parâmetro) do relatório.
 * Usa BarChart do react-native-chart-kit. Trata dataset vazio: se não houver
 * resumos, nada é renderizado, evitando quebra em runtime.
 */
function GraficoMedias({
  resumos,
  larguraJanela,
}: {
  resumos: ResumoRelatorio[];
  larguraJanela: number;
}) {
  if (resumos.length === 0) {
    return null;
  }

  // Compõe o rótulo com o tipo além do parâmetro. O relatório agrega por
  // (tipo, parametro), então parâmetros de mesmo nome em tipos diferentes
  // gerariam rótulos duplicados no eixo X se usássemos apenas o parâmetro.
  const labels = resumos.map(
    (item) => `${rotuloTipo(item.tipo)} - ${rotuloParametro(item.parametro)}`,
  );
  const valores = resumos.map((item) =>
    Number.isFinite(item.media) ? item.media : 0,
  );

  // Margem horizontal total do container (16 de cada lado).
  const larguraGrafico = Math.max(larguraJanela - 32, 0);

  return (
    <View style={styles.graficoCartao}>
      <Text style={styles.graficoTitulo}>Medias por parametro</Text>
      <BarChart
        data={{ labels, datasets: [{ data: valores }] }}
        width={larguraGrafico}
        height={220}
        yAxisLabel=""
        yAxisSuffix=""
        fromZero
        showValuesOnTopOfBars
        verticalLabelRotation={30}
        chartConfig={chartConfig}
        style={styles.grafico}
      />
    </View>
  );
}

/**
 * Configuração visual do gráfico. A função `color` define a cor base de barras e
 * rótulos; é a única propriedade obrigatória do chartConfig além da formatação.
 */
const chartConfig = {
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(11, 110, 79, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
  barPercentage: 0.6,
};

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
  graficoCartao: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    alignItems: 'center',
  },
  graficoTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  grafico: {
    borderRadius: 8,
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
