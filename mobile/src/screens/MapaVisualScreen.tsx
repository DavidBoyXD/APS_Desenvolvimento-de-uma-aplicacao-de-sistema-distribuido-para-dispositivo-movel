/**
 * Tela de MAPA VISUAL (OPCIONAL e SEPARADA da tela inicial).
 *
 * O que ela faz:
 *   - Sem parametros: carrega as regioes monitoradas (getRegioes) e plota cada
 *     uma como um marcador; tocar no marcador abre um balao com o nome e um
 *     link "Ver detalhe" que navega para o Detalhe da regiao (mesmo
 *     comportamento da lista inicial).
 *   - Com `codigoLinha` (vindo da tela de Linhas): carrega a posicao em tempo
 *     real dos veiculos daquela linha (getPosicoesLinha) e plota cada veiculo
 *     como um marcador distinto (prefixo, acessibilidade e horario no balao).
 *
 * COMO O MAPA E DESENHADO (WebView + OpenStreetMap/Leaflet):
 *   O mapa NAO usa mais um modulo nativo de mapa (Google Maps). Em vez disso,
 *   renderizamos um `WebView` (do `react-native-webview`) que carrega um HTML
 *   embutido com a biblioteca Leaflet (via CDN) apontando para os tiles do
 *   OpenStreetMap. Isso:
 *     - NAO precisa de chave de API nem de billing;
 *     - NAO traz a dependencia nativa que quebrava a inicializacao do app
 *       (o antigo mapa nativo arrastava o androidx.work/WorkManager, que falhava
 *       no startup e derrubava o processo antes mesmo do JavaScript rodar);
 *     - Requer INTERNET para baixar os tiles do OpenStreetMap e a Leaflet por
 *       CDN. O app ja depende de internet para falar com a API, entao isso e
 *       aceitavel; offline, o mapa nao carrega, mas a LISTA de regioes (tela
 *       inicial "Mapa") continua funcionando normalmente.
 *
 * COMO OS DADOS CHEGAM NO MAPA:
 *   Buscamos os dados no React (client.ts) com os estados de carregando/erro/
 *   vazio padrao do projeto. So depois que os dados chegam montamos o HTML com
 *   os pontos JA EMBUTIDOS (via JSON.stringify, que serializa com seguranca e
 *   evita quebrar o HTML) e renderizamos o WebView. Para a navegacao a partir do
 *   mapa, o HTML chama `window.ReactNativeWebView.postMessage(...)` quando o
 *   usuario toca em "Ver detalhe" de uma regiao; o React recebe em `onMessage` e
 *   chama `navigation.navigate('Detalhe', ...)`.
 *
 * Referencias:
 *   - react-native-webview (SDK 58): https://docs.expo.dev/versions/v58.0.0/sdk/webview/
 *   - Leaflet: https://leafletjs.com/reference.html
 *   - OpenStreetMap (tiles): https://www.openstreetmap.org/
 *
 * Onde e aplicado: rota "MapaVisual" em App.tsx, acessivel pelos botoes
 * "Ver no mapa" em MapaScreen (regioes) e LinhasScreen (veiculos de uma linha).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { carregarWebView } from '../ui/webview';

type Props = NativeStackScreenProps<RootStackParamList, 'MapaVisual'>;

/** Centro aproximado da cidade de Sao Paulo (usado para enquadrar o mapa). */
const SP_LAT = -23.55;
const SP_LON = -46.63;
/** Zoom inicial adequado para mostrar a mancha urbana e os marcadores. */
const SP_ZOOM = 11;

/** Ponto generico plotado no mapa (um marcador do Leaflet). */
interface PontoMapa {
  lat: number;
  lon: number;
  /** Titulo em negrito no balao (ex.: nome da regiao ou prefixo do veiculo). */
  titulo: string;
  /** Linha secundaria opcional no balao (ex.: cidade/UF ou acessibilidade). */
  subtitulo?: string;
  /**
   * Id da regiao, presente apenas para pontos de REGIAO. Quando presente, o
   * balao ganha um link "Ver detalhe" que envia uma mensagem para o React
   * navegar ate o Detalhe daquela regiao.
   */
  regiaoId?: number;
}

/** Mensagem recebida do WebView (ponte HTML -> React via postMessage). */
interface MensagemWebView {
  tipo: 'abrirDetalhe';
  regiaoId: number;
  regiaoNome: string;
}

/**
 * Monta o HTML completo do mapa com os pontos ja embutidos.
 *
 * Os pontos sao injetados via JSON.stringify: isso serializa com seguranca
 * (escapa aspas e caracteres especiais) e evita que nomes com acento, aspas ou
 * caracteres de controle quebrem o HTML. A Leaflet e o CSS vem por CDN (unpkg),
 * o que exige internet; os tiles vem do OpenStreetMap.
 */
function montarHtmlMapa(pontos: PontoMapa[]): string {
  // Serializa os pontos com JSON.stringify e, em seguida, escapa o caractere
  // "<" como "\\u003c". Isso impede que um nome de regiao contendo a sequencia
  // "</script>" feche o bloco <script> do HTML prematuramente (quebra de
  // contexto/injecao). O JSON resultante continua valido e equivalente.
  const pontosJson = JSON.stringify(pontos).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    />
    <style>
      html, body, #mapa { height: 100%; margin: 0; padding: 0; }
      #mapa { width: 100%; }
      .link-detalhe {
        display: inline-block;
        margin-top: 6px;
        color: #0b6e4f;
        font-weight: 600;
        text-decoration: underline;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div id="mapa"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      (function () {
        var pontos = ${pontosJson};
        var mapa = L.map('mapa').setView([${SP_LAT}, ${SP_LON}], ${SP_ZOOM});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; colaboradores do OpenStreetMap'
        }).addTo(mapa);

        var grupo = [];
        pontos.forEach(function (p) {
          var marcador = L.marker([p.lat, p.lon]).addTo(mapa);
          grupo.push(marcador);
          var cont = document.createElement('div');
          var titulo = document.createElement('strong');
          titulo.textContent = p.titulo;
          cont.appendChild(titulo);
          if (p.subtitulo) {
            var sub = document.createElement('div');
            sub.textContent = p.subtitulo;
            cont.appendChild(sub);
          }
          if (typeof p.regiaoId === 'number') {
            var link = document.createElement('span');
            link.className = 'link-detalhe';
            link.textContent = 'Ver detalhe';
            link.addEventListener('click', function () {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(
                  JSON.stringify({
                    tipo: 'abrirDetalhe',
                    regiaoId: p.regiaoId,
                    regiaoNome: p.titulo
                  })
                );
              }
            });
            cont.appendChild(link);
          }
          marcador.bindPopup(cont);
        });

        // Enquadra todos os marcadores quando ha mais de um ponto.
        if (grupo.length > 1) {
          var limites = L.featureGroup(grupo).getBounds();
          mapa.fitBounds(limites.pad(0.2));
        } else if (grupo.length === 1) {
          mapa.setView([pontos[0].lat, pontos[0].lon], 14);
        }
      })();
    </script>
  </body>
</html>`;
}

export default function MapaVisualScreen({ navigation, route }: Props) {
  const codigoLinha = route.params?.codigoLinha;
  const linhaRotulo = route.params?.linhaRotulo;
  const modoVeiculos = typeof codigoLinha === 'number';

  // Carrega o componente WebView de forma protegida (null = indisponivel).
  const [WebView] = useState(() => carregarWebView());

  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoPosicaoRead[]>([]);
  const [tempoReal, setTempoReal] = useState<boolean>(true);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  // Erro de carregamento do proprio WebView (ex.: pagina/CDN nao carregou).
  const [erroWebView, setErroWebView] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setDetalheErro(null);
    setErroWebView(null);
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

  // Monta os pontos a plotar a partir dos dados ja carregados. Regioes ganham
  // `regiaoId` (balao com link para o Detalhe); veiculos mostram prefixo,
  // acessibilidade e horario.
  const pontos = useMemo<PontoMapa[]>(() => {
    if (modoVeiculos) {
      return veiculos.map((veiculo) => ({
        lat: veiculo.latitude,
        lon: veiculo.longitude,
        titulo: `${linhaRotulo ? linhaRotulo + ' - ' : ''}Prefixo ${veiculo.prefixo}`,
        subtitulo: `${rotuloAcessivel(veiculo.acessivel)} - ${formatarTimestamp(veiculo.timestamp)}`,
      }));
    }
    return regioes.map((regiao) => ({
      lat: regiao.latitude,
      lon: regiao.longitude,
      titulo: regiao.nome,
      subtitulo: `${regiao.cidade} - ${regiao.uf}`,
      regiaoId: regiao.id,
    }));
  }, [modoVeiculos, veiculos, linhaRotulo, regioes]);

  const html = useMemo(() => montarHtmlMapa(pontos), [pontos]);

  // Recebe mensagens do HTML (toque em "Ver detalhe" de uma regiao) e navega.
  const aoReceberMensagem = useCallback(
    (evento: { nativeEvent: { data: string } }) => {
      try {
        const dados = JSON.parse(evento.nativeEvent.data) as MensagemWebView;
        if (
          dados &&
          dados.tipo === 'abrirDetalhe' &&
          typeof dados.regiaoId === 'number'
        ) {
          navigation.navigate('Detalhe', {
            regiaoId: dados.regiaoId,
            regiaoNome: dados.regiaoNome,
          });
        }
      } catch {
        // Mensagem malformada: ignora silenciosamente (nao derruba a tela).
      }
    },
    [navigation],
  );

  // WebView indisponivel (ex.: pacote nao instalado ou plataforma sem suporte):
  // fallback imediato, sem tentar renderizar o mapa.
  if (!WebView) {
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

  // Falha ao carregar a pagina do mapa dentro do WebView (ex.: sem internet
  // para baixar os tiles/Leaflet): mensagem amigavel + voltar + tentar de novo.
  if (erroWebView) {
    return (
      <View style={styles.centro}>
        <Text style={styles.icone}>🗺️</Text>
        <Text style={styles.textoErro}>Nao foi possivel carregar o mapa.</Text>
        <Text style={styles.textoDetalhe}>
          Verifique sua conexao com a internet (o mapa usa o OpenStreetMap). A
          lista de regioes continua funcionando normalmente.
        </Text>
        <Pressable
          style={styles.botao}
          onPress={carregar}
          accessibilityRole="button"
        >
          <Text style={styles.botaoTexto}>Tentar novamente</Text>
        </Pressable>
        <Pressable
          style={styles.botaoSecundario}
          onPress={voltar}
          accessibilityRole="button"
        >
          <Text style={styles.botaoSecundarioTexto}>Voltar para a lista</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {modoVeiculos && !tempoReal ? (
        <View style={styles.faixaAviso}>
          <Text style={styles.faixaAvisoTexto}>{AVISO_DADO_EXEMPLO}</Text>
        </View>
      ) : null}
      <WebView
        style={styles.mapa}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={aoReceberMensagem}
        onError={() =>
          setErroWebView('Falha ao carregar o conteudo do mapa.')
        }
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
  botaoSecundario: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0B6E4F',
  },
  botaoSecundarioTexto: {
    color: '#0B6E4F',
    fontWeight: '600',
    fontSize: 15,
  },
});
