/**
 * Tela de MAPA VISUAL com BUSCA INTEGRADA.
 *
 * Esta tela é uma segunda porta de entrada (mais visual) para o acompanhamento
 * das linhas de ônibus de São Paulo, complementando a tela de Linhas (que segue
 * intacta, em LISTA). O mapa ocupa a tela toda; por cima dele, numa camada React
 * Native sobreposta (NÃO HTML dentro do WebView), ficam:
 *   - uma BARRA DE BUSCA FLUTUANTE no topo (campo "Buscar linha ou parada" +
 *     abas Linhas/Paradas), reutilizando a mesma busca livre da tela de Linhas;
 *   - um PAINEL INFERIOR expansível por toque, que revela os RESULTADOS da busca
 *     e, quando o campo está vazio, a NAVEGAÇÃO ASSISTIDA (catálogo) e os
 *     FAVORITOS. Tocar numa linha a seleciona: o mapa passa a plotar seus
 *     veículos (com auto-refresh) e o painel recolhe.
 *   - um SELETOR DE ESTILO cartográfico (Padrão/Humanitário/Topográfico), que
 *     troca a camada de tiles do Leaflet sem recriar o mapa.
 *
 * Modos do mapa:
 *   - SEM linha selecionada: plota as REGIÕES monitoradas (getRegioes); tocar no
 *     marcador abre um balão com "Ver detalhe" (navega para o Detalhe).
 *   - COM linha selecionada (por parâmetro de rota OU pela busca na tela):
 *     carrega a posição dos veículos (getPosicoesLinha) e os plota, com
 *     auto-refresh (padrão 15s, seletor 10/15/30s, botão pausar). O auto-refresh
 *     atualiza os marcadores via injectJavaScript (window.atualizarVeiculos),
 *     sem recriar o HTML (não pisca, mantém zoom/centro). O fitBounds só ocorre
 *     ao montar um NOVO conjunto de marcadores (ex.: ao selecionar outra linha).
 *
 * COMO O MAPA É DESENHADO (WebView + Leaflet):
 *   Renderizamos um `WebView` (do `react-native-webview`, via wrapper protegido
 *   em src/ui/webview.ts) que carrega um HTML embutido com a Leaflet (via CDN) e
 *   tiles cartográficos SEM chave (OpenStreetMap, HOT e OpenTopoMap). Requer internet para
 *   baixar tiles e a Leaflet; offline, o mapa não carrega, mas a tela de Linhas
 *   (em lista) continua funcionando.
 *
 * Referências:
 *   - react-native-webview (SDK 58): https://docs.expo.dev/versions/v58.0.0/sdk/webview/
 *   - Leaflet: https://leafletjs.com/reference.html
 *   - OpenStreetMap (tiles): https://www.openstreetmap.org/
 *   - OpenStreetMap Humanitarian (HOT): https://www.openstreetmap.fr/hot/
 *   - OpenTopoMap: https://opentopomap.org/about
 *
 * Onde é aplicado: rota "MapaVisual" em App.tsx.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getRegioes, getPosicoesLinha, ApiError } from '../api/client';
import { LinhaRead, Regiao, VeiculoPosicaoRead } from '../types';
import { RootStackParamList } from '../navigation';
import { EstadoCarregando, EstadoErro } from '../ui/estados';
import {
  AVISO_DADO_EXEMPLO,
  formatarHora,
  formatarTimestamp,
  rotuloAcessivel,
} from '../ui/rotulos';
import { carregarWebView } from '../ui/webview';
import {
  LinhaFavorita,
  alternarFavoritoLinha,
  carregarFavoritosLinhas,
} from '../ui/favoritos';
import {
  ESTILOS_MAPA,
  ESTILO_PADRAO,
  EstiloMapaId,
  carregarEstiloMapa,
  salvarEstiloMapa,
} from '../ui/estiloMapa';
import MapaBuscaOverlay from './MapaBuscaOverlay';

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

/** Identificador de linha ativa (selecionada por rota ou pela busca na tela). */
interface LinhaAtiva {
  codigoLinha: number;
  rotulo?: string;
}

/**
 * Monta o HTML completo do mapa com os pontos e o ESTILO inicial já embutidos.
 *
 * Os pontos são injetados via JSON.stringify (serialização segura) e o caractere
 * "<" é escapado como "\\u003c" para impedir que um nome contendo "</script>"
 * feche o bloco <script> prematuramente. A Leaflet vem por CDN (unpkg); os tiles
 * vêm de provedores cartográficos sem chave (OpenStreetMap, HOT e OpenTopoMap).
 *
 * Expõe duas funções globais usadas pelo React via injectJavaScript:
 *   - window.atualizarVeiculos(json): troca apenas os marcadores de veículo
 *     (auto-refresh), preservando zoom/centro;
 *   - window.trocarEstiloMapa(estiloJson): troca a camada de tiles atual pela
 *     nova, preservando os marcadores (seletor de estilo).
 */
function montarHtmlMapa(pontos: PontoMapa[], estiloId: EstiloMapaId): string {
  const pontosJson = JSON.stringify(pontos).replace(/</g, '\\u003c');
  const estilosJson = JSON.stringify(ESTILOS_MAPA).replace(/</g, '\\u003c');
  const estiloInicialJson = JSON.stringify(estiloId).replace(/</g, '\\u003c');
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
        var estilos = ${estilosJson};
        var estiloInicial = ${estiloInicialJson};
        var mapa = L.map('mapa').setView([${SP_LAT}, ${SP_LON}], ${SP_ZOOM});

        // Camada de tiles atual (cartográfica, sem chave). Guardada numa variável
        // para que o seletor de estilo possa remover e recriar sem recriar o mapa
        // nem perder os marcadores.
        var camadaTiles = null;

        function definicaoEstilo(id) {
          for (var i = 0; i < estilos.length; i += 1) {
            if (estilos[i].id === id) {
              return estilos[i];
            }
          }
          return estilos[0];
        }

        function aplicarEstilo(id) {
          var def = definicaoEstilo(id);
          if (camadaTiles) {
            mapa.removeLayer(camadaTiles);
          }
          camadaTiles = L.tileLayer(def.url, {
            maxZoom: def.maxZoom,
            attribution: def.atribuicao
          }).addTo(mapa);
        }

        aplicarEstilo(estiloInicial);

        // Camada SOMENTE dos marcadores de veiculo: isolamos os veiculos numa
        // LayerGroup propria para que o auto-refresh (window.atualizarVeiculos)
        // possa remover e recriar os veiculos sem recriar o mapa inteiro, sem
        // piscar e sem resetar o zoom/centro escolhido pelo usuario.
        var camadaVeiculos = L.layerGroup().addTo(mapa);

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

        // Enquadra todos os marcadores APENAS na primeira carga deste HTML.
        // Como um novo conjunto (ex.: outra linha) gera um HTML novo, o
        // fitBounds roda de novo so quando o conjunto muda.
        if (grupo.length > 1) {
          var limites = L.featureGroup(grupo).getBounds();
          mapa.fitBounds(limites.pad(0.2));
        } else if (grupo.length === 1) {
          var primeiro = regiaoPontos.concat(veiculoPontos)[0];
          mapa.setView([primeiro.lat, primeiro.lon], 14);
        }

        // Ponte React -> WebView: auto-refresh dos veiculos. Substitui APENAS os
        // marcadores de veiculo, preservando o zoom/centro atual do usuario.
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

        // Ponte React -> WebView: troca de estilo cartografico. Recebe o id do
        // estilo como string JSON e troca a camada de tiles preservando os
        // marcadores (regioes e veiculos continuam no mapa).
        window.trocarEstiloMapa = function (idJson) {
          try {
            var id = JSON.parse(idJson);
            aplicarEstilo(id);
          } catch (e) {
            // Id invalido: ignora para nao derrubar o mapa.
          }
          return true;
        };
      })();
    </script>
  </body>
</html>`;
}

export default function MapaVisualScreen({ navigation, route }: Props) {
  // Linha ativa: inicia a partir do parametro de rota (quando veio da tela de
  // Linhas) e pode mudar em runtime pela busca integrada nesta tela.
  const [linhaAtiva, setLinhaAtiva] = useState<LinhaAtiva | null>(() =>
    typeof route.params?.codigoLinha === 'number'
      ? {
          codigoLinha: route.params.codigoLinha,
          rotulo: route.params.linhaRotulo,
        }
      : null,
  );
  // Linha selecionada completa (LinhaRead), quando escolhida pela busca. Usada
  // para refletir a seleção/estrela no overlay. Null quando a linha veio só por
  // parametro de rota (sem o objeto completo) ou quando mostramos regioes.
  const [linhaSelecionada, setLinhaSelecionada] = useState<LinhaRead | null>(
    null,
  );
  const modoVeiculos = linhaAtiva !== null;
  const codigoLinha = linhaAtiva?.codigoLinha;
  const linhaRotulo = linhaAtiva?.rotulo;

  // Carrega o componente WebView de forma protegida (null = indisponivel).
  const [WebView] = useState(() => carregarWebView());
  const webviewRef = useRef<any>(null);
  const webviewPronto = useRef<boolean>(false);
  const montado = useRef<boolean>(true);

  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoPosicaoRead[]>([]);
  const [tempoReal, setTempoReal] = useState<boolean>(true);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const [erroWebView, setErroWebView] = useState<string | null>(null);

  // Estado do auto-refresh (apenas no modo veiculos).
  const [pausado, setPausado] = useState<boolean>(false);
  const [intervaloSegundos, setIntervaloSegundos] = useState<number>(
    INTERVALO_PADRAO_SEGUNDOS,
  );
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  // Favoritos locais (reutiliza src/ui/favoritos.ts). Carregados uma vez.
  const [favoritos, setFavoritos] = useState<LinhaFavorita[]>([]);

  // Estilo cartografico atual do mapa (reutiliza src/ui/estiloMapa.ts).
  const [estiloMapa, setEstiloMapa] = useState<EstiloMapaId>(ESTILO_PADRAO);
  // Ref que acompanha o estilo atual para ser aplicado assim que o WebView
  // terminar de carregar (ex.: preferencia persistida resolvida depois do
  // 1o render, ou um remount por nova geração de HTML).
  const estiloMapaRef = useRef<EstiloMapaId>(ESTILO_PADRAO);
  useEffect(() => {
    estiloMapaRef.current = estiloMapa;
  }, [estiloMapa]);
  // Id de "geração" do HTML: muda quando trocamos o conjunto de marcadores
  // (nova linha, ou alternancia regioes<->veiculos), forçando um remount do
  // WebView com fitBounds no novo conjunto. NÃO muda a cada auto-refresh.
  const [geracao, setGeracao] = useState<number>(0);

  // Controla a flag de montagem (cleanup no unmount).
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // Carrega favoritos e a preferencia de estilo uma vez ao abrir a tela.
  useEffect(() => {
    let ativo = true;
    void carregarFavoritosLinhas().then((lista) => {
      if (ativo) {
        setFavoritos(lista);
      }
    });
    void carregarEstiloMapa().then((id) => {
      if (ativo) {
        setEstiloMapa(id);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  // Monta os pontos de VEICULO a partir de uma lista de posicoes.
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

  // Carga INICIAL / ao trocar de modo (regioes <-> veiculos) ou de linha.
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setDetalheErro(null);
    setErroWebView(null);
    webviewPronto.current = false;
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
      if (montado.current) {
        // Novo conjunto de marcadores: nova geração de HTML (fitBounds roda).
        setGeracao((g) => g + 1);
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

  // Atualizacao SILENCIOSA das posicoes (auto-refresh) via injectJavaScript.
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
        const json = JSON.stringify(pontosVeiculos).replace(/</g, '\\u003c');
        webviewRef.current.injectJavaScript(
          `window.atualizarVeiculos && window.atualizarVeiculos(${JSON.stringify(
            json,
          )}); true;`,
        );
      }
    } catch {
      // Falha transitoria de rede num ciclo de refresh: ignora e tenta depois.
    }
  }, [codigoLinha, modoVeiculos, montarPontosVeiculos]);

  // Timer do auto-refresh.
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

  // Seleciona uma linha pela busca integrada: troca para o modo veiculos,
  // reinicia o auto-refresh e força uma nova geração de HTML (fitBounds).
  const selecionarLinha = useCallback((linha: LinhaRead) => {
    setLinhaSelecionada(linha);
    setLinhaAtiva({ codigoLinha: linha.codigo_linha, rotulo: linha.letreiro });
    setPausado(false);
    setUltimaAtualizacao(null);
  }, []);

  // Alterna o favorito de uma linha (reutiliza favoritos.ts) e atualiza o estado.
  const alternarFavorito = useCallback(async (linha: LinhaRead) => {
    const atualizada = await alternarFavoritoLinha(linha);
    if (montado.current) {
      setFavoritos(atualizada);
    }
  }, []);

  // Aplica um estilo cartografico no mapa ja carregado via injectJavaScript
  // (sem recriar o WebView). Idempotente e seguro de chamar repetidamente.
  const aplicarEstiloNoMapa = useCallback((id: EstiloMapaId) => {
    if (webviewRef.current && webviewPronto.current) {
      const json = JSON.stringify(id).replace(/</g, '\\u003c');
      webviewRef.current.injectJavaScript(
        `window.trocarEstiloMapa && window.trocarEstiloMapa(${JSON.stringify(
          json,
        )}); true;`,
      );
    }
  }, []);

  // Troca o estilo cartografico (acao do usuario): atualiza o estado, persiste a
  // preferencia e aplica no mapa imediatamente.
  const trocarEstilo = useCallback(
    (id: EstiloMapaId) => {
      setEstiloMapa(id);
      void salvarEstiloMapa(id);
      aplicarEstiloNoMapa(id);
    },
    [aplicarEstiloNoMapa],
  );

  // Marca o WebView como pronto e aplica o estilo atual. Cobre o caso de a
  // preferencia persistida ter sido resolvida depois do HTML inicial (que foi
  // montado com o estilo padrao) e o caso de remount por nova geração.
  const aoCarregarWebView = useCallback(() => {
    webviewPronto.current = true;
    aplicarEstiloNoMapa(estiloMapaRef.current);
  }, [aplicarEstiloNoMapa]);

  // Monta os pontos a plotar a partir dos dados ja carregados.
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

  // HTML "semente" do mapa, memorizado por GERAÇÃO: só muda quando o conjunto de
  // marcadores muda (nova linha, troca de modo). Assim o auto-refresh (que vai
  // por injectJavaScript) NÃO recria o WebView. O estilo inicial embutido é o
  // atual; trocas posteriores de estilo também vão por injectJavaScript.
  const html = useMemo(() => {
    if (carregando) {
      return '';
    }
    return montarHtmlMapa(pontos, estiloMapa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geracao, carregando]);

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

  // WebView indisponivel: fallback imediato, sem tentar renderizar o mapa.
  if (!WebView) {
    return (
      <View style={styles.centro}>
        <Text style={styles.icone}>🗺️</Text>
        <Text style={styles.textoErro}>
          O mapa nao esta disponivel neste dispositivo.
        </Text>
        <Text style={styles.textoDetalhe}>
          Use a tela de Linhas para buscar e acompanhar as linhas em lista.
        </Text>
        <Pressable
          style={styles.botao}
          onPress={voltar}
          accessibilityRole="button"
        >
          <Text style={styles.botaoTexto}>Voltar</Text>
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

  // Falha ao carregar a pagina do mapa dentro do WebView (ex.: sem internet).
  if (erroWebView) {
    return (
      <View style={styles.centro}>
        <Text style={styles.icone}>🗺️</Text>
        <Text style={styles.textoErro}>Nao foi possivel carregar o mapa.</Text>
        <Text style={styles.textoDetalhe}>
          Verifique sua conexao com a internet (o mapa usa tiles cartograficos
          online). A tela de Linhas continua funcionando em lista.
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
          <Text style={styles.botaoSecundarioTexto}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  // Quantidade de veiculos em operacao (para o resumo do painel). Null quando
  // estamos no modo regioes (sem linha selecionada).
  const quantidadeVeiculos = modoVeiculos ? veiculos.length : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* O MAPA ocupa a tela toda, no fundo. */}
      <WebView
        // A key muda por GERAÇÃO para forçar o remount (e o fitBounds) quando o
        // conjunto de marcadores muda; o auto-refresh NÃO altera a geração.
        key={`mapa-${geracao}`}
        ref={webviewRef}
        style={styles.mapa}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={aoReceberMensagem}
        onLoadEnd={aoCarregarWebView}
        onError={() => setErroWebView('Falha ao carregar o conteudo do mapa.')}
      />

      {/* Faixa de aviso de dado de EXEMPLO (fallback sem token), sobre o mapa. */}
      {modoVeiculos && !tempoReal ? (
        <View style={styles.faixaAviso} pointerEvents="none">
          <Text style={styles.faixaAvisoTexto}>{AVISO_DADO_EXEMPLO}</Text>
        </View>
      ) : null}

      {/* Barra de auto-refresh (apenas no modo veiculos), sobre o mapa, logo
          abaixo da barra de busca. */}
      {modoVeiculos ? (
        <View style={styles.barraRefresh} pointerEvents="box-none">
          <View style={styles.barraRefreshCartao}>
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
        </View>
      ) : null}

      {/* Camada de BUSCA/CATÁLOGO + seletor de estilo, sobreposta ao mapa. */}
      <MapaBuscaOverlay
        linhaSelecionada={linhaSelecionada}
        linhaRotulo={linhaRotulo}
        quantidadeVeiculos={quantidadeVeiculos}
        favoritos={favoritos}
        aoSelecionarLinha={selecionarLinha}
        aoAlternarFavorito={alternarFavorito}
        estilos={ESTILOS_MAPA}
        estiloAtual={estiloMapa}
        aoTrocarEstilo={trocarEstilo}
      />
    </KeyboardAvoidingView>
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
  // Faixa de aviso flutuante, logo abaixo da barra de refresh.
  faixaAviso: {
    position: 'absolute',
    top: 212,
    left: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  faixaAvisoTexto: {
    fontSize: 12,
    color: '#B45309',
  },
  // Barra de auto-refresh flutuante (abaixo da barra de busca).
  barraRefresh: {
    position: 'absolute',
    top: 128,
    left: 12,
    right: 12,
    zIndex: 10,
  },
  barraRefreshCartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
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
