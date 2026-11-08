/**
 * Tela de relatórios: consome GET /api/v1/relatorios/regiao/{id} e exibe as
 * agregações (média, mínimo, máximo, contagem, último valor) por parâmetro/tipo.
 * Cobre o requisito de "relatórios adicionais" da APS. A agregação é genérica
 * por (tipo, parametro), então o novo tipo transporte_publico (SPTrans) entra
 * automaticamente nos cards e no gráfico de barras quando há medições.
 *
 * Além da exibição tabular (FlatList de cards), a tela apresenta um GRÁFICO de
 * barras HORIZONTAIS com as médias por parâmetro, resumindo visualmente os
 * dados agregados.
 *
 * Por que barras renderizadas com Views (e não uma biblioteca de gráfico):
 * cada barra tem o seu RÓTULO textual completo ao lado (sem corte nem rotação
 * ilegível), a proporção é calculada em relação ao maior valor do conjunto e o
 * layout se adapta à largura da tela. Isso deixa sempre claro QUAL parâmetro
 * cada barra representa, inclusive em telas estreitas e com nomes longos,
 * evitando os rótulos cortados/ilegíveis do gráfico de barras verticais.
 * Onde é aplicado: renderizada no cabeçalho desta tela (rota "Relatorios" em
 * App.tsx), acima da lista tabular. As demais telas não são afetadas.
 *
 * Referências:
 *   - FlatList: https://reactnative.dev/docs/flatlist
 *   - View (layout flex): https://reactnative.dev/docs/view
 */

import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

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
          : 'Ocorreu um erro inesperado ao carregar o relatório.';
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
    return <EstadoCarregando texto="Gerando relatório..." />;
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
      <EstadoVazio mensagem="Sem dados suficientes para gerar o relatório desta região." />
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
        <Metrica rotulo="Média" valor={`${formatarNumero(item.media)} ${item.unidade}`} />
        <Metrica rotulo="Mínimo" valor={`${formatarNumero(item.minimo)} ${item.unidade}`} />
        <Metrica rotulo="Máximo" valor={`${formatarNumero(item.maximo)} ${item.unidade}`} />
        <Metrica rotulo="Amostras" valor={formatarNumero(item.contagem)} />
      </View>
      <Text style={styles.cardUltimo}>
        Último: {formatarNumero(item.ultimo_valor)} {item.unidade} em{' '}
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
          Total de medições: {formatarNumero(relatorio.total_medicoes)}
        </Text>
      </View>
      <GraficoMedias resumos={relatorio.resumos} />
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
 * Gráfico de barras HORIZONTAIS com a média de cada par (tipo/parâmetro).
 *
 * Cada linha mostra: o RÓTULO textual completo do parâmetro (com o tipo), a
 * barra proporcional (largura relativa ao MAIOR valor do conjunto, via
 * flex-grow) e o VALOR numérico formatado. Barras com valor zero recebem uma
 * largura mínima visível. Trata dataset vazio (nada é renderizado) e o caso de
 * todos os valores iguais a zero (todas as barras no mínimo).
 */
function GraficoMedias({ resumos }: { resumos: ResumoRelatorio[] }) {
  if (resumos.length === 0) {
    return null;
  }

  const itens = resumos.map((item) => ({
    chave: `${item.tipo}-${item.parametro}`,
    rotulo: `${rotuloParametro(item.parametro)} (${rotuloTipo(item.tipo)})`,
    valor: Number.isFinite(item.media) ? item.media : 0,
    unidade: item.unidade,
  }));

  // Maior valor do conjunto, base para a proporção das barras. Evita divisão
  // por zero quando todas as médias forem 0.
  const maximo = Math.max(...itens.map((i) => i.valor), 0);

  return (
    <View style={styles.graficoCartao}>
      <Text style={styles.graficoTitulo}>Médias por parâmetro</Text>
      {itens.map((item) => {
        // Proporção 0..1 em relação ao maior valor; mínimo de 4% para manter a
        // barra visível mesmo com valores pequenos ou zero.
        const proporcao = maximo > 0 ? item.valor / maximo : 0;
        const larguraRelativa = Math.max(proporcao, 0.04);
        return (
          <View key={item.chave} style={styles.barraLinha}>
            <Text style={styles.barraRotulo} numberOfLines={2}>
              {item.rotulo}
            </Text>
            <View style={styles.barraTrilho}>
              <View
                style={[
                  styles.barraPreenchida,
                  { flex: larguraRelativa },
                ]}
              />
              <View style={{ flex: 1 - larguraRelativa }} />
            </View>
            <Text style={styles.barraValor}>
              {formatarNumero(item.valor)} {item.unidade}
            </Text>
          </View>
        );
      })}
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
  graficoCartao: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  graficoTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  // Uma linha do gráfico de barras horizontais: rótulo + barra + valor.
  barraLinha: {
    gap: 4,
  },
  barraRotulo: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  barraTrilho: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EEF2F7',
    overflow: 'hidden',
  },
  barraPreenchida: {
    backgroundColor: '#0B6E4F',
    borderRadius: 8,
  },
  barraValor: {
    fontSize: 12,
    color: '#475569',
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
