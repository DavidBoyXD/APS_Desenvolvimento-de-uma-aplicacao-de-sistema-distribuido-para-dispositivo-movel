/**
 * Tela de alertas: lista as regras de alerta cadastradas (GET /api/v1/alertas),
 * permite criar uma regra simples (POST /api/v1/alertas) e avaliar os alertas de
 * uma região (GET /api/v1/alertas/avaliar/{regiao_id}), exibindo os disparados.
 *
 * Referências:
 *   - TextInput: https://reactnative.dev/docs/textinput
 *   - ScrollView: https://reactnative.dev/docs/scrollview
 *
 * Onde é aplicado: rota "Alertas" em App.tsx.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  ApiError,
  avaliarAlertas,
  criarAlerta,
  getAlertas,
  getRegioes,
} from '../api/client';
import {
  Alerta,
  AlertaCreate,
  AlertaDisparado,
  CondicaoAlerta,
  Regiao,
  TipoMedicao,
} from '../types';
import { RootStackParamList } from '../navigation';
import { EstadoCarregando, EstadoErro } from '../ui/estados';
import { formatarNumero, rotuloTipo } from '../ui/rotulos';

type Props = NativeStackScreenProps<RootStackParamList, 'Alertas'>;

const TIPOS: TipoMedicao[] = ['transporte_publico'];
const CONDICOES: CondicaoAlerta[] = ['>', '<'];

export default function AlertasScreen(_props: Props) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  // Detalhe técnico da falha (URL chamada e causa), exibido para diagnóstico.
  const [detalheErro, setDetalheErro] = useState<string | null>(null);

  // Estado do formulário de criação.
  const [regiaoId, setRegiaoId] = useState<number | null>(null);
  const [tipo, setTipo] = useState<TipoMedicao>('transporte_publico');
  const [parametro, setParametro] = useState<string>('veiculos_em_operacao');
  const [limiar, setLimiar] = useState<string>('100');
  const [condicao, setCondicao] = useState<CondicaoAlerta>('>');
  const [mensagem, setMensagem] = useState<string>('');
  const [salvando, setSalvando] = useState<boolean>(false);
  const [feedbackForm, setFeedbackForm] = useState<string | null>(null);

  // Estado da avaliação.
  const [avaliando, setAvaliando] = useState<boolean>(false);
  const [disparados, setDisparados] = useState<AlertaDisparado[] | null>(null);
  const [feedbackAvaliacao, setFeedbackAvaliacao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setDetalheErro(null);
    try {
      const [listaAlertas, listaRegioes] = await Promise.all([
        getAlertas(),
        getRegioes(),
      ]);
      setAlertas(listaAlertas);
      setRegioes(listaRegioes);
      if (listaRegioes.length > 0) {
        setRegiaoId((atual) => atual ?? listaRegioes[0].id);
      }
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.mensagem
          : 'Ocorreu um erro inesperado ao carregar os alertas.';
      setErro(msg);
      setDetalheErro(e instanceof ApiError ? e.detalhe ?? null : null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Mapa id -> nome das regioes carregadas, usado para exibir o NOME da regiao
  // (em vez do numero/id cru) nas regras cadastradas e nos alertas disparados.
  const nomePorRegiao = useMemo(() => {
    const mapa = new Map<number, string>();
    regioes.forEach((r) => mapa.set(r.id, r.nome));
    return mapa;
  }, [regioes]);

  // Retorna o nome da regiao correspondente ao id; se nao encontrar (ex.: regra
  // de uma regiao que nao esta na lista carregada), cai num rotulo legivel.
  const nomeRegiao = useCallback(
    (id: number) => nomePorRegiao.get(id) ?? `Regiao ${id}`,
    [nomePorRegiao],
  );

  const onCriar = useCallback(async () => {
    setFeedbackForm(null);
    if (regiaoId === null) {
      setFeedbackForm('Selecione uma regiao para o alerta.');
      return;
    }
    const limiarNumero = Number(limiar.replace(',', '.'));
    if (!Number.isFinite(limiarNumero)) {
      setFeedbackForm('Informe um limiar numerico valido.');
      return;
    }
    if (parametro.trim().length === 0) {
      setFeedbackForm(
        'Informe o parametro (ex.: veiculos_em_operacao, linhas_monitoradas).',
      );
      return;
    }
    const payload: AlertaCreate = {
      regiao_id: regiaoId,
      tipo,
      parametro: parametro.trim(),
      limiar: limiarNumero,
      condicao,
      ativo: true,
      mensagem:
        mensagem.trim().length > 0
          ? mensagem.trim()
          : `Alerta de ${rotuloTipo(tipo)}: ${parametro.trim()} ${condicao} ${limiarNumero}`,
    };
    setSalvando(true);
    try {
      const novo = await criarAlerta(payload);
      setAlertas((atual) => [...atual, novo]);
      setFeedbackForm('Regra de alerta criada com sucesso.');
      setMensagem('');
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.mensagem
          : 'Nao foi possivel criar a regra de alerta.';
      setFeedbackForm(msg);
    } finally {
      setSalvando(false);
    }
  }, [regiaoId, tipo, parametro, limiar, condicao, mensagem]);

  const onAvaliar = useCallback(async () => {
    if (regiaoId === null) {
      setFeedbackAvaliacao('Selecione uma regiao para avaliar.');
      return;
    }
    setAvaliando(true);
    setFeedbackAvaliacao(null);
    setDisparados(null);
    try {
      const resultado = await avaliarAlertas(regiaoId);
      setDisparados(resultado);
      if (resultado.length === 0) {
        setFeedbackAvaliacao(
          'Nenhum alerta disparado: as medicoes estao dentro dos limiares.',
        );
      }
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.mensagem
          : 'Nao foi possivel avaliar os alertas desta regiao.';
      setFeedbackAvaliacao(msg);
    } finally {
      setAvaliando(false);
    }
  }, [regiaoId]);

  if (carregando) {
    return <EstadoCarregando texto="Carregando alertas..." />;
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.conteudo}
      keyboardShouldPersistTaps="handled"
    >
      {/* Lista de regras existentes */}
      <Text style={styles.secaoTitulo}>Regras cadastradas</Text>
      {alertas.length === 0 ? (
        <Text style={styles.vazio}>Nenhuma regra de alerta cadastrada.</Text>
      ) : (
        alertas.map((a) => (
          <View key={a.id} style={styles.card}>
            <Text style={styles.cardTitulo}>
              {a.parametro} {a.condicao} {formatarNumero(a.limiar)}
            </Text>
            <Text style={styles.cardMeta}>
              {rotuloTipo(a.tipo)} · {nomeRegiao(a.regiao_id)} ·{' '}
              {a.ativo ? 'ativa' : 'inativa'}
            </Text>
            <Text style={styles.cardMensagem}>{a.mensagem}</Text>
          </View>
        ))
      )}

      {/* Formulário de criação */}
      <Text style={styles.secaoTitulo}>Nova regra de alerta</Text>

      <Text style={styles.rotuloCampo}>Regiao</Text>
      <View style={styles.chips}>
        {regioes.map((r) => (
          <Chip
            key={r.id}
            texto={`${r.nome}`}
            ativo={regiaoId === r.id}
            onPress={() => setRegiaoId(r.id)}
          />
        ))}
      </View>

      <Text style={styles.rotuloCampo}>Tipo</Text>
      <View style={styles.chips}>
        {TIPOS.map((t) => (
          <Chip
            key={t}
            texto={rotuloTipo(t)}
            ativo={tipo === t}
            onPress={() => setTipo(t)}
          />
        ))}
      </View>

      <Text style={styles.rotuloCampo}>Parametro</Text>
      <TextInput
        style={styles.input}
        value={parametro}
        onChangeText={setParametro}
        placeholder="ex.: veiculos_em_operacao, linhas_monitoradas"
        autoCapitalize="none"
      />

      <Text style={styles.rotuloCampo}>Condicao e limiar</Text>
      <View style={styles.linhaLimiar}>
        <View style={styles.chips}>
          {CONDICOES.map((c) => (
            <Chip
              key={c}
              texto={c === '>' ? 'maior que (>)' : 'menor que (<)'}
              ativo={condicao === c}
              onPress={() => setCondicao(c)}
            />
          ))}
        </View>
      </View>
      <TextInput
        style={styles.input}
        value={limiar}
        onChangeText={setLimiar}
        placeholder="ex.: 100"
        keyboardType="numeric"
      />

      <Text style={styles.rotuloCampo}>Mensagem (opcional)</Text>
      <TextInput
        style={styles.input}
        value={mensagem}
        onChangeText={setMensagem}
        placeholder="Mensagem exibida quando o alerta disparar"
      />

      <Pressable
        style={[styles.botao, salvando && styles.botaoDesabilitado]}
        onPress={onCriar}
        disabled={salvando}
        accessibilityRole="button"
      >
        {salvando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.botaoTexto}>Criar regra</Text>
        )}
      </Pressable>
      {feedbackForm ? <Text style={styles.feedback}>{feedbackForm}</Text> : null}

      {/* Avaliação */}
      <Text style={styles.secaoTitulo}>Avaliar alertas da regiao</Text>
      <Pressable
        style={[styles.botaoSecundario, avaliando && styles.botaoDesabilitado]}
        onPress={onAvaliar}
        disabled={avaliando}
        accessibilityRole="button"
      >
        {avaliando ? (
          <ActivityIndicator color="#0B6E4F" />
        ) : (
          <Text style={styles.botaoSecundarioTexto}>
            Avaliar regiao selecionada
          </Text>
        )}
      </Pressable>
      {feedbackAvaliacao ? (
        <Text style={styles.feedback}>{feedbackAvaliacao}</Text>
      ) : null}
      {disparados && disparados.length > 0
        ? disparados.map((d, indice) => (
            <View key={`${d.alerta_id}-${indice}`} style={styles.cardDisparado}>
              <Text style={styles.cardDisparadoTitulo}>⚠️ {d.mensagem}</Text>
              <Text style={styles.cardMeta}>
                {nomeRegiao(d.regiao_id)} · {d.parametro} ={' '}
                {formatarNumero(d.valor_observado)} (regra: {d.condicao}{' '}
                {formatarNumero(d.limiar)})
              </Text>
            </View>
          ))
        : null}
    </ScrollView>
  );
}

function Chip({
  texto,
  ativo,
  onPress,
}: {
  texto: string;
  ativo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, ativo && styles.chipAtivo]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>
        {texto}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6',
  },
  conteudo: {
    padding: 16,
    paddingBottom: 40,
    gap: 8,
  },
  secaoTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 4,
  },
  vazio: {
    color: '#64748B',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  cardTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  cardMensagem: {
    fontSize: 13,
    color: '#334155',
    marginTop: 4,
  },
  rotuloCampo: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  chipAtivo: {
    backgroundColor: '#0B6E4F',
    borderColor: '#0B6E4F',
  },
  chipTexto: {
    fontSize: 13,
    color: '#334155',
  },
  chipTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 4,
  },
  linhaLimiar: {
    marginTop: 4,
  },
  botao: {
    backgroundColor: '#0B6E4F',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 12,
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
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 4,
  },
  botaoSecundarioTexto: {
    color: '#0B6E4F',
    fontWeight: '600',
  },
  feedback: {
    fontSize: 13,
    color: '#0B6E4F',
    marginTop: 6,
  },
  cardDisparado: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginTop: 8,
  },
  cardDisparadoTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B00020',
  },
});
