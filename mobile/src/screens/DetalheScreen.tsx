/**
 * Tela de detalhe da regiao: mostra as medicoes de transporte publico. Oferece
 * um botao de atualizacao que chama o endpoint POST de fonte real e recarrega a
 * lista:
 *   - transporte publico -> POST /api/v1/regioes/{id}/atualizar-transporte
 *     (SPTrans Olho Vivo, fonte oficial de Sao Paulo; fallback rotulado sem token).
 * Assim a fonte real alimenta a lista da tela, o relatorio e os alertas.
 * Tambem leva ao relatorio da regiao.
 *
 * Referencias:
 *   - SectionList: https://reactnative.dev/docs/sectionlist
 *   - Fonte de dados reais de transporte publico: SPTrans Olho Vivo
 *     https://www.sptrans.com.br/desenvolvedores/
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

import { getMedicoes, atualizarTransporte, ApiError } from '../api/client';
import { Medicao, TipoMedicao } from '../types';
import { RootStackParamList } from '../navigation';
import { EstadoCarregando, EstadoErro } from '../ui/estados';
import {
  formatarNumero,
  formatarTimestamp,
  rotuloParametro,
  rotuloTipo,
} from '../ui/rotulos';

type Props = NativeStackScreenProps<RootStackParamList, 'Detalhe'>;

interface Secao {
  titulo: string;
  tipo: TipoMedicao;
  data: Medicao[];
}

const ORDEM_TIPOS: TipoMedicao[] = ['transporte_publico'];

export default function DetalheScreen({ route, navigation }: Props) {
  const { regiaoId, regiaoNome } = route.params;
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  // Tipo em atualizacao (null quando ocioso), para desabilitar so o botao ativo.
  const [atualizandoTipo, setAtualizandoTipo] = useState<TipoMedicao | null>(
    null,
  );
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

  const atualizar = useCallback(
    async (
      tipo: TipoMedicao,
      chamada: (id: number) => Promise<Medicao[]>,
      mensagemSucesso: string,
      mensagemErro: string,
    ) => {
      setAtualizandoTipo(tipo);
      setAviso(null);
      try {
        await chamada(regiaoId);
        setAviso(mensagemSucesso);
        await carregar();
      } catch (e) {
        const msg = e instanceof ApiError ? e.mensagem : mensagemErro;
        setAviso(msg);
      } finally {
        setAtualizandoTipo(null);
      }
    },
    [regiaoId, carregar],
  );

  const onAtualizarTransporte = useCallback(
    () =>
      atualizar(
        'transporte_publico',
        atualizarTransporte,
        'Transporte publico atualizado com dados da SPTrans (Olho Vivo).',
        'Nao foi possivel atualizar o transporte publico agora.',
      ),
    [atualizar],
  );

  const algumAtualizando = atualizandoTipo !== null;

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
          style={[
            styles.botao,
            algumAtualizando && styles.botaoDesabilitado,
          ]}
          onPress={onAtualizarTransporte}
          disabled={algumAtualizando}
          accessibilityRole="button"
        >
          {atualizandoTipo === 'transporte_publico' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.botaoTexto}>Atualizar transporte</Text>
          )}
        </Pressable>
      </View>
      <View style={styles.barraAcoesSecundaria}>
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
            Ainda nao ha medicoes para esta regiao. Use o botao
            "Atualizar transporte" acima para buscar dados reais.
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
                <Text style={styles.cardParametro}>
                  {rotuloParametro(item.parametro)}
                </Text>
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
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  barraAcoesSecundaria: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  botao: {
    flex: 1,
    backgroundColor: '#0B6E4F',
    paddingVertical: 12,
    paddingHorizontal: 6,
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
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0B6E4F',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
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
