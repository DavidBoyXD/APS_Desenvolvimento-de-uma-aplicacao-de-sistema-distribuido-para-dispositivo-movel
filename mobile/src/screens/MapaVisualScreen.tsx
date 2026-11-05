/**
 * Tela de MAPA VISUAL (OPCIONAL e SEPARADA da tela inicial).
 *
 * O que ela faz:
 *   - Sem parâmetros: carrega as regiões monitoradas (getRegioes) e plota cada
 *     uma como um marcador; tocar no marcador abre o Detalhe da região (mesmo
 *     comportamento da lista inicial).
 *   - Com `codigoLinha` (vindo da tela de Linhas): carrega a posição em tempo
 *     real dos veículos daquela linha (getPosicoesLinha) e plota cada veículo
 *     como um marcador distinto (prefixo, acessibilidade e horário no balão).
 *
 * POR QUE ESTA TELA EXISTE SEPARADA (decisão de arquitetura DEFENSIVA):
 *   O `react-native-maps` usa o Google Maps nativo no Android. Sem uma chave de
 *   API válida no binário, o módulo nativo pode CRASHAR o app. Para que isso
 *   NUNCA derrube a inicialização, o mapa vive aqui, numa rota opcional, e NÃO
 *   na tela inicial. A tela inicial continua sendo a LISTA de regiões (rota
 *   "Mapa"), que não depende de módulo nativo e sempre abre. Se o mapa falhar,
 *   o usuário apenas volta para a lista.
 *
 * CAMADAS DE PROTEÇÃO:
 *   1. Carregamento protegido do módulo (ver src/ui/mapaNativo.ts): se o pacote
 *      não estiver instalado/indisponível, mostramos um fallback com um botão
 *      para voltar à lista, sem quebrar.
 *   2. Error Boundary de classe em volta do MapView: captura ERROS DE RENDER
 *      JS do mapa e mostra uma mensagem + botão de voltar.
 *      ATENÇÃO: o Error Boundary NÃO captura CRASH NATIVO (ex.: chave da API
 *      ausente/ inválida) — isso é limitação do JS. A real proteção contra o
 *      crash nativo é esta tela ser separada e opcional (acima).
 *
 * Referências:
 *   - react-native-maps (SDK 58): https://docs.expo.dev/versions/v58.0.0/sdk/map-view/
 *   - Error Boundaries (React): https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 *
 * Onde é aplicado: rota "MapaVisual" em App.tsx, acessível pelos botões
 * "Ver no mapa" em MapaScreen (regiões) e LinhasScreen (veículos de uma linha).
 */

import { Component, ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getRegioes, getPosicoesLinha, ApiError } from '../api/client';
import { Regiao, VeiculoPosicaoRead } from '../types';
import { RootStackParamList } from '../navigation';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../ui/estados';
import {
  AVISO_DADO_EXEMPLO,
  formatarTimestamp,
  rotuloAcessivel,
} from '../ui/rotulos';
import { carregarModuloMapa, RegiaoMapa } from '../ui/mapaNativo';

type Props = NativeStackScreenProps<RootStackParamList, 'MapaVisual'>;

/**
 * Enquadramento inicial do mapa: centro aproximado da cidade de São Paulo com
 * amplitude (~0.3) suficiente para mostrar a mancha urbana e os marcadores.
 */
const REGIAO_SP: RegiaoMapa = {
  latitude: -23.55,
  longitude: -46.63,
  latitudeDelta: 0.3,
  longitudeDelta: 0.3,
};

/**
 * Error Boundary de classe em volta do MapView.
 *
 * Captura erros de RENDER JS do mapa (não crash nativo) e exibe um fallback com
 * um botão para voltar à lista, de modo que a falha do mapa fique contida nesta
 * tela e não propague.
 */
class LimiteDeErroMapa extends Component<
  { aoVoltar: () => void; children: ReactNode },
  { comErro: boolean }
> {
  state = { comErro: false };

  static getDerivedStateFromError(): { comErro: boolean } {
    return { comErro: true };
  }

  render() {
    if (this.state.comErro) {
      return (
        <View style={styles.centro}>
          <Text style={styles.icone}>🗺️</Text>
          <Text style={styles.textoErro}>
            Nao foi possivel exibir o mapa nesta tela.
          </Text>
          <Text style={styles.textoDetalhe}>
            Voce pode continuar usando a lista normalmente.
          </Text>
          <Pressable
            style={styles.botao}
            onPress={this.props.aoVoltar}
            accessibilityRole="button"
          >
            <Text style={styles.botaoTexto}>Voltar para a lista</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function MapaVisualScreen({ navigation, route }: Props) {
  const codigoLinha = route.params?.codigoLinha;
  const linhaRotulo = route.params?.linhaRotulo;
  const modoVeiculos = typeof codigoLinha === 'number';

  // Carrega o módulo nativo de forma protegida (null = indisponível).
  const [modulo] = useState(() => carregarModuloMapa());

  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoPosicaoRead[]>([]);
  const [tempoReal, setTempoReal] = useState<boolean>(true);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setDetalheErro(null);
    try {
      if (modoVeiculos && typeof codigoLinha === 'number') {
        const dados = await getPosicoesLinha(codigoLinha);
        setVeiculos(dados.veiculos);
        setTempoReal(dados.tempo_real);
      } else {
        const dados = await getRegioes();
        setRegioes(dados);
      }
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.mensagem
          : 'Ocorreu um erro inesperado ao carregar o mapa.';
      setErro(msg);
      setDetalheErro(e instanceof ApiError ? e.detalhe ?? null : null);
    } finally {
      setCarregando(false);
    }
  }, [codigoLinha, modoVeiculos]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const voltar = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const abrirDetalhe = useCallback(
    (regiao: Regiao) => {
      navigation.navigate('Detalhe', {
        regiaoId: regiao.id,
        regiaoNome: regiao.nome,
      });
    },
    [navigation],
  );

  // Módulo nativo indisponível (ex.: pacote não instalado ou plataforma web):
  // fallback imediato, sem tentar renderizar o mapa.
  if (!modulo) {
    return (
      <View style={styles.centro}>
        <Text style={styles.icone}>🗺️</Text>
        <Text style={styles.textoErro}>
          O mapa nao esta disponivel neste dispositivo.
        </Text>
        <Text style={styles.textoDetalhe}>
          Use a lista para navegar pelas regioes e linhas.
        </Text>
        <Pressable
          style={styles.botao}
          onPress={voltar}
          accessibilityRole="button"
        >
          <Text style={styles.botaoTexto}>Voltar para a lista</Text>
        </Pressable>
      </View>
    );
  }

  if (carregando) {
    return (
      <EstadoCarregando
        texto={modoVeiculos ? 'Carregando veiculos...' : 'Carregando regioes...'}
      />
    );
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

  if (modoVeiculos && veiculos.length === 0) {
    return (
      <EstadoVazio mensagem="Nenhum veiculo em operacao no momento para esta linha." />
    );
  }

  if (!modoVeiculos && regioes.length === 0) {
    return (
      <EstadoVazio mensagem="Nenhuma regiao de Sao Paulo cadastrada no servidor." />
    );
  }

  const { MapView, Marker, PROVIDER_GOOGLE } = modulo;

  return (
    <LimiteDeErroMapa aoVoltar={voltar}>
      <View style={styles.container}>
        {modoVeiculos && !tempoReal ? (
          <View style={styles.faixaAviso}>
            <Text style={styles.faixaAvisoTexto}>{AVISO_DADO_EXEMPLO}</Text>
          </View>
        ) : null}
        <MapView
          style={styles.mapa}
          provider={PROVIDER_GOOGLE}
          initialRegion={REGIAO_SP}
        >
          {modoVeiculos
            ? veiculos.map((veiculo, indice) => (
                // Marcador de VEÍCULO: cor distinta e balão com prefixo,
                // acessibilidade e horário. A key combina prefixo + índice
                // porque o mesmo prefixo pode repetir na lista.
                <Marker
                  key={`veiculo-${veiculo.prefixo}-${indice}`}
                  coordinate={{
                    latitude: veiculo.latitude,
                    longitude: veiculo.longitude,
                  }}
                  pinColor="#1D4ED8"
                  title={`${linhaRotulo ? linhaRotulo + ' · ' : ''}Prefixo ${veiculo.prefixo}`}
                  description={`${rotuloAcessivel(veiculo.acessivel)} · ${formatarTimestamp(veiculo.timestamp)}`}
                />
              ))
            : regioes.map((regiao) => (
                // Marcador de REGIÃO: tocar no balão abre o Detalhe (mesmo
                // comportamento da lista inicial).
                <Marker
                  key={`regiao-${regiao.id}`}
                  coordinate={{
                    latitude: regiao.latitude,
                    longitude: regiao.longitude,
                  }}
                  pinColor="#0B6E4F"
                  title={regiao.nome}
                  description={`${regiao.cidade} - ${regiao.uf}`}
                  onCalloutPress={() => abrirDetalhe(regiao)}
                />
              ))}
        </MapView>
      </View>
    </LimiteDeErroMapa>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6',
  },
  mapa: {
    flex: 1,
    width: '100%',
  },
  faixaAviso: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  faixaAvisoTexto: {
    fontSize: 12,
    color: '#B45309',
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#F5F7F6',
  },
  icone: {
    fontSize: 32,
  },
  textoErro: {
    color: '#B00020',
    fontSize: 15,
    textAlign: 'center',
  },
  textoDetalhe: {
    color: '#8A8A8A',
    fontSize: 13,
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
