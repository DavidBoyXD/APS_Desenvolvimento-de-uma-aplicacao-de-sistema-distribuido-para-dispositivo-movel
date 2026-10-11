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
  Medicao,
  Regiao,
  RelatorioRegiao,
  TipoMedicao,
} from '../types';

/**
 * URL base da API.
 *
 * Default: http://10.0.2.2:8000 -> no emulador Android, 10.0.2.2 é o alias do
 * host da máquina (localhost do computador), pois o emulador roda em uma VM
 * isolada. Documentação oficial do Android:
 *   https://developer.android.com/studio/run/emulator-networking
 *
 * Alternativas conforme o ambiente:
 *   - Emulador iOS (simulador): use http://localhost:8000 (o simulador iOS
 *     compartilha a rede do host).
 *   - Dispositivo físico com Expo Go: use http://<IP-da-maquina-na-LAN>:8000
 *     (ex.: http://192.168.0.10:8000). Descubra o IP com `ipconfig`/`ifconfig`.
 *   - Web (expo start --web): use http://localhost:8000.
 *
 * Para trocar sem editar o código, defina a variável de ambiente
 * EXPO_PUBLIC_API_BASE_URL (Expo injeta variáveis com prefixo EXPO_PUBLIC_*).
 * Docs: https://docs.expo.dev/guides/environment-variables/
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:8000';

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

/** Tempo máximo de espera por resposta (ms) antes de considerar falha de rede. */
const TIMEOUT_MS = 12000;

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
 * Executa uma requisição HTTP e devolve o JSON tipado.
 * Centraliza o tratamento de erros: converte qualquer falha (rede, timeout,
 * status HTTP de erro, JSON inválido) em uma ApiError com mensagem PT-BR.
 */
async function requisitar<T>(
  caminho: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, query } = options;
  const url = montarUrl(caminho, query);

  // AbortController implementa o timeout de rede de forma portável no RN.
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
