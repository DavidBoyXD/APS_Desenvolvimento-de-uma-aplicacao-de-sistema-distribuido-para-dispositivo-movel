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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getRegioes, getPosicoesLinha, ApiError } from '../api/client';
import { Regiao, VeiculoPosicaoRead } from '../types';
import { RootStackParamList } from '../navigation';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../ui/estados';
import {
  AVISO_DADO_EXEMPLO,
  formatarHora,
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

/**
 * Intervalos (em segundos) oferecidos ao usuario para o auto-refresh da posicao
 * dos veiculos no mapa. O padrao e 15s: um equilibrio entre dado atual e numero
 * de requisicoes feitas ao servidor.
 */
const INTERVALOS_SEGUNDOS = [10, 15, 30] as const;
const INTERVALO_PADRAO_SEGUNDOS = 15;

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

        // Camada SOMENTE dos marcadores de veiculo: isolamos os veiculos numa
        // LayerGroup propria para que o auto-refresh (window.atualizarVeiculos)
        // possa remover e recriar os veiculos sem recriar o mapa inteiro, sem
        // piscar e sem resetar o zoom/centro escolhido pelo usuario.
        var camadaVeiculos = L.layerGroup().addTo(mapa);

        // Cria o balao (popup) de um ponto. Para REGIOES (com regiaoId) inclui
        // o link "Ver detalhe", que avisa o React via postMessage.
        function criarPopup(p) {
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
          return cont;
        }

        // Desenha marcadores de veiculo na camada propria (usada no 1o render e
        // a cada atualizacao). Retorna a lista de marcadores criados.
        function desenharVeiculos(lista) {
          var criados = [];
          lista.forEach(function (p) {
            var marcador = L.marker([p.lat, p.lon]);
            marcador.bindPopup(criarPopup(p));
            marcador.addTo(camadaVeiculos);
            criados.push(marcador);
          });
          return criados;
        }

        var regiaoPontos = pontos.filter(function (p) {
          return typeof p.regiaoId === 'number';
        });
        var veiculoPontos = pontos.filter(function (p) {
          return typeof p.regiaoId !== 'number';
        });

        // Regioes sao estaticas: desenhadas diretamente no mapa (fora da camada
        // de veiculos), pois nao sofrem auto-refresh.
        var grupo = [];
        regiaoPontos.forEach(function (p) {
          var marcador = L.marker([p.lat, p.lon]).addTo(mapa);
          marcador.bindPopup(criarPopup(p));
          grupo.push(marcador);
        });
        desenharVeiculos(veiculoPontos).forEach(function (m) {
          grupo.push(m);
        });

        // Enquadra todos os marcadores APENAS na primeira carga. Atualizacoes
        // posteriores de veiculo nao mexem no zoom/centro (ver atualizarVeiculos).
        if (grupo.length > 1) {
          var limites = L.featureGroup(grupo).getBounds();
          mapa.fitBounds(limites.pad(0.2));
        } else if (grupo.length === 1) {
          var primeiro = regiaoPontos.concat(veiculoPontos)[0];
          mapa.setView([primeiro.lat, primeiro.lon], 14);
        }

        // Ponte React -> WebView: o React chama window.atualizarVeiculos(json)
        // (via injectJavaScript) a cada ciclo de auto-refresh. Substituimos APENAS
        // os marcadores de veiculo, preservando o zoom/centro atual do usuario.
        // O 'json' chega como string serializada (com "<" ja escapado no React).
        window.atualizarVeiculos = function (json) {
          try {
            var novos = JSON.parse(json);
            camadaVeiculos.clearLayers();
            desenharVeiculos(novos);
          } catch (e) {
            // JSON invalido: ignora para nao derrubar o mapa.
          }
          return true;
        };
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
  // Ref do WebView: usada para enviar atualizacoes de veiculo via
  // injectJavaScript sem recriar o HTML (evita piscar e resetar o zoom).
  const webviewRef = useRef<any>(null);
  // Sinaliza que o WebView terminou de carregar o HTML (window.atualizarVeiculos
  // ja existe). Evita injetar JS antes de a pagina estar pronta.
  const webviewPronto = useRef<boolean>(false);
  // Flag de montagem: impede setState apos o unmount (sem vazamento).
  const montado = useRef<boolean>(true);

  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoPosicaoRead[]>([]);
  const [tempoReal, setTempoReal] = useState<boolean>(true);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  // Erro de carregamento do proprio WebView (ex.: pagina/CDN nao carregou).
  const [erroWebView, setErroWebView] = useState<string | null>(null);

  // Estado do auto-refresh (apenas no modo veiculos).
  const [pausado, setPausado] = useState<boolean>(false);
  const [intervaloSegundos, setIntervaloSegundos] = useState<number>(
    INTERVALO_PADRAO_SEGUNDOS,
  );
  // Horario da ultima atualizacao bem-sucedida das posicoes (null = nenhuma).
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  // Monta os pontos de VEICULO a partir de uma lista de posicoes. Extraida para
  // reuso: o 1o render usa no HTML inicial e o auto-refresh injeta via JS.
  const montarPontosVeiculos = useCallback(
    (lista: VeiculoPosicaoRead[]): PontoMapa[] =>
      lista.map((veiculo) => ({
        lat: veiculo.latitude,
        lon: veiculo.longitude,
        titulo: `${linhaRotulo ? linhaRotulo + ' - ' : ''}Prefixo ${veiculo.prefixo}`,
        subtitulo: `${rotuloAcessivel(veiculo.acessivel)} - ${formatarTimestamp(veiculo.timestamp)}`,
      })),
    [linhaRotulo],
  );

  // Carga INICIAL (bloqueante): mostra os estados de carregando/erro/vazio.
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setDetalheErro(null);
    setErroWebView(null);
    try {
      if (modoVeiculos && typeof codigoLinha === 'number') {
        const dados = await getPosicoesLinha(codigoLinha);
        if (!montado.current) {
          return;
        }
        setVeiculos(dados.veiculos);
        setTempoReal(dados.tempo_real);
        setUltimaAtualizacao(new Date());
      } else {
        const dados = await getRegioes();
        if (!montado.current) {
          return;
        }
        setRegioes(dados);
      }
    } catch (e) {
      if (!montado.current) {
        return;
      }
      const msg =
        e instanceof ApiError
          ? e.mensagem
          : 'Ocorreu um erro inesperado ao carregar o mapa.';
      setErro(msg);
      setDetalheErro(e instanceof ApiError ? e.detalhe ?? null : null);
    } finally {
      if (montado.current) {
        setCarregando(false);
      }
    }
  }, [codigoLinha, modoVeiculos]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Controla a flag de montagem (cleanup no unmount).
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // Atualizacao SILENCIOSA das posicoes (auto-refresh): rebusca e injeta os
  // novos marcadores no WebView via window.atualizarVeiculos, sem recriar o
  // HTML (nao pisca, mantem zoom/centro). Nao mexe nos estados de
  // carregando/erro de tela cheia para nao interromper a visualizacao.
  const atualizarPosicoes = useCallback(async () => {
    if (!modoVeiculos || typeof codigoLinha !== 'number') {
      return;
    }
    try {
      const dados = await getPosicoesLinha(codigoLinha);
      if (!montado.current) {
        return;
      }
      setVeiculos(dados.veiculos);
      setTempoReal(dados.tempo_real);
      setUltimaAtualizacao(new Date());
      if (webviewRef.current && webviewPronto.current) {
        const pontosVeiculos = montarPontosVeiculos(dados.veiculos);
        // Serializa e escapa "<" como no HTML inicial (evita quebra de contexto).
        const json = JSON.stringify(pontosVeiculos).replace(/</g, '\\u003c');
        webviewRef.current.injectJavaScript(
          `window.atualizarVeiculos && window.atualizarVeiculos(${JSON.stringify(
            json,
          )}); true;`,
        );
      }
    } catch {
      // Falha transitoria de rede num ciclo de refresh: ignora e tenta no
      // proximo ciclo. A carga inicial ja trata o erro de tela cheia.
    }
  }, [codigoLinha, modoVeiculos, montarPontosVeiculos]);

  // Timer do auto-refresh: ativo somente no modo veiculos, sem erro, nao
  // pausado e com o WebView disponivel. Cleanup limpa o setInterval ao
  // desmontar, ao pausar, ao trocar o intervalo ou ao sair da tela.
  useEffect(() => {
    if (!modoVeiculos || pausado || erro || !WebView) {
      return;
    }
    const id = setInterval(() => {
      atualizarPosicoes();
    }, intervaloSegundos * 1000);
    return () => clearInterval(id);
  }, [
    modoVeiculos,
    pausado,
    erro,
    WebView,
    intervaloSegundos,
    atualizarPosicoes,
  ]);

  const voltar = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const alternarPausa = useCallback(() => {
    setPausado((atual) => !atual);
  }, []);

  // Monta os pontos a plotar a partir dos dados ja carregados. Regioes ganham
  // `regiaoId` (balao com link para o Detalhe); veiculos mostram prefixo,
  // acessibilidade e horario. ATENCAO: no modo veiculos, usamos o PRIMEIRO
  // conjunto de veiculos apenas para o HTML INICIAL; as atualizacoes seguintes
  // vao por injectJavaScript (ver atualizarPosicoes) para nao recriar o mapa.
  const pontos = useMemo<PontoMapa[]>(() => {
    if (modoVeiculos) {
      return montarPontosVeiculos(veiculos);
    }
    return regioes.map((regiao) => ({
      lat: regiao.latitude,
      lon: regiao.longitude,
      titulo: regiao.nome,
      subtitulo: `${regiao.cidade} - ${regiao.uf}`,
      regiaoId: regiao.id,
    }));
  }, [modoVeiculos, veiculos, montarPontosVeiculos, regioes]);

  // HTML do mapa montado UMA VEZ por carga inicial no modo veiculos. Guardamos
  // o HTML "semente" num ref para que ele NAO mude a cada refresh (se mudasse,
  // o WebView recarregaria e piscaria/resetaria o zoom). As atualizacoes de
  // posicao posteriores passam por injectJavaScript (ver atualizarPosicoes).
  const htmlSemente = useRef<string | null>(null);
  if (modoVeiculos && htmlSemente.current === null && !carregando) {
    htmlSemente.current = montarHtmlMapa(pontos);
  }
  // No modo regioes o HTML acompanha os pontos de regiao (dado estatico, sem
  // auto-refresh). No modo veiculos usamos a semente congelada.
  const htmlRegioes = useMemo(
    () => (modoVeiculos ? '' : montarHtmlMapa(pontos)),
    [modoVeiculos, pontos],
  );
  const html = modoVeiculos ? htmlSemente.current ?? '' : htmlRegioes;

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
      {/* Barra de auto-refresh (apenas no modo veiculos). */}
      {modoVeiculos ? (
        <View style={styles.barraRefresh}>
          <View style={styles.barraRefreshInfo}>
            <Text style={styles.barraRefreshTexto}>
              {pausado
                ? 'Pausado'
                : `Atualizando a cada ${intervaloSegundos}s`}
            </Text>
            {ultimaAtualizacao ? (
              <Text style={styles.barraRefreshSub}>
                Ultima atualizacao: {formatarHora(ultimaAtualizacao)}
              </Text>
            ) : null}
          </View>
          <View style={styles.barraRefreshControles}>
            {INTERVALOS_SEGUNDOS.map((opcao) => (
              <Pressable
                key={opcao}
                style={[
                  styles.chipIntervalo,
                  intervaloSegundos === opcao && styles.chipIntervaloAtivo,
                ]}
                onPress={() => setIntervaloSegundos(opcao)}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.chipIntervaloTexto,
                    intervaloSegundos === opcao &&
                      styles.chipIntervaloTextoAtivo,
                  ]}
                >
                  {opcao}s
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.botaoPausar}
              onPress={alternarPausa}
              accessibilityRole="button"
            >
              <Text style={styles.botaoPausarTexto}>
                {pausado ? 'Retomar' : 'Pausar'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <WebView
        ref={webviewRef}
        style={styles.mapa}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={aoReceberMensagem}
        onLoadEnd={() => {
          webviewPronto.current = true;
        }}
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
  barraRefresh: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  barraRefreshInfo: {
    gap: 2,
  },
  barraRefreshTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  barraRefreshSub: {
    fontSize: 11,
    color: '#64748B',
  },
  barraRefreshControles: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipIntervalo: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  chipIntervaloAtivo: {
    backgroundColor: '#0B6E4F',
    borderColor: '#0B6E4F',
  },
  chipIntervaloTexto: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  chipIntervaloTextoAtivo: {
    color: '#FFFFFF',
  },
  botaoPausar: {
    marginLeft: 'auto',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0B6E4F',
    backgroundColor: '#E6F2ED',
  },
  botaoPausarTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B6E4F',
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
