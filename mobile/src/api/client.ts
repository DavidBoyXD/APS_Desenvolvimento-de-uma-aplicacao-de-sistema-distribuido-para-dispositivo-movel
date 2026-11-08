/**
 * Cliente HTTP tipado para consumir a API REST do back-end (FastAPI).
 *
 * Este arquivo caracteriza o lado CLIENTE do sistema distribuído: o app móvel
 * conversa com o servidor (API REST) por HTTP/JSON.
 *
 * Fonte da verdade dos endpoints e formatos: contrato documentado em FEAT-002
 * (server/app/routers/*, server/app/schemas.py). Prefixo /api/v1.
 *
 * Referência da API fetch usada: MDN Fetch API
 *   https://developer.mozilla.org/pt-BR/docs/Web/API/Fetch_API
 * fetch é nativo no React Native (não requer dependência extra).
 *
 * Onde é aplicado: importado por todas as telas em src/screens/*.
 */

import {
  Alerta,
  AlertaCreate,
  AlertaDisparado,
  ErroResposta,
  LinhaRead,
  Medicao,
  ParadaRead,
  PosicaoLinhaRead,
  PrevisaoLinhaRead,
  Regiao,
  RelatorioRegiao,
  TipoMedicao,
} from '../types';

/**
 * URL base da API.
 *
 * Default: https://aps-olhovivo.onrender.com -> servidor público hospedado no
 * Render. O padrão aponta para esse servidor para que o APK funcione sem
 * depender de passar a variável de ambiente no build; assim, uma build gerada
 * sem configuração já consegue falar com o back-end publicado.
 *
 * Para desenvolvimento local/emulador, defina a variável de ambiente
 * EXPO_PUBLIC_API_BASE_URL (Expo injeta variáveis com prefixo EXPO_PUBLIC_*),
 * que continua tendo prioridade sobre o padrão. Valores úteis conforme o
 * ambiente:
 *   - Emulador Android: http://10.0.2.2:8000 (10.0.2.2 é o alias do host da
 *     máquina, pois o emulador roda em uma VM isolada). Documentação oficial:
 *     https://developer.android.com/studio/run/emulator-networking
 *   - Emulador iOS (simulador) ou web (expo start --web): http://localhost:8000
 *     (compartilham a rede do host).
 *   - Dispositivo físico com Expo Go: http://<IP-da-maquina-na-LAN>:8000
 *     (ex.: http://192.168.0.10:8000). Descubra o IP com `ipconfig`/`ifconfig`.
 *
 * Docs de variáveis de ambiente do Expo:
 *   https://docs.expo.dev/guides/environment-variables/
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://aps-olhovivo.onrender.com';

/** Prefixo comum de todas as rotas da API (definido no back-end). */
const API_PREFIX = '/api/v1';

/**
 * Erro de aplicação com mensagem amigável em PT-BR pronta para exibir na UI.
 * As telas capturam esta classe e mostram `mensagem` ao usuário, sem crashar.
 */
export class ApiError extends Error {
  /** Código HTTP (0 quando a falha foi de rede/timeout, sem resposta). */
  readonly codigo: number;
  /** Detalhe técnico opcional (para logs), nunca obrigatório na UI. */
  readonly detalhe?: string | null;

  constructor(mensagem: string, codigo: number, detalhe?: string | null) {
    super(mensagem);
    this.name = 'ApiError';
    this.codigo = codigo;
    this.detalhe = detalhe ?? null;
  }

  /** Mensagem amigável em PT-BR pronta para a UI (alias de `message`). */
  get mensagem(): string {
    return this.message;
  }
}

/**
 * Tempo máximo de espera por resposta (ms) antes de considerar falha de rede.
 * Valor alto (30s) para tolerar o "cold start" do servidor no Render (plano
 * free): a primeira requisição depois de um período de inatividade pode levar
 * dezenas de segundos até o serviço "acordar" e responder.
 */
const TIMEOUT_MS = 30000;

/**
 * Número máximo de tentativas por requisição. A 1ª tentativa mais até 2
 * repetições cobrem o cenário em que a chamada inicial apenas "acorda" o
 * servidor e falha por timeout/rede antes de ele estar pronto.
 */
const MAX_TENTATIVAS = 3;

/** Espera (ms) entre tentativas, para dar tempo ao servidor de responder. */
const BACKOFF_MS = 1500;

/**
 * Erro interno de rede/timeout (sem resposta HTTP). Usado apenas dentro deste
 * módulo para sinalizar que a tentativa é elegível a retry, carregando o
 * detalhe técnico que será exposto na ApiError final.
 */
class FalhaDeRede extends Error {
  readonly detalhe: string;
  readonly timeout: boolean;

  constructor(detalhe: string, timeout: boolean) {
    super(detalhe);
    this.name = 'FalhaDeRede';
    this.detalhe = detalhe;
    this.timeout = timeout;
  }
}

/** Pausa assíncrona simples usada no backoff entre tentativas. */
function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Query params opcionais (valores undefined/null são ignorados). */
  query?: Record<string, string | number | undefined | null>;
}

function montarUrl(
  caminho: string,
  query?: RequestOptions['query'],
): string {
  const base = `${API_BASE_URL}${API_PREFIX}${caminho}`;
  if (!query) {
    return base;
  }
  const partes: string[] = [];
  for (const [chave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      partes.push(
        `${encodeURIComponent(chave)}=${encodeURIComponent(String(valor))}`,
      );
    }
  }
  return partes.length > 0 ? `${base}?${partes.join('&')}` : base;
}

/**
 * Executa UMA tentativa de requisição HTTP.
 *
 * - Em sucesso, devolve o JSON tipado.
 * - Em erro HTTP (status >= 400), lança ApiError com o status correto (erro de
 *   negócio: NÃO deve ser repetido).
 * - Em falha de rede/timeout (sem resposta), lança FalhaDeRede (elegível a
 *   retry), carregando o detalhe técnico para diagnóstico.
 */
async function tentarRequisicao<T>(
  url: string,
  method: 'GET' | 'POST',
  body: unknown,
): Promise<T> {
  // Um AbortController NOVO por tentativa: após abortar, o controller não pode
  // ser reutilizado. Ref.: https://developer.mozilla.org/pt-BR/docs/Web/API/AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (erro) {
    clearTimeout(timeoutId);
    // Falha antes de obter resposta: sem rede, servidor fora do ar ou timeout.
    const abortado = erro instanceof Error && erro.name === 'AbortError';
    // Detalhe técnico para diagnóstico na tela: URL base chamada + causa real.
    // Não há token/cabeçalho sensível no cliente, então expor isto é seguro.
    const detalhe = abortado
      ? `timeout apos ${Math.round(TIMEOUT_MS / 1000)}s ao chamar ${API_BASE_URL}`
      : `falha de rede ao chamar ${API_BASE_URL}: ${
          erro instanceof Error ? erro.message : String(erro)
        }`;
    throw new FalhaDeRede(detalhe, abortado);
  }
  clearTimeout(timeoutId);

  // Sucesso sem corpo (ex.: 204): retorna objeto vazio tipado.
  if (resposta.status === 204) {
    return {} as T;
  }

  let dados: unknown = null;
  const texto = await resposta.text();
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = null;
    }
  }

  if (!resposta.ok) {
    // A API retorna erros no schema ErroResposta {codigo, mensagem, detalhe}.
    // Erros HTTP (4xx/5xx) são de negócio: viram ApiError com o status real e
    // NÃO são repetidos pelo loop de retry.
    const erro = dados as Partial<ErroResposta> | null;
    const mensagem =
      erro && typeof erro.mensagem === 'string' && erro.mensagem.length > 0
        ? erro.mensagem
        : `O servidor respondeu com erro (código ${resposta.status}).`;
    const detalhe =
      erro && typeof erro.detalhe === 'string' && erro.detalhe.length > 0
        ? erro.detalhe
        : `HTTP ${resposta.status} em ${API_BASE_URL}`;
    throw new ApiError(mensagem, resposta.status, detalhe);
  }

  return dados as T;
}

/**
 * Executa uma requisição HTTP e devolve o JSON tipado.
 *
 * Centraliza o tratamento de erros: converte qualquer falha (rede, timeout,
 * status HTTP de erro, JSON inválido) em uma ApiError com mensagem PT-BR e um
 * `detalhe` técnico útil para diagnóstico (URL base chamada e causa da falha).
 *
 * Retry: falhas de REDE/timeout são repetidas (até MAX_TENTATIVAS, com backoff
 * de BACKOFF_MS) para tolerar o "cold start" do servidor no Render. Erros HTTP
 * (status >= 400) são de negócio e NÃO são repetidos: o status é preservado.
 */
async function requisitar<T>(
  caminho: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, query } = options;
  const url = montarUrl(caminho, query);

  let ultimaFalha: FalhaDeRede | null = null;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
    try {
      return await tentarRequisicao<T>(url, method, body);
    } catch (erro) {
      // ApiError (erro HTTP de negócio) sobe imediatamente, sem novas tentativas.
      if (erro instanceof ApiError) {
        throw erro;
      }
      if (erro instanceof FalhaDeRede) {
        ultimaFalha = erro;
        // Ainda há tentativas restantes: aguarda o backoff e repete.
        if (tentativa < MAX_TENTATIVAS) {
          await esperar(BACKOFF_MS);
          continue;
        }
      } else {
        // Erro inesperado (não previsto): não repete, apenas embrulha.
        const detalhe = erro instanceof Error ? erro.message : String(erro);
        throw new ApiError(
          'Ocorreu um erro inesperado ao falar com o servidor.',
          0,
          detalhe,
        );
      }
    }
  }

  // Esgotou as tentativas de rede/timeout: monta a ApiError final com detalhe.
  const falha = ultimaFalha as FalhaDeRede;
  const mensagem = falha.timeout
    ? 'A conexão demorou demais para responder. Verifique se o servidor está ativo e tente novamente.'
    : 'Não foi possível conectar ao servidor. Verifique sua conexão e o endereço da API.';
  const detalhe = `${falha.detalhe} (apos ${MAX_TENTATIVAS} tentativas)`;
  throw new ApiError(mensagem, 0, detalhe);
}

// ---------------------------------------------------------------------------
// Funções tipadas da API. Cada uma mapeia diretamente para um endpoint do
// contrato documentado em FEAT-002.
// ---------------------------------------------------------------------------

/** GET /api/v1/regioes -> lista de regiões (usada no mapa). */
export function getRegioes(): Promise<Regiao[]> {
  return requisitar<Regiao[]>('/regioes');
}

/** GET /api/v1/regioes/{id} -> uma região (404 se não existir). */
export function getRegiao(id: number): Promise<Regiao> {
  return requisitar<Regiao>(`/regioes/${id}`);
}

/**
 * GET /api/v1/medicoes?regiao_id=&tipo= -> medições filtradas.
 * Ambos os filtros são opcionais.
 */
export function getMedicoes(params?: {
  regiao_id?: number;
  tipo?: TipoMedicao;
}): Promise<Medicao[]> {
  return requisitar<Medicao[]>('/medicoes', {
    query: { regiao_id: params?.regiao_id, tipo: params?.tipo },
  });
}

/**
 * POST /api/v1/regioes/{id}/atualizar-transporte -> busca a frota de ônibus na
 * SPTrans Olho Vivo (fonte oficial da Prefeitura de São Paulo, tempo real)
 * quando o token SPTRANS_TOKEN está definido no servidor; sem o token, o
 * back-end usa um fallback de exemplo rotulado. Persiste e retorna as novas
 * medições de transporte público. Sem corpo na request.
 */
export function atualizarTransporte(regiaoId: number): Promise<Medicao[]> {
  return requisitar<Medicao[]>(`/regioes/${regiaoId}/atualizar-transporte`, {
    method: 'POST',
  });
}

/** GET /api/v1/relatorios/regiao/{id} -> relatório agregado da região. */
export function getRelatorio(regiaoId: number): Promise<RelatorioRegiao> {
  return requisitar<RelatorioRegiao>(`/relatorios/regiao/${regiaoId}`);
}

/** GET /api/v1/alertas -> lista de regras de alerta. */
export function getAlertas(): Promise<Alerta[]> {
  return requisitar<Alerta[]>('/alertas');
}

/** POST /api/v1/alertas -> cria uma regra de alerta e a retorna (201). */
export function criarAlerta(payload: AlertaCreate): Promise<Alerta> {
  return requisitar<Alerta>('/alertas', { method: 'POST', body: payload });
}

/**
 * GET /api/v1/alertas/avaliar/{regiao_id} -> avalia as medições recentes da
 * região contra as regras ativas e retorna os alertas disparados.
 */
export function avaliarAlertas(regiaoId: number): Promise<AlertaDisparado[]> {
  return requisitar<AlertaDisparado[]>(`/alertas/avaliar/${regiaoId}`);
}

/**
 * GET /api/v1/linhas/buscar?termo= -> busca linhas de ônibus da SPTrans Olho
 * Vivo (tempo real quando o servidor tem token; fallback de exemplo caso
 * contrário). O termo é obrigatório (422 se ausente).
 */
export function buscarLinhas(termo: string): Promise<LinhaRead[]> {
  return requisitar<LinhaRead[]>('/linhas/buscar', { query: { termo } });
}

/**
 * GET /api/v1/linhas/{codigo_linha}/posicoes -> posição em tempo real dos
 * veículos de uma linha (SPTrans Olho Vivo). Sem token no servidor, retorna
 * fallback de exemplo (tempo_real=false).
 */
export function getPosicoesLinha(
  codigoLinha: number,
): Promise<PosicaoLinhaRead> {
  return requisitar<PosicaoLinhaRead>(`/linhas/${codigoLinha}/posicoes`);
}

/**
 * GET /api/v1/linhas/{codigo_linha}/previsao -> previsão de chegada por parada
 * de uma linha (SPTrans Olho Vivo). Sem token no servidor, retorna fallback de
 * exemplo (tempo_real=false).
 */
export function getPrevisaoLinha(
  codigoLinha: number,
): Promise<PrevisaoLinhaRead> {
  return requisitar<PrevisaoLinhaRead>(`/linhas/${codigoLinha}/previsao`);
}

/**
 * GET /api/v1/paradas/buscar?termo= -> busca paradas de ônibus da SPTrans Olho
 * Vivo (tempo real quando o servidor tem token; fallback de exemplo caso
 * contrário). O termo é obrigatório (422 se ausente).
 */
export function buscarParadas(termo: string): Promise<ParadaRead[]> {
  return requisitar<ParadaRead[]>('/paradas/buscar', { query: { termo } });
}
