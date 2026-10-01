/**
 * Cliente HTTP tipado para consumir a API REST do back-end (FastAPI).
 *
 * Este arquivo caracteriza o lado CLIENTE do sistema distribuido: o app movel
 * conversa com o servidor (API REST) por HTTP/JSON.
 *
 * Fonte da verdade dos endpoints e formatos: contrato documentado em FEAT-002
 * (server/app/routers/*, server/app/schemas.py). Prefixo /api/v1.
 *
 * Referencia da API fetch usada: MDN Fetch API
 *   https://developer.mozilla.org/pt-BR/docs/Web/API/Fetch_API
 * fetch e nativo no React Native (nao requer dependencia extra).
 *
 * Onde e aplicado: importado por todas as telas em src/screens/*.
 */

import {
  Alerta,
  AlertaCreate,
  AlertaDisparado,
  ErroResposta,
  Medicao,
  Regiao,
  RelatorioRegiao,
  TipoMedicao,
} from '../types';

/**
 * URL base da API.
 *
 * Default: http://10.0.2.2:8000 -> no emulador Android, 10.0.2.2 e o alias do
 * host da maquina (localhost do computador), pois o emulador roda em uma VM
 * isolada. Documentacao oficial do Android:
 *   https://developer.android.com/studio/run/emulator-networking
 *
 * Alternativas conforme o ambiente:
 *   - Emulador iOS (simulador): use http://localhost:8000 (o simulador iOS
 *     compartilha a rede do host).
 *   - Dispositivo fisico com Expo Go: use http://<IP-da-maquina-na-LAN>:8000
 *     (ex.: http://192.168.0.10:8000). Descubra o IP com `ipconfig`/`ifconfig`.
 *   - Web (expo start --web): use http://localhost:8000.
 *
 * Para trocar sem editar o codigo, defina a variavel de ambiente
 * EXPO_PUBLIC_API_BASE_URL (Expo injeta variaveis com prefixo EXPO_PUBLIC_*).
 * Docs: https://docs.expo.dev/guides/environment-variables/
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:8000';

/** Prefixo comum de todas as rotas da API (definido no back-end). */
const API_PREFIX = '/api/v1';

/**
 * Erro de aplicacao com mensagem amigavel em PT-BR pronta para exibir na UI.
 * As telas capturam esta classe e mostram `mensagem` ao usuario, sem crashar.
 */
export class ApiError extends Error {
  /** Codigo HTTP (0 quando a falha foi de rede/timeout, sem resposta). */
  readonly codigo: number;
  /** Detalhe tecnico opcional (para logs), nunca obrigatorio na UI. */
  readonly detalhe?: string | null;

  constructor(mensagem: string, codigo: number, detalhe?: string | null) {
    super(mensagem);
    this.name = 'ApiError';
    this.codigo = codigo;
    this.detalhe = detalhe ?? null;
  }

  /** Mensagem amigavel em PT-BR pronta para a UI (alias de `message`). */
  get mensagem(): string {
    return this.message;
  }
}

/** Tempo maximo de espera por resposta (ms) antes de considerar falha de rede. */
const TIMEOUT_MS = 12000;

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Query params opcionais (valores undefined/null sao ignorados). */
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
 * Executa uma requisicao HTTP e devolve o JSON tipado.
 * Centraliza o tratamento de erros: converte qualquer falha (rede, timeout,
 * status HTTP de erro, JSON invalido) em uma ApiError com mensagem PT-BR.
 */
async function requisitar<T>(
  caminho: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, query } = options;
  const url = montarUrl(caminho, query);

  // AbortController implementa o timeout de rede de forma portavel no RN.
  // Ref.: https://developer.mozilla.org/pt-BR/docs/Web/API/AbortController
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
    const mensagem = abortado
      ? 'A conexao demorou demais para responder. Verifique se o servidor esta ativo e tente novamente.'
      : 'Nao foi possivel conectar ao servidor. Verifique sua conexao e o endereco da API.';
    throw new ApiError(mensagem, 0, erro instanceof Error ? erro.message : String(erro));
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
    const erro = dados as Partial<ErroResposta> | null;
    const mensagem =
      erro && typeof erro.mensagem === 'string' && erro.mensagem.length > 0
        ? erro.mensagem
        : `O servidor respondeu com erro (codigo ${resposta.status}).`;
    throw new ApiError(mensagem, resposta.status, erro?.detalhe ?? null);
  }

  return dados as T;
}

// ---------------------------------------------------------------------------
// Funcoes tipadas da API. Cada uma mapeia diretamente para um endpoint do
// contrato documentado em FEAT-002.
// ---------------------------------------------------------------------------

/** GET /api/v1/regioes -> lista de regioes (usada no mapa). */
export function getRegioes(): Promise<Regiao[]> {
  return requisitar<Regiao[]>('/regioes');
}

/** GET /api/v1/regioes/{id} -> uma regiao (404 se nao existir). */
export function getRegiao(id: number): Promise<Regiao> {
  return requisitar<Regiao>(`/regioes/${id}`);
}

/**
 * GET /api/v1/medicoes?regiao_id=&tipo= -> medicoes filtradas.
 * Ambos os filtros sao opcionais.
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
 * POST /api/v1/regioes/{id}/atualizar-ar -> busca dados reais na Open-Meteo,
 * persiste e retorna as novas medicoes de qualidade do ar. Sem corpo na request.
 */
export function atualizarAr(regiaoId: number): Promise<Medicao[]> {
  return requisitar<Medicao[]>(`/regioes/${regiaoId}/atualizar-ar`, {
    method: 'POST',
  });
}

/**
 * POST /api/v1/regioes/{id}/atualizar-transito -> busca vias reais na Overpass
 * API (OpenStreetMap, dados ODbL), persiste e retorna as novas medicoes de
 * transito. Sem corpo na request.
 */
export function atualizarTransito(regiaoId: number): Promise<Medicao[]> {
  return requisitar<Medicao[]>(`/regioes/${regiaoId}/atualizar-transito`, {
    method: 'POST',
  });
}

/**
 * POST /api/v1/regioes/{id}/atualizar-alagamento -> busca a descarga fluvial
 * real na Open-Meteo Flood API (base cientifica GloFAS), persiste e retorna as
 * novas medicoes de alagamento. Sem corpo na request.
 */
export function atualizarAlagamento(regiaoId: number): Promise<Medicao[]> {
  return requisitar<Medicao[]>(`/regioes/${regiaoId}/atualizar-alagamento`, {
    method: 'POST',
  });
}

/** GET /api/v1/relatorios/regiao/{id} -> relatorio agregado da regiao. */
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
 * GET /api/v1/alertas/avaliar/{regiao_id} -> avalia as medicoes recentes da
 * regiao contra as regras ativas e retorna os alertas disparados.
 */
export function avaliarAlertas(regiaoId: number): Promise<AlertaDisparado[]> {
  return requisitar<AlertaDisparado[]>(`/alertas/avaliar/${regiaoId}`);
}
