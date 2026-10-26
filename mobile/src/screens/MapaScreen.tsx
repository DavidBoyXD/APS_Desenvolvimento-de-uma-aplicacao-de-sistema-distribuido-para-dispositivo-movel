/**
 * Tela inicial: mapa com as regiões monitoradas (consulta por região ligada ao
 * mapa, requisito da APS). Plota um marcador por região usando latitude/longitude
 * e permite tocar para abrir o Detalhe.
 *
 * IMPORTANTE (react-native-maps):
 *   - Em emulador/dispositivo Android sem uma Google Maps API key configurada, o
 *     MapView pode não renderizar o mapa (aparece cinza) ou, no APK de produção,
 *     derrubar o app na inicialização (crash no splash). Configuração da chave:
 *     https://docs.expo.dev/versions/latest/sdk/map-view/ e
 *     https://github.com/react-native-maps/react-native-maps
 *   - No sandbox não há emulador; por isso este arquivo também oferece um
 *     FALLBACK: uma lista de regiões clicáveis, sempre disponível abaixo do mapa,
 *     garantindo que a funcionalidade (escolher região) funcione mesmo sem mapa.
 *   - Na web (react-native-web), o MapView nativo não existe; renderizamos apenas
 *     a lista. Detectamos a plataforma via Platform.OS.
 *
 * POR QUE EXISTE O ERROR BOUNDARY (MapaErrorBoundary):
 *   - No APK Android de produção, se o módulo nativo do mapa falhar ao renderizar
 *     (por exemplo, sem Google Maps API key válida), um erro de render do React
 *     derrubaria a árvore inteira e FECHARIA o app na tela de splash.
 *   - O Error Boundary (componente de classe com getDerivedStateFromError /
 *     componentDidCatch) captura esse erro de render do MapView e cai para a
 *     LISTA de regiões, mantendo a tela SEMPRE aberta e navegável. É o mecanismo
 *     mais garantido contra crash de render em React Native.
 *   - Além disso, o require de 'react-native-maps' é protegido por try/catch: se
 *     o módulo nem carregar, o componente do mapa fica nulo e a tela já abre
 *     direto na lista, sem depender do boundary.
 *   - Referência (Error Boundaries): https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 *
 * Referências:
 *   - MapView / Marker: https://github.com/react-native-maps/react-native-maps/blob/master/docs/mapview.md
 *   - FlatList: https://reactnative.dev/docs/flatlist
 *
 * Onde é aplicado: registrada como rota "Mapa" em App.tsx.
 */

import { Component, ReactNode, useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getRegioes, ApiError } from '../api/client';
import { Regiao } from '../types';
import { RootStackParamList } from '../navigation';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../ui/estados';

// react-native-maps não possui build para web; importamos condicionalmente.
// Em nativo, MapaComponente/MarcadorComponente recebem os componentes reais.
// O require é protegido por try/catch para que, se o módulo nativo não estiver
// disponível no pacote, a tela ainda abra direto na lista (sem crash).
let MapaComponente: any = null;
let MarcadorComponente: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mapas = require('react-native-maps');
    MapaComponente = mapas.default;
    MarcadorComponente = mapas.Marker;
  } catch {
    // Módulo do mapa indisponível: mantém os componentes nulos e usa a lista.
    MapaComponente = null;
    MarcadorComponente = null;
  }
}

type Props = NativeStackScreenProps<RootStackParamList, 'Mapa'>;

/**
 * Error Boundary dedicado ao MapView. Se o mapa nativo lançar um erro de render
 * em runtime (ex.: APK sem Google Maps API key válida), captura o erro e exibe o
 * conteúdo de fallback (``props.children`` é substituído pelo ``props.fallback``)
 * SEM derrubar o app. É um componente de classe porque Error Boundaries só podem
 * ser implementados com ``getDerivedStateFromError`` / ``componentDidCatch``.
 */
type MapaErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type MapaErrorBoundaryState = {
  comErro: boolean;
};

class MapaErrorBoundary extends Component<
  MapaErrorBoundaryProps,
  MapaErrorBoundaryState
> {
  state: MapaErrorBoundaryState = { comErro: false };

  static getDerivedStateFromError(): MapaErrorBoundaryState {
    // Em caso de erro de render no mapa, marca o estado para cair no fallback.
    return { comErro: true };
  }

  componentDidCatch(erro: unknown): void {
    // Registra o erro para depuração; a tela continua aberta via fallback.
    // eslint-disable-next-line no-console
    console.warn('Falha ao renderizar o mapa; usando a lista de regioes.', erro);
  }

  render(): ReactNode {
    if (this.state.comErro) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Enquadramento inicial do mapa na cidade de São Paulo (recorte da aplicação).
// Coordenadas aproximadas do centro de SP; o delta ~0.3 enquadra a cidade.
const REGIAO_INICIAL = {
  latitude: -23.55,
  longitude: -46.63,
  latitudeDelta: 0.3,
  longitudeDelta: 0.3,
};

export default function MapaScreen({ navigation }: Props) {
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await getRegioes();
      setRegioes(dados);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.mensagem
          : 'Ocorreu um erro inesperado ao carregar as regioes.';
      setErro(msg);
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
    return <EstadoErro mensagem={erro} aoTentarNovamente={carregar} />;
  }

  if (regioes.length === 0) {
    return (
      <EstadoVazio mensagem="Nenhuma regiao de Sao Paulo cadastrada no servidor." />
    );
  }

  // Aviso textual usado quando o mapa não está disponível (web) ou falhou em
  // runtime (fallback do Error Boundary). A lista de regiões permanece sempre
  // visível abaixo, garantindo a navegação.
  const avisoSemMapa = (
    <View style={styles.avisoWeb}>
      <Text style={styles.avisoWebTexto}>
        O mapa interativo esta indisponivel neste dispositivo. Use a lista
        abaixo para escolher uma regiao.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {MapaComponente ? (
        // Envolve o MapView no Error Boundary: se o mapa nativo quebrar em
        // runtime (ex.: APK sem Google Maps API key), a tela NAO fecha; cai no
        // aviso acima e a lista de regioes continua disponivel abaixo.
        <MapaErrorBoundary fallback={avisoSemMapa}>
          <MapaComponente style={styles.mapa} initialRegion={REGIAO_INICIAL}>
            {regioes.map((regiao) => (
              <MarcadorComponente
                key={regiao.id}
                coordinate={{
                  latitude: regiao.latitude,
                  longitude: regiao.longitude,
                }}
                title={regiao.nome}
                description={`${regiao.cidade} - ${regiao.uf}`}
                onCalloutPress={() => abrirDetalhe(regiao)}
              />
            ))}
          </MapaComponente>
        </MapaErrorBoundary>
      ) : (
        avisoSemMapa
      )}

      <View style={styles.listaCabecalho}>
        <Text style={styles.listaTitulo}>Regioes monitoradas em Sao Paulo</Text>
        <Pressable
          style={styles.botaoAlertas}
          onPress={() => navigation.navigate('Alertas')}
          accessibilityRole="button"
        >
          <Text style={styles.botaoAlertasTexto}>Ver alertas</Text>
        </Pressable>
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
  mapa: {
    width: '100%',
    height: 260,
  },
  avisoWeb: {
    padding: 16,
    backgroundColor: '#E6F4FE',
  },
  avisoWebTexto: {
    color: '#334155',
    fontSize: 14,
  },
  listaCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  listaTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
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
