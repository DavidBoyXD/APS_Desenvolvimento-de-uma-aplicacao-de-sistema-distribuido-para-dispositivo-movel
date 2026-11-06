/**
 * Tela de Linhas de ônibus (SPTrans Olho Vivo): permite buscar LINHAS ou
 * PARADAS pelo mesmo campo de busca (abas alternáveis). Ao selecionar uma
 * linha, é possível ver a POSIÇÃO dos veículos em operação e a PREVISÃO de
 * chegada por parada.
 *
 * Todo o conteúdo é exibido em LISTA (latitude/longitude em texto), garantindo
 * que a tela SEMPRE abra em qualquer plataforma sem depender de módulo nativo.
 * Ao ver a POSIÇÃO dos veículos, a tela oferece ainda um botão OPCIONAL "Ver no
 * mapa", que abre a tela de mapa visual (rota "MapaVisual") com os veículos
 * plotados — se o mapa falhar, a lista continua funcionando normalmente. Quando
 * o back-end sinaliza `tempo_real === false`, a tela rotula visivelmente que o
 * dado é de EXEMPLO (servidor sem token da SPTrans).
 *
 * Endpoints consumidos (prefixo /api/v1): /linhas/buscar, /paradas/buscar,
 * /linhas/{codigo}/posicoes e /linhas/{codigo}/previsao.
 *
 * Referências:
 *   - TextInput: https://reactnative.dev/docs/textinput
 *   - ScrollView: https://reactnative.dev/docs/scrollview
 *   - Pressable: https://reactnative.dev/docs/pressable
 *
 * Onde é aplicado: rota "Linhas" em App.tsx.
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  ApiError,
  buscarLinhas,
  buscarParadas,
  getPosicoesLinha,
  getPrevisaoLinha,
} from '../api/client';
import {
  LinhaRead,
  ParadaRead,
  PosicaoLinhaRead,
  PrevisaoLinhaRead,
} from '../types';
import { RootStackParamList } from '../navigation';
import { EstadoErro } from '../ui/estados';
import {
  AVISO_DADO_EXEMPLO,
  formatarTimestamp,
  rotuloAcessivel,
  rotuloSentido,
  rotuloVeiculosEmOperacao,
} from '../ui/rotulos';
import {
  ATALHOS_INICIAIS,
  LINHAS_POPULARES,
  PARADAS_REFERENCIA,
} from '../ui/catalogo';
import {
  LinhaFavorita,
  alternarFavoritoLinha,
  carregarFavoritosLinhas,
} from '../ui/favoritos';

type Props = NativeStackScreenProps<RootStackParamList, 'Linhas'>;

/** Aba de busca ativa: linhas ou paradas. */
type Aba = 'linhas' | 'paradas';

/** Detalhe aberto para a linha selecionada: posições ou previsão. */
type DetalheLinha = 'posicoes' | 'previsao';

/** Mensagem PT-BR de uma falha, usando ApiError quando disponível. */
function mensagemDeErro(e: unknown, padrao: string): string {
  return e instanceof ApiError ? e.mensagem : padrao;
}

/** Detalhe técnico de uma falha (quando for ApiError). */
function detalheDeErro(e: unknown): string | null {
  return e instanceof ApiError ? e.detalhe ?? null : null;
}

export default function LinhasScreen({ navigation }: Props) {
  const [aba, setAba] = useState<Aba>('linhas');
  const [termo, setTermo] = useState<string>('');

  // Resultados da busca.
  const [linhas, setLinhas] = useState<LinhaRead[] | null>(null);
  const [paradas, setParadas] = useState<ParadaRead[] | null>(null);
  const [buscando, setBuscando] = useState<boolean>(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [detalheBusca, setDetalheBusca] = useState<string | null>(null);

  // Linha selecionada e seus detalhes (posições/previsão).
  const [linhaSelecionada, setLinhaSelecionada] = useState<LinhaRead | null>(
    null,
  );
  const [detalhe, setDetalhe] = useState<DetalheLinha | null>(null);
  const [posicoes, setPosicoes] = useState<PosicaoLinhaRead | null>(null);
  const [previsao, setPrevisao] = useState<PrevisaoLinhaRead | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState<boolean>(false);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  const [detalheErroDetalhe, setDetalheErroDetalhe] = useState<string | null>(
    null,
  );

  // Linhas favoritas salvas localmente no aparelho (ver src/ui/favoritos.ts).
  // Mantemos uma cópia em estado para refletir a estrela nos resultados e para
  // listar os favoritos na navegação assistida (campo de busca vazio).
  const [favoritos, setFavoritos] = useState<LinhaFavorita[]>([]);

  // Carrega os favoritos uma vez ao abrir a tela. Tolerante a falha: se o
  // storage não estiver disponível, carregarFavoritosLinhas devolve [].
  useEffect(() => {
    let ativo = true;
    void carregarFavoritosLinhas().then((lista) => {
      if (ativo) {
        setFavoritos(lista);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  /** Troca a aba ativa e limpa os resultados/seleção anteriores. */
  const trocarAba = useCallback((nova: Aba) => {
    setAba(nova);
    setLinhas(null);
    setParadas(null);
    setErroBusca(null);
    setDetalheBusca(null);
    setLinhaSelecionada(null);
    setDetalhe(null);
    setPosicoes(null);
    setPrevisao(null);
    setErroDetalhe(null);
    setDetalheErroDetalhe(null);
  }, []);

  /**
   * Executa a busca. Aceita um termo EXPLÍCITO (usado pelos atalhos da
   * navegação assistida: linhas populares, favoritos e chips iniciais) ou, se
   * omitido, usa o termo digitado no campo. Em ambos os casos reutiliza o mesmo
   * fluxo (buscarLinhas/buscarParadas), preservando a liberdade da busca livre.
   */
  const executarBusca = useCallback(
    async (termoAlvo?: string) => {
      const termoLimpo = (termoAlvo ?? termo).trim();
      if (termoLimpo.length === 0) {
        setErroBusca('Informe um termo para buscar.');
        setDetalheBusca(null);
        return;
      }
      // Reflete no campo o termo efetivamente buscado (útil para atalhos).
      if (termoAlvo !== undefined && termoAlvo !== termo) {
        setTermo(termoAlvo);
      }
      setBuscando(true);
      setErroBusca(null);
      setDetalheBusca(null);
      // Fecha qualquer detalhe de linha aberto antes de uma nova busca.
      setLinhaSelecionada(null);
      setDetalhe(null);
      setPosicoes(null);
      setPrevisao(null);
      try {
        if (aba === 'linhas') {
          const resultado = await buscarLinhas(termoLimpo);
          setLinhas(resultado);
          setParadas(null);
        } else {
          const resultado = await buscarParadas(termoLimpo);
          setParadas(resultado);
          setLinhas(null);
        }
      } catch (e) {
        setErroBusca(mensagemDeErro(e, 'Nao foi possivel realizar a busca.'));
        setDetalheBusca(detalheDeErro(e));
      } finally {
        setBuscando(false);
      }
    },
    [aba, termo],
  );

  /** Handler do botão/campo de busca: usa o termo digitado. */
  const onBuscar = useCallback(() => {
    void executarBusca();
  }, [executarBusca]);

  /**
   * Atalho da navegação assistida: preenche o campo com o termo da sugestão e
   * dispara a busca de LINHAS reutilizando o fluxo normal.
   */
  const buscarPorTermo = useCallback(
    (termoAlvo: string) => {
      void executarBusca(termoAlvo);
    },
    [executarBusca],
  );

  /**
   * Alterna o favorito de uma linha (estrela) e atualiza o estado local. Nunca
   * lança: favoritos.ts trata erros de storage internamente.
   */
  const alternarFavorito = useCallback(async (linha: LinhaRead) => {
    const atualizada = await alternarFavoritoLinha(linha);
    setFavoritos(atualizada);
  }, []);

  /**
   * Verificação SÍNCRONA (para renderizar a estrela) de uma linha estar nos
   * favoritos, comparando pelo letreiro normalizado (mesma identidade usada em
   * src/ui/favoritos.ts). A verificação assíncrona isLinhaFavorita existe para
   * usos fora da renderização.
   */
  const favoritada = useCallback(
    (letreiro: string): boolean => {
      const alvo = letreiro.trim().toLowerCase();
      return favoritos.some(
        (item) => item.letreiro.trim().toLowerCase() === alvo,
      );
    },
    [favoritos],
  );

  const carregarDetalhe = useCallback(
    async (linha: LinhaRead, alvo: DetalheLinha) => {
      setLinhaSelecionada(linha);
      setDetalhe(alvo);
      setCarregandoDetalhe(true);
      setErroDetalhe(null);
      setDetalheErroDetalhe(null);
      setPosicoes(null);
      setPrevisao(null);
      try {
        if (alvo === 'posicoes') {
          setPosicoes(await getPosicoesLinha(linha.codigo_linha));
        } else {
          setPrevisao(await getPrevisaoLinha(linha.codigo_linha));
        }
      } catch (e) {
        setErroDetalhe(
          mensagemDeErro(
            e,
            alvo === 'posicoes'
              ? 'Nao foi possivel carregar a posicao dos veiculos.'
              : 'Nao foi possivel carregar a previsao de chegada.',
          ),
        );
        setDetalheErroDetalhe(detalheDeErro(e));
      } finally {
        setCarregandoDetalhe(false);
      }
    },
    [],
  );

  // Mostra a navegação assistida apenas quando o campo está vazio, não há
  // resultados carregados na aba atual e nenhuma busca está em andamento.
  const resultadosAtuais = aba === 'linhas' ? linhas : paradas;
  const mostrarNavegacaoAssistida =
    termo.trim().length === 0 && resultadosAtuais === null && !buscando;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.conteudo}
      keyboardShouldPersistTaps="handled"
    >
      {/* Abas: alterna entre buscar linhas e paradas reutilizando o campo. */}
      <View style={styles.abas}>
        <Aba
          texto="Linhas"
          ativo={aba === 'linhas'}
          onPress={() => trocarAba('linhas')}
        />
        <Aba
          texto="Paradas"
          ativo={aba === 'paradas'}
          onPress={() => trocarAba('paradas')}
        />
      </View>

      <Text style={styles.rotuloCampo}>
        {aba === 'linhas'
          ? 'Buscar linha (ex.: 8000, Lapa, Terminal)'
          : 'Buscar parada (ex.: Av. Paulista, Se)'}
      </Text>
      <TextInput
        style={styles.input}
        value={termo}
        onChangeText={setTermo}
        placeholder={aba === 'linhas' ? 'Termo da linha' : 'Termo da parada'}
        autoCapitalize="none"
        returnKeyType="search"
        onSubmitEditing={onBuscar}
      />
      <Pressable
        style={[styles.botao, buscando && styles.botaoDesabilitado]}
        onPress={onBuscar}
        disabled={buscando}
        accessibilityRole="button"
      >
        {buscando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.botaoTexto}>Buscar</Text>
        )}
      </Pressable>

      {erroBusca ? (
        <EstadoErro mensagem={erroBusca} detalhe={detalheBusca} />
      ) : null}

      {/* NAVEGAÇÃO ASSISTIDA: aparece só quando o campo está vazio e ainda não
          há resultados, para ajudar quem não sabe o que pesquisar. Some assim
          que há termo digitado ou resultados, para não poluir. A busca livre
          (abas + campo acima) continua idêntica e sempre disponível: estas são
          apenas SUGESTÕES/atalhos; qualquer linha pode ser pesquisada no campo,
          inclusive linhas pouco usadas que não aparecem aqui. */}
      {mostrarNavegacaoAssistida ? (
        <NavegacaoAssistida
          aba={aba}
          favoritos={favoritos}
          onSugestao={buscarPorTermo}
        />
      ) : null}

      {/* Resultados de LINHAS */}
      {aba === 'linhas' && linhas !== null ? (
        linhas.length === 0 ? (
          <Text style={styles.vazio}>Nenhuma linha encontrada.</Text>
        ) : (
          linhas.map((linha) => (
            <View key={linha.codigo_linha} style={styles.card}>
              <View style={styles.cardCabecalho}>
                <Text style={styles.cardTitulo}>{linha.letreiro}</Text>
                <BotaoFavorito
                  ativo={favoritada(linha.letreiro)}
                  onPress={() => alternarFavorito(linha)}
                />
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
              <View style={styles.acoes}>
                <Pressable
                  style={[
                    styles.botaoAcao,
                    linhaSelecionada?.codigo_linha === linha.codigo_linha &&
                      detalhe === 'posicoes' &&
                      styles.botaoAcaoAtivo,
                  ]}
                  onPress={() => carregarDetalhe(linha, 'posicoes')}
                  accessibilityRole="button"
                >
                  <Text style={styles.botaoAcaoTexto}>Ver posicao</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.botaoAcao,
                    linhaSelecionada?.codigo_linha === linha.codigo_linha &&
                      detalhe === 'previsao' &&
                      styles.botaoAcaoAtivo,
                  ]}
                  onPress={() => carregarDetalhe(linha, 'previsao')}
                  accessibilityRole="button"
                >
                  <Text style={styles.botaoAcaoTexto}>Ver previsao</Text>
                </Pressable>
              </View>

              {/* Detalhe (posicoes/previsao) da linha selecionada */}
              {linhaSelecionada?.codigo_linha === linha.codigo_linha ? (
                <View style={styles.detalhe}>
                  {carregandoDetalhe ? (
                    <View style={styles.detalheCarregando}>
                      <ActivityIndicator color="#0B6E4F" />
                      <Text style={styles.textoNeutro}>Carregando...</Text>
                    </View>
                  ) : erroDetalhe ? (
                    <EstadoErro
                      mensagem={erroDetalhe}
                      detalhe={detalheErroDetalhe}
                      aoTentarNovamente={() =>
                        detalhe ? carregarDetalhe(linha, detalhe) : undefined
                      }
                    />
                  ) : detalhe === 'posicoes' && posicoes ? (
                    <Posicoes
                      posicoes={posicoes}
                      aoVerNoMapa={
                        posicoes.veiculos.length > 0
                          ? () =>
                              navigation.navigate('MapaVisual', {
                                codigoLinha: linha.codigo_linha,
                                linhaRotulo: linha.letreiro,
                              })
                          : undefined
                      }
                    />
                  ) : detalhe === 'previsao' && previsao ? (
                    <Previsao previsao={previsao} />
                  ) : null}
                </View>
              ) : null}
            </View>
          ))
        )
      ) : null}

      {/* Resultados de PARADAS */}
      {aba === 'paradas' && paradas !== null ? (
        paradas.length === 0 ? (
          <Text style={styles.vazio}>Nenhuma parada encontrada.</Text>
        ) : (
          paradas.map((parada) => (
            <View key={parada.codigo} style={styles.card}>
              <Text style={styles.cardTitulo}>{parada.nome}</Text>
              {parada.endereco ? (
                <Text style={styles.cardMeta}>{parada.endereco}</Text>
              ) : null}
              <Text style={styles.cardCoords}>
                lat {parada.latitude.toFixed(5)}, lon{' '}
                {parada.longitude.toFixed(5)}
              </Text>
              {!parada.tempo_real ? (
                <Text style={styles.avisoExemplo}>{AVISO_DADO_EXEMPLO}</Text>
              ) : null}
            </View>
          ))
        )
      ) : null}
    </ScrollView>
  );
}

/** Lista a posição dos veículos de uma linha (prefixo, acessibilidade, etc.). */
function Posicoes({
  posicoes,
  aoVerNoMapa,
}: {
  posicoes: PosicaoLinhaRead;
  /**
   * Abre a tela de mapa visual com os veículos desta linha plotados. Opcional:
   * só é passada quando há veículos a mostrar. A lista continua sendo a forma
   * garantida de ver os dados; o mapa é um complemento opcional.
   */
  aoVerNoMapa?: () => void;
}) {
  const quantidade = posicoes.veiculos.length;
  const temVeiculos = quantidade > 0;
  return (
    <View style={styles.detalheBloco}>
      <Text style={styles.detalheTitulo}>Posicao dos veiculos</Text>
      {/* Selo com a contagem de veiculos em operacao: verde quando ha veiculos,
          neutro (cinza) quando a linha nao tem veiculos no momento. O numero vem
          do tamanho da lista retornada por getPosicoesLinha; quando o dado e de
          EXEMPLO (sem token), o rotulo deixa isso explicito com "(exemplo)". */}
      <View
        style={[
          styles.selo,
          temVeiculos ? styles.seloVerde : styles.seloNeutro,
        ]}
      >
        <Text
          style={[
            styles.seloTexto,
            temVeiculos ? styles.seloTextoVerde : styles.seloTextoNeutro,
          ]}
        >
          {rotuloVeiculosEmOperacao(quantidade, posicoes.tempo_real)}
        </Text>
      </View>
      <Text style={styles.detalheMeta}>
        Horario de referencia: {formatarTimestamp(posicoes.horario_referencia)}
      </Text>
      {!posicoes.tempo_real ? (
        <Text style={styles.avisoExemplo}>{AVISO_DADO_EXEMPLO}</Text>
      ) : null}
      {aoVerNoMapa ? (
        <Pressable
          style={styles.botaoMapa}
          onPress={aoVerNoMapa}
          accessibilityRole="button"
        >
          <Text style={styles.botaoMapaTexto}>Ver no mapa</Text>
        </Pressable>
      ) : null}
      {posicoes.veiculos.length === 0 ? (
        <Text style={styles.vazio}>Nenhum veiculo em operacao no momento.</Text>
      ) : (
        posicoes.veiculos.map((veiculo, indice) => (
          // Compoe a key com o indice: dois veiculos podem compartilhar o mesmo
          // prefixo na mesma lista, o que geraria keys duplicadas no React.
          <View key={`${veiculo.prefixo}-${indice}`} style={styles.itemVeiculo}>
            <Text style={styles.itemTitulo}>Prefixo {veiculo.prefixo}</Text>
            <Text style={styles.itemMeta}>
              {rotuloAcessivel(veiculo.acessivel)} ·{' '}
              {formatarTimestamp(veiculo.timestamp)}
            </Text>
            <Text style={styles.itemCoords}>
              lat {veiculo.latitude.toFixed(5)}, lon{' '}
              {veiculo.longitude.toFixed(5)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

/** Lista a previsão de chegada por parada, com os veículos de cada parada. */
function Previsao({ previsao }: { previsao: PrevisaoLinhaRead }) {
  return (
    <View style={styles.detalheBloco}>
      <Text style={styles.detalheTitulo}>Previsao de chegada</Text>
      <Text style={styles.detalheMeta}>
        Horario de referencia: {formatarTimestamp(previsao.horario_referencia)}
      </Text>
      {!previsao.tempo_real ? (
        <Text style={styles.avisoExemplo}>{AVISO_DADO_EXEMPLO}</Text>
      ) : null}
      {previsao.paradas.length === 0 ? (
        <Text style={styles.vazio}>Nenhuma parada com previsao no momento.</Text>
      ) : (
        previsao.paradas.map((parada) => (
          <View key={parada.codigo_parada} style={styles.itemParada}>
            <Text style={styles.itemTitulo}>{parada.nome}</Text>
            <Text style={styles.itemCoords}>
              lat {parada.latitude.toFixed(5)}, lon{' '}
              {parada.longitude.toFixed(5)}
            </Text>
            {parada.veiculos.length === 0 ? (
              <Text style={styles.vazio}>Sem previsao para esta parada.</Text>
            ) : (
              parada.veiculos.map((veiculo, indice) => (
                // Compoe a key com o indice: o mesmo prefixo pode aparecer mais
                // de uma vez na mesma parada, evitando keys duplicadas no React.
                <Text
                  key={`${veiculo.prefixo}-${indice}`}
                  style={styles.itemPrevisao}
                >
                  • Prefixo {veiculo.prefixo} · chega em{' '}
                  {veiculo.horario_previsto} · {rotuloAcessivel(veiculo.acessivel)}
                </Text>
              ))
            )}
          </View>
        ))
      )}
    </View>
  );
}

/**
 * Botão de favoritar uma linha (estrela). Mostra ★ quando favoritada e ☆ quando
 * não; alterna o estado ao tocar. Rotulado para leitores de tela.
 */
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
 * Seção de NAVEGAÇÃO ASSISTIDA exibida quando o campo de busca está vazio.
 * Oferece atalhos (favoritos salvos, linhas populares e chips por número
 * inicial) que preenchem o campo e disparam a busca normal. Tudo aqui é
 * SUGESTÃO: a busca livre no campo acima continua sendo a forma principal de
 * encontrar qualquer linha. Na aba de PARADAS, mostra pontos de referência.
 */
function NavegacaoAssistida({
  aba,
  favoritos,
  onSugestao,
}: {
  aba: Aba;
  favoritos: LinhaFavorita[];
  onSugestao: (termo: string) => void;
}) {
  if (aba === 'paradas') {
    return (
      <View style={styles.assistida}>
        <Text style={styles.assistidaTitulo}>Pontos de referencia</Text>
        <Text style={styles.assistidaDica}>
          Sugestoes para comecar. Voce pode pesquisar qualquer parada pelo campo
          acima.
        </Text>
        {PARADAS_REFERENCIA.map((ponto) => (
          <Pressable
            key={ponto.termo}
            style={styles.sugestao}
            onPress={() => onSugestao(ponto.termo)}
            accessibilityRole="button"
          >
            <Text style={styles.sugestaoTitulo}>{ponto.descricao}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.assistida}>
      {/* FAVORITOS salvos no aparelho: atalho para as linhas que o usuário
          acompanha. Tocar re-busca a linha pelo letreiro (fluxo normal). */}
      {favoritos.length > 0 ? (
        <View style={styles.assistidaBloco}>
          <Text style={styles.assistidaTitulo}>Favoritos</Text>
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
      ) : null}

      {/* LINHAS POPULARES: lista curada apenas como ponto de partida. */}
      <View style={styles.assistidaBloco}>
        <Text style={styles.assistidaTitulo}>Linhas populares</Text>
        <Text style={styles.assistidaDica}>
          Sugestoes para comecar. Voce pode pesquisar qualquer linha pelo campo
          acima, inclusive linhas pouco usadas.
        </Text>
        {LINHAS_POPULARES.map((linha) => (
          <Pressable
            key={`pop-${linha.termo}`}
            style={styles.sugestao}
            onPress={() => onSugestao(linha.termo)}
            accessibilityRole="button"
          >
            <Text style={styles.sugestaoTitulo}>{linha.termo}</Text>
            <Text style={styles.sugestaoMeta}>{linha.descricao}</Text>
          </Pressable>
        ))}
      </View>

      {/* ATALHOS por número inicial (opcional): preenchem o campo e buscam. */}
      <View style={styles.assistidaBloco}>
        <Text style={styles.assistidaTitulo}>Comecar por numero</Text>
        <View style={styles.chips}>
          {ATALHOS_INICIAIS.map((inicial) => (
            <Pressable
              key={`chip-${inicial}`}
              style={styles.chip}
              onPress={() => onSugestao(inicial)}
              accessibilityRole="button"
            >
              <Text style={styles.chipTexto}>{inicial}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function Aba({
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
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6',
  },
  conteudo: {
    padding: 16,
    paddingBottom: 40,
    gap: 8,
  },
  abas: {
    flexDirection: 'row',
    gap: 8,
  },
  aba: {
    flex: 1,
    paddingVertical: 10,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  abaTextoAtivo: {
    color: '#FFFFFF',
  },
  rotuloCampo: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
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
  botao: {
    backgroundColor: '#0B6E4F',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 8,
  },
  botaoDesabilitado: {
    opacity: 0.7,
  },
  botaoTexto: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  vazio: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
  },
  textoNeutro: {
    color: '#555555',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  cardCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
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
  assistida: {
    marginTop: 8,
    gap: 12,
  },
  assistidaBloco: {
    gap: 6,
  },
  assistidaTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  assistidaDica: {
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minWidth: 44,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0B6E4F',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  chipTexto: {
    color: '#0B6E4F',
    fontWeight: '700',
    fontSize: 14,
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
  acoes: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  botaoAcao: {
    borderWidth: 1,
    borderColor: '#0B6E4F',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  botaoAcaoAtivo: {
    backgroundColor: '#E6F2ED',
  },
  botaoAcaoTexto: {
    color: '#0B6E4F',
    fontWeight: '600',
    fontSize: 13,
  },
  detalhe: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  detalheCarregando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  detalheBloco: {
    gap: 2,
  },
  selo: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  seloVerde: {
    backgroundColor: '#E6F2ED',
    borderWidth: 1,
    borderColor: '#0B6E4F',
  },
  seloNeutro: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  seloTexto: {
    fontSize: 13,
    fontWeight: '700',
  },
  seloTextoVerde: {
    color: '#0B6E4F',
  },
  seloTextoNeutro: {
    color: '#64748B',
  },
  botaoMapa: {
    backgroundColor: '#0B6E4F',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  botaoMapaTexto: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  detalheTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  detalheMeta: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  itemVeiculo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  itemParada: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  itemTitulo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  itemMeta: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  itemCoords: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  itemPrevisao: {
    fontSize: 13,
    color: '#334155',
    marginTop: 4,
  },
});
