/**
 * Tela de detalhe da regiao: mostra as medicoes agrupadas por tipo
 * (qualidade do ar, transito, alagamento). Oferece o botao "Atualizar qualidade
 * do ar", que chama POST /api/v1/regioes/{id}/atualizar-ar (dados reais da
 * Open-Meteo) e recarrega a lista. Tambem leva ao relatorio da regiao.
 *
 * Referencias:
 *   - SectionList: https://reactnative.dev/docs/sectionlist
 *   - Fonte de dados reais de ar: Open-Meteo Air Quality API
 *     https://open-meteo.com/en/docs/air-quality-api
 *
 * Onde e aplicado: rota "Detalhe" em App.tsx.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getMedicoes, atualizarAr, ApiError } from '../api/client';
import { Medicao, TipoMedicao } from '../types';
import { RootStackParamList } from '../navigation';
import { EstadoCarregando, EstadoErro } from '../ui/estados';
import { formatarNumero, formatarTimestamp, rotuloTipo } from '../ui/rotulos';

type Props = NativeStackScreenProps<RootStackParamList, 'Detalhe'>;

interface Secao {
  titulo: string;
  tipo: TipoMedicao;
  data: Medicao[];
}

const ORDEM_TIPOS: TipoMedicao[] = ['qualidade_ar', 'transito', 'alagamento'];

export default function DetalheScreen({ route, navigation }: Props) {
  const { regiaoId, regiaoNome } = route.params;
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState<boolean>(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await getMedicoes({ regiao_id: regiaoId });
      setMedicoes(dados);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.mensagem
          : 'Ocorreu um erro inesperado ao carregar as medicoes.';
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  }, [regiaoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const onAtualizarAr = useCallback(async () => {
    setAtualizando(true);
    setAviso(null);
    try {
      await atualizarAr(regiaoId);
      setAviso('Qualidade do ar atualizada com dados da Open-Meteo.');
      await carregar();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.mensagem
          : 'Nao foi possivel atualizar a qualidade do ar agora.';
      setAviso(msg);
    } finally {
      setAtualizando(false);
    }
  }, [regiaoId, carregar]);

  const secoes = useMemo<Secao[]>(() => {
    return ORDEM_TIPOS.map((tipo) => ({
      titulo: rotuloTipo(tipo),
      tipo,
      data: medicoes.filter((m) => m.tipo === tipo),
    })).filter((secao) => secao.data.length > 0);
  }, [medicoes]);

  if (carregando) {
    return <EstadoCarregando texto="Carregando medicoes..." />;
  }

  if (erro) {
    return <EstadoErro mensagem={erro} aoTentarNovamente={carregar} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.barraAcoes}>
        <Pressable
          style={[styles.botao, atualizando && styles.botaoDesabilitado]}
          onPress={onAtualizarAr}
          disabled={atualizando}
          accessibilityRole="button"
        >
          {atualizando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.botaoTexto}>Atualizar qualidade do ar</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.botaoSecundario}
          onPress={() =>
            navigation.navigate('Relatorios', { regiaoId, regiaoNome })
          }
          accessibilityRole="button"
        >
          <Text style={styles.botaoSecundarioTexto}>Ver relatorio</Text>
        </Pressable>
      </View>

      {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}

      {secoes.length === 0 ? (
        <View style={styles.vazio}>
          <Text style={styles.vazioTexto}>
            Ainda nao ha medicoes para esta regiao. Use "Atualizar qualidade do
            ar" para buscar dados reais.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={secoes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.lista}
          renderSectionHeader={({ section }) => (
            <Text style={styles.secaoTitulo}>{section.titulo}</Text>
          )}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardLinha}>
                <Text style={styles.cardParametro}>{item.parametro}</Text>
                <Text style={styles.cardValor}>
                  {formatarNumero(item.valor)} {item.unidade}
                </Text>
              </View>
              <Text style={styles.cardMeta}>
                {formatarTimestamp(item.timestamp)}
              </Text>
              <Text style={styles.cardFonte}>Fonte: {item.fonte}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6',
  },
  barraAcoes: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  botao: {
    flex: 1,
    backgroundColor: '#0B6E4F',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  botaoDesabilitado: {
    opacity: 0.7,
  },
  botaoTexto: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  botaoSecundario: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0B6E4F',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoSecundarioTexto: {
    color: '#0B6E4F',
    fontWeight: '600',
  },
  aviso: {
    marginHorizontal: 16,
    marginBottom: 8,
    color: '#0B6E4F',
    fontSize: 13,
  },
  lista: {
    padding: 16,
    paddingTop: 0,
    gap: 10,
  },
  secaoTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 6,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardParametro: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  cardValor: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B6E4F',
  },
  cardMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  cardFonte: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  vazio: {
    padding: 24,
  },
  vazioTexto: {
    color: '#555555',
    fontSize: 15,
    textAlign: 'center',
  },
});
