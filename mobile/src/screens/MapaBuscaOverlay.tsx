/**
 * Camada de BUSCA/CATÁLOGO sobreposta ao MAPA (MapaVisualScreen).
 *
 * Estes componentes são React Native puro, posicionados ACIMA do WebView do
 * mapa (position: absolute + zIndex). NÃO são HTML dentro do WebView: ficam na
 * árvore nativa, por cima do mapa, de modo que a busca e o catálogo funcionem
 * independentemente do conteúdo renderizado pela Leaflet.
 *
 * Duas peças principais:
 *   - BarraBuscaFlutuante: campo "Buscar linha ou parada" + abas Linhas/Paradas,
 *     flutuando no topo. Reutiliza a MESMA busca livre da tela de Linhas
 *     (buscarLinhas/buscarParadas via client.ts), preservando a liberdade de
 *     pesquisar QUALQUER linha.
 *   - PainelInferior: painel expansível por TOQUE (cabeçalho tocável que alterna
 *     recolhido/expandido, sem gesto de arrastar/biblioteca de bottom-sheet).
 *     Recolhido mostra um resumo; expandido revela os RESULTADOS da busca e,
 *     quando o campo está vazio, a NAVEGAÇÃO ASSISTIDA (catálogo de
 *     src/ui/catalogo.ts) e os FAVORITOS (src/ui/favoritos.ts). Este menu faz as
 *     DUAS coisas: na aba Linhas, tocar em "Ver no mapa" plota a posição dos
 *     ônibus da linha; na aba Paradas, tocar em "Ver no mapa" localiza a parada.
 *
 * Onde é aplicado: src/screens/MapaVisualScreen.tsx.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, buscarLinhas, buscarParadas } from '../api/client';
import { LinhaRead, ParadaRead } from '../types';
import { DICA_BUSCA_PARADA } from '../ui/catalogo';
import { LinhaFavorita } from '../ui/favoritos';
import { AVISO_DADO_EXEMPLO, rotuloSentido } from '../ui/rotulos';
import { ordenarPorSimilaridade, variacoesDeTermo } from '../ui/busca';

/** Aba de busca ativa: linhas ou paradas (mesma semântica da tela de Linhas). */
export type AbaBusca = 'linhas' | 'paradas';

/** Mensagem PT-BR de uma falha, usando ApiError quando disponível. */
function mensagemDeErro(e: unknown, padrao: string): string {
  return e instanceof ApiError ? e.mensagem : padrao;
}

/** Detalhe técnico de uma falha (quando for ApiError). */
function detalheDeErro(e: unknown): string | null {
  return e instanceof ApiError ? e.detalhe ?? null : null;
}

/** Identidade de um letreiro para comparar favoritos (sem caixa/espaços). */
function identidade(letreiro: string): string {
  return letreiro.trim().toLowerCase();
}

/**
 * Props da camada de busca. A tela do mapa é dona do ciclo de vida: fornece os
 * favoritos (em estado), a linha selecionada e os callbacks de seleção/favorito.
 * Toda a lógica de busca vive aqui dentro.
 */
interface MapaBuscaOverlayProps {
  /** Linha atualmente selecionada (plotada no mapa), ou null para regiões. */
  linhaSelecionada: LinhaRead | null;
  /** Rótulo opcional da linha selecionada (quando veio por parâmetro de rota). */
  linhaRotulo?: string;
  /** Quantidade de veículos em operação da linha selecionada (para o resumo). */
  quantidadeVeiculos: number | null;
  /** Favoritos salvos localmente (estado mantido pela tela). */
  favoritos: LinhaFavorita[];
  /** Seleciona uma linha: o mapa passa a plotar seus veículos e o painel recolhe. */
  aoSelecionarLinha: (linha: LinhaRead) => void;
  /** Seleciona uma parada: o mapa plota o marcador da parada e o painel recolhe. */
  aoSelecionarParada: (parada: ParadaRead) => void;
  /** Alterna o favorito de uma linha (estrela). */
  aoAlternarFavorito: (linha: LinhaRead) => void;
}

export default function MapaBuscaOverlay({
  linhaSelecionada,
  linhaRotulo,
  quantidadeVeiculos,
  favoritos,
  aoSelecionarLinha,
  aoSelecionarParada,
  aoAlternarFavorito,
}: MapaBuscaOverlayProps) {
  const [aba, setAba] = useState<AbaBusca>('linhas');
  const [termo, setTermo] = useState<string>('');
  const [expandido, setExpandido] = useState<boolean>(false);

  // Insets da safe area: usados para a barra de busca respeitar o topo (status
  // bar/notch) e o painel inferior respeitar a barra de navegação do Android
  // (botões voltar/home/recentes) ou a home indicator do iOS.
  const insets = useSafeAreaInsets();

  // Resultados da busca (null = nenhuma busca feita ainda nesta aba).
  const [linhas, setLinhas] = useState<LinhaRead[] | null>(null);
  const [paradas, setParadas] = useState<ParadaRead[] | null>(null);
  const [buscando, setBuscando] = useState<boolean>(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [detalheBusca, setDetalheBusca] = useState<string | null>(null);

  // Flag de montagem: impede setState após o unmount (sem vazamento).
  const [montado] = useState<{ ativo: boolean }>(() => ({ ativo: true }));
  useEffect(() => {
    montado.ativo = true;
    return () => {
      montado.ativo = false;
    };
  }, [montado]);

  /** Troca a aba ativa e limpa os resultados/erros anteriores. */
  const trocarAba = useCallback((nova: AbaBusca) => {
    setAba(nova);
    setLinhas(null);
    setParadas(null);
    setErroBusca(null);
    setDetalheBusca(null);
  }, []);

  /**
   * Executa a busca reutilizando buscarLinhas/buscarParadas. Aceita um termo
   * EXPLÍCITO (atalhos do catálogo/favoritos) ou usa o termo digitado. Sempre
   * expande o painel para mostrar os resultados.
   */
  const executarBusca = useCallback(
    async (termoAlvo?: string) => {
      const termoLimpo = (termoAlvo ?? termo).trim();
      if (termoLimpo.length === 0) {
        setErroBusca('Informe um termo para buscar.');
        setDetalheBusca(null);
        setExpandido(true);
        return;
      }
      if (termoAlvo !== undefined && termoAlvo !== termo) {
        setTermo(termoAlvo);
      }
      setExpandido(true);
      setBuscando(true);
      setErroBusca(null);
      setDetalheBusca(null);
      try {
        if (aba === 'linhas') {
          const resultado = await buscarLinhas(termoLimpo);
          if (!montado.ativo) {
            return;
          }
          // Busca aproximada (fuzzy): ordena por similaridade com o termo.
          setLinhas(
            ordenarPorSimilaridade(
              resultado,
              termoLimpo,
              (linha) => linha.letreiro,
            ),
          );
          setParadas(null);
        } else {
          // Tenta o termo do usuário; se vier vazio, tenta variações abreviadas
          // (no máximo 2 tentativas no total) antes de desistir.
          let resultado: ParadaRead[] = [];
          for (const variacao of variacoesDeTermo(termoLimpo, 2)) {
            resultado = await buscarParadas(variacao);
            if (resultado.length > 0) {
              break;
            }
          }
          if (!montado.ativo) {
            return;
          }
          setParadas(
            ordenarPorSimilaridade(
              resultado,
              termoLimpo,
              (parada) => parada.nome,
            ),
          );
          setLinhas(null);
        }
      } catch (e) {
        if (!montado.ativo) {
          return;
        }
        setErroBusca(mensagemDeErro(e, 'Não foi possível realizar a busca.'));
        setDetalheBusca(detalheDeErro(e));
      } finally {
        if (montado.ativo) {
          setBuscando(false);
        }
      }
    },
    [aba, termo, montado],
  );

  const onBuscar = useCallback(() => {
    void executarBusca();
  }, [executarBusca]);

  const buscarPorTermo = useCallback(
    (termoAlvo: string) => {
      void executarBusca(termoAlvo);
    },
    [executarBusca],
  );

  /** Seleciona uma linha dos resultados: avisa a tela e recolhe o painel. */
  const selecionar = useCallback(
    (linha: LinhaRead) => {
      aoSelecionarLinha(linha);
      setExpandido(false);
    },
    [aoSelecionarLinha],
  );

  /** Seleciona uma parada dos resultados: plota no mapa e recolhe o painel. */
  const selecionarParada = useCallback(
    (parada: ParadaRead) => {
      aoSelecionarParada(parada);
      setExpandido(false);
    },
    [aoSelecionarParada],
  );

  /** Verificação SÍNCRONA de favorito (para a estrela), pelo letreiro. */
  const favoritada = useCallback(
    (letreiro: string): boolean => {
      const alvo = identidade(letreiro);
      return favoritos.some((item) => identidade(item.letreiro) === alvo);
    },
    [favoritos],
  );

  const resultadosAtuais = aba === 'linhas' ? linhas : paradas;
  const mostrarCatalogo =
    termo.trim().length === 0 && resultadosAtuais === null && !buscando;

  // Texto de resumo do cabeçalho recolhido do painel inferior.
  const resumo = (() => {
    if (linhaSelecionada || linhaRotulo) {
      const nome = linhaSelecionada?.letreiro ?? linhaRotulo ?? 'Linha';
      if (typeof quantidadeVeiculos === 'number') {
        const sufixo =
          quantidadeVeiculos === 1 ? '1 veículo' : `${quantidadeVeiculos} veículos`;
        return `${nome} · ${sufixo} em operação`;
      }
      return nome;
    }
    return 'Toque para ver ônibus de uma linha ou localizar uma parada';
  })();

  return (
    <>
      {/* BARRA DE BUSCA FLUTUANTE no topo, sobre o mapa. Usa um padding fixo
          pequeno: o inset superior (status bar/notch) NÃO é somado aqui porque
          deixava espaço sobrando no topo. O valor fixo já afasta a barra o
          suficiente da status bar sem colar nela. */}
      <View style={styles.barraBusca} pointerEvents="box-none">
        <View style={styles.barraBuscaCartao}>
          <View style={styles.abas}>
            <BotaoAba
              texto="Linhas"
              ativo={aba === 'linhas'}
              onPress={() => trocarAba('linhas')}
            />
            <BotaoAba
              texto="Paradas"
              ativo={aba === 'paradas'}
              onPress={() => trocarAba('paradas')}
            />
          </View>
          <View style={styles.campoLinha}>
            <TextInput
              style={styles.input}
              value={termo}
              onChangeText={setTermo}
              onFocus={() => setExpandido(true)}
              placeholder={
                aba === 'linhas'
                  ? 'Buscar linha (ex.: 8000, Lapa)'
                  : 'Buscar parada (ex.: Av. Paulista)'
              }
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={onBuscar}
            />
            <Pressable
              style={[styles.botaoBuscar, buscando && styles.botaoDesabilitado]}
              onPress={onBuscar}
              disabled={buscando}
              accessibilityRole="button"
              accessibilityLabel="Buscar"
            >
              {buscando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.botaoBuscarTexto}>Buscar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* PAINEL INFERIOR expansível por toque, sobre o mapa. Soma o inset
          inferior (barra de navegação do Android / home indicator do iOS) ao
          padding para que o cabeçalho e os itens tocáveis NÃO fiquem embaixo
          dos botões do sistema. */}
      <View
        style={[styles.painel, { paddingBottom: 12 + insets.bottom }]}
        pointerEvents="box-none"
      >
        <View style={styles.painelCartao}>
          <Pressable
            style={styles.painelCabecalho}
            onPress={() => setExpandido((atual) => !atual)}
            accessibilityRole="button"
            accessibilityLabel={
              expandido ? 'Recolher painel' : 'Expandir painel'
            }
          >
            <View style={styles.painelResumo}>
              <Text style={styles.painelResumoTexto} numberOfLines={1}>
                {resumo}
              </Text>
            </View>
            <Text style={styles.painelSeta}>{expandido ? '▾' : '▴'}</Text>
          </Pressable>

          {expandido ? (
            <ScrollView
              style={styles.painelConteudo}
              contentContainerStyle={styles.painelConteudoInterno}
              keyboardShouldPersistTaps="handled"
            >
              {erroBusca ? (
                <View style={styles.erroCaixa}>
                  <Text style={styles.erroTexto}>{erroBusca}</Text>
                  {detalheBusca ? (
                    <Text style={styles.erroDetalhe}>{detalheBusca}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* CATÁLOGO/navegação assistida quando o campo está vazio. */}
              {mostrarCatalogo ? (
                <Catalogo
                  aba={aba}
                  favoritos={favoritos}
                  onSugestao={buscarPorTermo}
                />
              ) : null}

              {/* RESULTADOS de LINHAS */}
              {aba === 'linhas' && linhas !== null ? (
                linhas.length === 0 ? (
                  <Text style={styles.vazio}>Nenhuma linha encontrada.</Text>
                ) : (
                  linhas.map((linha) => (
                    <ResultadoLinha
                      key={linha.codigo_linha}
                      linha={linha}
                      selecionada={
                        linhaSelecionada?.codigo_linha === linha.codigo_linha
                      }
                      favoritada={favoritada(linha.letreiro)}
                      aoSelecionar={() => selecionar(linha)}
                      aoAlternarFavorito={() => aoAlternarFavorito(linha)}
                    />
                  ))
                )
              ) : null}

              {/* RESULTADOS de PARADAS */}
              {aba === 'paradas' && paradas !== null ? (
                paradas.length === 0 ? (
                  <Text style={styles.vazio}>Nenhuma parada encontrada.</Text>
                ) : (
                  paradas.map((parada) => (
                    <View key={parada.codigo} style={styles.cardParada}>
                      <Text style={styles.cardTitulo}>{parada.nome}</Text>
                      {parada.endereco ? (
                        <Text style={styles.cardMeta}>{parada.endereco}</Text>
                      ) : null}
                      <Text style={styles.cardCoords}>
                        lat {parada.latitude.toFixed(5)}, lon{' '}
                        {parada.longitude.toFixed(5)}
                      </Text>
                      {!parada.tempo_real ? (
                        <Text style={styles.avisoExemplo}>
                          {AVISO_DADO_EXEMPLO}
                        </Text>
                      ) : null}
                      <Pressable
                        style={styles.botaoVerMapa}
                        onPress={() => selecionarParada(parada)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.botaoVerMapaTexto}>
                          Ver no mapa
                        </Text>
                      </Pressable>
                    </View>
                  ))
                )
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </>
  );
}

/** Cartão de um resultado de LINHA, com estrela e botão de selecionar no mapa. */
function ResultadoLinha({
  linha,
  selecionada,
  favoritada,
  aoSelecionar,
  aoAlternarFavorito,
}: {
  linha: LinhaRead;
  selecionada: boolean;
  favoritada: boolean;
  aoSelecionar: () => void;
  aoAlternarFavorito: () => void;
}) {
  return (
    <View style={[styles.cardLinha, selecionada && styles.cardLinhaAtiva]}>
      <View style={styles.cardCabecalho}>
        <Text style={styles.cardTitulo}>{linha.letreiro}</Text>
        <BotaoFavorito ativo={favoritada} onPress={aoAlternarFavorito} />
      </View>
      <Text style={styles.cardMeta}>
        {linha.terminal_principal} → {linha.terminal_secundario}
      </Text>
      <Text style={styles.cardMeta}>
        {rotuloSentido(linha.sentido)}
        {linha.circular ? ' · Circular' : ''}
      </Text>
      {!linha.tempo_real ? (
        <Text style={styles.avisoExemplo}>{AVISO_DADO_EXEMPLO}</Text>
      ) : null}
      <Pressable
        style={styles.botaoVerMapa}
        onPress={aoSelecionar}
        accessibilityRole="button"
      >
        <Text style={styles.botaoVerMapaTexto}>
          {selecionada ? 'Plotada no mapa' : 'Ver no mapa'}
        </Text>
      </Pressable>
    </View>
  );
}

/** Botão de favoritar (estrela), reaproveitando a mesma semântica da tela de Linhas. */
function BotaoFavorito({
  ativo,
  onPress,
}: {
  ativo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.botaoFavorito}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        ativo ? 'Remover dos favoritos' : 'Adicionar aos favoritos'
      }
    >
      <Text style={[styles.estrela, ativo && styles.estrelaAtiva]}>
        {ativo ? '★' : '☆'}
      </Text>
    </Pressable>
  );
}

/**
 * NAVEGAÇÃO ASSISTIDA (catálogo) exibida no painel quando o campo está vazio.
 * Reutiliza as mesmas fontes de dados da tela de Linhas (src/ui/catalogo.ts e os
 * favoritos salvos). Tudo aqui é SUGESTÃO; a busca livre continua disponível.
 */
function Catalogo({
  aba,
  favoritos,
  onSugestao,
}: {
  aba: AbaBusca;
  favoritos: LinhaFavorita[];
  onSugestao: (termo: string) => void;
}) {
  if (aba === 'paradas') {
    return (
      <View style={styles.catalogo}>
        <Text style={styles.catalogoDica}>{DICA_BUSCA_PARADA}</Text>
      </View>
    );
  }

  // Aba de LINHAS: só FAVORITOS. Sem sugestões de "linhas populares" nem
  // atalhos por número; a busca livre cobre o restante.
  return (
    <View style={styles.catalogo}>
      {favoritos.length > 0 ? (
        <View style={styles.catalogoBloco}>
          <Text style={styles.catalogoTitulo}>Favoritos</Text>
          {favoritos.map((fav) => (
            <Pressable
              key={`fav-${fav.letreiro}`}
              style={styles.sugestao}
              onPress={() => onSugestao(fav.letreiro)}
              accessibilityRole="button"
            >
              <Text style={styles.sugestaoTitulo}>★ {fav.letreiro}</Text>
              <Text style={styles.sugestaoMeta}>
                {fav.terminal_principal} → {fav.terminal_secundario}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.catalogoDica}>
          Na aba Linhas, busque o letreiro ou o trajeto e toque em "Ver no mapa"
          para ver a posição dos ônibus. Na aba Paradas, busque pelo nome e toque
          em "Ver no mapa" para localizar a parada. As linhas que você favoritar
          aparecem aqui.
        </Text>
      )}
    </View>
  );
}

function BotaoAba({
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
      style={[styles.aba, ativo && styles.abaAtiva]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.abaTexto, ativo && styles.abaTextoAtivo]}>
        {texto}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Barra de busca flutuante (topo).
  barraBusca: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  barraBuscaCartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    // Sombra leve para destacar sobre o mapa (Android + iOS).
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  abas: {
    flexDirection: 'row',
    gap: 8,
  },
  aba: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  abaAtiva: {
    backgroundColor: '#0B6E4F',
    borderColor: '#0B6E4F',
  },
  abaTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  abaTextoAtivo: {
    color: '#FFFFFF',
  },
  campoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: '#111827',
  },
  botaoBuscar: {
    backgroundColor: '#0B6E4F',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 76,
    minHeight: 40,
  },
  botaoDesabilitado: {
    opacity: 0.7,
  },
  botaoBuscarTexto: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // Painel inferior expansível.
  painel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  painelCartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  painelCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  painelResumo: {
    flex: 1,
  },
  painelResumoTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  painelSeta: {
    fontSize: 16,
    color: '#0B6E4F',
    fontWeight: '700',
  },
  painelConteudo: {
    // Altura máxima para o painel expandido não cobrir o mapa inteiro.
    maxHeight: 360,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  painelConteudoInterno: {
    padding: 14,
    paddingTop: 10,
    gap: 8,
  },

  // Resultados e catálogo.
  vazio: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
  },
  cardLinha: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardLinhaAtiva: {
    borderColor: '#0B6E4F',
    backgroundColor: '#E6F2ED',
  },
  cardParada: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
  },
  cardMeta: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  cardCoords: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  avisoExemplo: {
    fontSize: 12,
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 8,
  },
  botaoVerMapa: {
    backgroundColor: '#0B6E4F',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  botaoVerMapaTexto: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  botaoFavorito: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  estrela: {
    fontSize: 22,
    color: '#94A3B8',
  },
  estrelaAtiva: {
    color: '#F59E0B',
  },
  erroCaixa: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
  },
  erroTexto: {
    color: '#B00020',
    fontSize: 13,
    fontWeight: '600',
  },
  erroDetalhe: {
    color: '#8A8A8A',
    fontSize: 11,
    marginTop: 4,
  },
  catalogo: {
    gap: 12,
  },
  catalogoBloco: {
    gap: 6,
  },
  catalogoTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  catalogoDica: {
    fontSize: 12,
    color: '#64748B',
  },
  sugestao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sugestaoTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  sugestaoMeta: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
});
