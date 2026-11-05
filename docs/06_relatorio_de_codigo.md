# 6. Relatório com as linhas de código

Este relatório comenta os trechos de código mais relevantes do projeto, indicando
o arquivo, a função e a tecnologia/fonte aplicada em cada ponto. Não repete todo o
código; destaca os núcleos. Os caminhos apontam para o código real do repositório.

## 6.0 Mapa de rastreabilidade (fonte -> arquivo/função)

| Fonte / biblioteca | Papel | Arquivo | Função / ponto | Endpoint que a usa |
| --- | --- | --- | --- | --- |
| **SPTrans Olho Vivo** (OFICIAL SP, token) | Transporte público, tempo real | `server/app/services/sptrans.py` | `obter_token`, `_autenticar`, `mapear_payload`, `buscar_transporte_publico`; constantes `FONTE`/`FONTE_FALLBACK` | `POST /api/v1/regioes/{id}/atualizar-transporte` |
| **SPTrans GTFS / exemplo** (fallback) | Transporte sem token | `server/app/services/sptrans.py` | `_leituras_fallback` (`LINHAS_EXEMPLO`) | idem (quando `SPTRANS_TOKEN` ausente) |
| **SPTrans Olho Vivo** (OFICIAL SP, token) | Acompanhamento de ônibus e busca | `server/app/services/sptrans.py` | `buscar_linhas`, `buscar_posicoes_linha`, `buscar_previsao_linha`, `buscar_paradas`, `_consultar_olhovivo` | `GET /api/v1/linhas/buscar`, `/linhas/{codigo_linha}/posicoes`, `/linhas/{codigo_linha}/previsao`, `/paradas/buscar` |
| **SPTrans / exemplo** (fallback) | Linhas/paradas sem token | `server/app/services/sptrans.py` | `_linhas_fallback`, `_posicao_linha_fallback`, `_previsao_linha_fallback`, `_paradas_fallback` (`tempo_real=False`) | idem (quando `SPTRANS_TOKEN` ausente) |
| **IBGE Localidades** (OFICIAL, UF 35) | Base geográfica de SP | `server/app/services/ibge.py` | `mapear_payload`, `buscar_municipios_sp` | `GET /api/v1/localidades/sp` |
| **PMSP / GeoSampa** | Coordenadas dos distritos | `server/app/seed.py` | `REGIOES_SEED` (citação na docstring) | seed de startup |
| **httpx** | Cliente HTTP do servidor | `server/app/services/*` | chamadas `client.get/post` | serviços sptrans e ibge |
| **react-native-chart-kit** | Gráfico de barras | `mobile/src/screens/RelatoriosScreen.tsx` | `GraficoMedias` (`BarChart`) | tela Relatórios |
| **Fetch API** | Cliente HTTP do app | `mobile/src/api/client.ts` | `requisitar`, `atualizarTransporte` etc. | todas as telas |

## 6.1 Back-end

### 6.1.1 Camada de dados - `server/app/database.py`

Configura o ORM SQLAlchemy 2.x e o banco SQLite. Pontos-chave:

- `DATABASE_URL` vem de variável de ambiente; o default é um arquivo SQLite. Para
  **migrar a PostgreSQL**, basta definir `DATABASE_URL` sem mudar modelos ou
  rotas, exemplificando a escalabilidade do banco no sistema distribuído.
- `check_same_thread=False` é específico do SQLite.
- `get_db` é a **dependência** injetada nas rotas (`Depends(get_db)`), garantindo
  uma sessão por requisição, sempre fechada ao final. Referência:
  [SQLAlchemy ORM Quickstart](https://docs.sqlalchemy.org/en/20/orm/quickstart.html).

### 6.1.2 Modelo genérico - `server/app/models.py`

O enum e a tabela `Medicao` são o coração do modelo genérico. O enum define o
único tipo suportado nesta aplicação:

```python
class TipoMedicao(str, enum.Enum):
    transporte_publico = "transporte_publico"  # SPTrans Olho Vivo
```

Pontos-chave:

- Um único esquema representa a observação urbana via `tipo` + `parametro`, o que
  mantém o modelo aberto a extensões sem alterar tabelas.
- `native_enum=False` armazena o enum como texto (portável entre SQLite e outros).
- `fonte` guarda a origem do dado, sustentando a rastreabilidade em runtime.

### 6.1.3 Transporte público OFICIAL de SP - `server/app/services/sptrans.py`

Esta é a integração central da aplicação: a **SPTrans Olho Vivo**, fonte OFICIAL
da Prefeitura de São Paulo para a frota de ônibus. O token é lido somente da
variável de ambiente, nunca do código:

```python
ENV_TOKEN = "SPTRANS_TOKEN"

def obter_token():
    token = os.environ.get(ENV_TOKEN)
    if token is None:
        return None
    token = token.strip()
    return token or None
```

A autenticação estabelece a sessão (cookie `apManager`) reutilizando o MESMO
`httpx.Client` nas chamadas seguintes:

```python
OLHOVIVO_BASE_URL = "https://api.olhovivo.sptrans.com.br/v2.1"

def _autenticar(client, token):
    url = f"{OLHOVIVO_BASE_URL}{CAMINHO_AUTENTICAR}"   # /Login/Autenticar
    resposta = client.post(url, params={"token": token})
    resposta.raise_for_status()
    autenticado = resposta.json()
    if autenticado is not True:
        raise SPTransError("Falha ao autenticar na SPTrans Olho Vivo ...")
```

A busca decide entre tempo real (com token) e fallback (sem token):

```python
def buscar_transporte_publico(latitude, longitude, client=None):
    token = obter_token()
    if token is None:
        return _leituras_fallback()           # sem rede, exemplo rotulado
    ...
    try:
        _autenticar(client, token)
        resposta = client.get(f"{OLHOVIVO_BASE_URL}{CAMINHO_POSICAO}")  # /Posicao
        resposta.raise_for_status()
        payload = resposta.json()
    except httpx.HTTPError as exc:
        raise SPTransError(f"Falha ao consultar a SPTrans Olho Vivo: {exc}") from exc
    ...
    return mapear_payload(payload)
```

O `mapear_payload` deriva métricas reais do bloco `l` (linhas) e `vs` (veículos)
do `/Posicao`:

```python
def mapear_payload(payload):
    linhas = payload.get("l")
    ...
    for linha in linhas:
        total_linhas += 1
        veiculos = linha.get("vs")
        if isinstance(veiculos, list):
            total_veiculos += len(veiculos)
    ...
    return [LeituraTransporte("linhas_monitoradas", ...),
            LeituraTransporte("veiculos_em_operacao", ...)]
```

**Semântica das métricas (por cidade, não por região).** O endpoint recebe
`regiao_id` e repassa o lat/lon da região por uniformidade, mas o `/Posicao` do
Olho Vivo retorna a frota de São Paulo como um todo e não aceita filtro
geográfico. Assim, `linhas_monitoradas` e `veiculos_em_operacao` são métricas da
cidade inteira (frota do Olho Vivo), não geofiltradas por região: chamar
`atualizar-transporte` para regiões diferentes no mesmo instante persiste os
mesmos valores. O comportamento é intencional e está documentado nas docstrings do
serviço e do router.

E o fallback (sem token) usa um conjunto estático de linhas de EXEMPLO,
explicitamente rotulado:

```python
def _leituras_fallback():
    total = len(LINHAS_EXEMPLO)
    return [LeituraTransporte(
        parametro="linhas_exemplo", valor=float(total), unidade="linhas",
        detalhe="Dado de EXEMPLO (fallback sem token SPTRANS_TOKEN): ... NAO e tempo real.")]
```

Pontos-chave:

- **Fonte OFICIAL** no próprio código (constante `FONTE`):
  [SPTrans Olho Vivo](https://www.sptrans.com.br/desenvolvedores/). O fallback usa
  a constante `FONTE_FALLBACK`, que deixa explícito ser dado de exemplo/GTFS
  estático, NÃO tempo real.
- O **token nunca aparece no repositório**: só é lido de `SPTRANS_TOKEN`.
- A ausência de token NÃO é erro: cai no fallback funcional (o app roda ponta a
  ponta sem token). Qualquer `httpx.HTTPError` com token vira `SPTransError`.

### 6.1.4 Rota de transporte público - `server/app/routers/medicoes.py`

Função `atualizar_transporte` (endpoint `POST /api/v1/regioes/{id}/atualizar-transporte`):

```python
regiao = obter_regiao_ou_404(db, regiao_id)
# fonte reflete a origem: oficial/tempo real (com token) ou exemplo (sem token)
fonte = FONTE_TRANSPORTE if obter_token() is not None else FONTE_TRANSPORTE_FALLBACK
try:
    leituras = buscar_transporte_publico(regiao.latitude, regiao.longitude)
except SPTransError as exc:
    raise HTTPException(status_code=502,
        detail=f"Nao foi possivel obter dados de transporte publico: {exc}") from exc
...
for leitura in leituras:
    medicao = Medicao(regiao_id=regiao.id, tipo=TipoMedicao.transporte_publico,
                      parametro=leitura.parametro, ..., fonte=fonte)
    db.add(medicao)
db.commit()
```

Pontos-chave:

- Valida a existência da região (404) antes de buscar dados.
- Escolhe o campo `fonte` conforme a presença de `SPTRANS_TOKEN` (tempo real ou
  fallback de exemplo), mantendo a rastreabilidade da origem na própria medição.
- Traduz a falha da fonte externa em **502 Bad Gateway** padronizado (nunca 500
  cru), atendendo ao requisito de tratamento de erros.
- Persiste as medições com `tipo=transporte_publico`.

### 6.1.5 Acompanhamento de ônibus e busca - `server/app/services/sptrans.py` e `server/app/routers/linhas.py`

Além das métricas agregadas da frota, o serviço `sptrans.py` expõe o
**acompanhamento de ônibus** (posição dos veículos e previsão de chegada) e a
**busca** de linhas e paradas, consumindo os endpoints oficiais da SPTrans Olho
Vivo. Cada função de busca tem um `httpx.Client` injetável (facilita os testes) e
reutiliza o MESMO fluxo de autenticação por cookie das métricas, centralizado em
`_consultar_olhovivo`:

```python
def _consultar_olhovivo(caminho, params, client):
    token = obter_token()                 # o chamador ja tratou o caso None
    proprio_client = client is None
    if proprio_client:
        client = httpx.Client(timeout=TIMEOUT_SEGUNDOS)
    try:
        _autenticar(client, token)        # POST /Login/Autenticar (mesma sessao)
        url = f"{OLHOVIVO_BASE_URL}{caminho}"
        resposta = client.get(url, params=params)
        resposta.raise_for_status()
        return resposta.json()
    except httpx.HTTPError as exc:
        raise SPTransError(f"Falha ao consultar a SPTrans Olho Vivo: {exc}") from exc
    finally:
        if proprio_client:
            client.close()
```

As quatro funções mapeiam 1:1 para os endpoints do Olho Vivo e, sem token,
devolvem um conjunto de EXEMPLO claramente rotulado (sem tocar a rede):

- `buscar_linhas(termo)` -> `GET /Linha/Buscar?termosBusca=...` ->
  `mapear_linhas` -> `list[LinhaOnibus]`. Sem token: `_linhas_fallback`.
- `buscar_posicoes_linha(codigo_linha)` -> `GET /Posicao/Linha?codigoLinha=...`
  -> `mapear_posicao_linha` -> `PosicaoLinha`. Sem token: `_posicao_linha_fallback`.
- `buscar_previsao_linha(codigo_linha)` -> `GET /Previsao/Linha?codigoLinha=...`
  -> `mapear_previsao_linha` -> `PrevisaoLinha`. Sem token: `_previsao_linha_fallback`.
- `buscar_paradas(termo)` -> `GET /Parada/Buscar?termosBusca=...` ->
  `mapear_paradas` -> `list[Parada]`. Sem token: `_paradas_fallback`.

Cada dataclass de leitura (`LinhaOnibus`, `VeiculoPosicao`, `PosicaoLinha`,
`PrevisaoVeiculo`, `ParadaPrevisao`, `PrevisaoLinha`, `Parada`) carrega um
indicador `tempo_real` e a `fonte`: os mapeadores reais marcam `tempo_real=True`
com a constante `FONTE`; os fallbacks marcam `tempo_real=False` com
`FONTE_FALLBACK`, deixando explícito que NÃO são dados em tempo real.

O router `server/app/routers/linhas.py` (`APIRouter(prefix="/api/v1",
tags=["linhas"])`, registrado em `main.py`) expõe os endpoints e traduz a falha
externa em HTTP 502 PT-BR, no mesmo padrão de `atualizar_transporte`:

```python
@router.get("/linhas/buscar", response_model=list[LinhaRead])
def buscar_linhas_endpoint(termo: str = Query(..., min_length=1, ...)):
    try:
        return buscar_linhas(termo)
    except SPTransError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Nao foi possivel buscar linhas de onibus: {exc}",
        ) from exc
```

Endpoints expostos:

- `GET /api/v1/linhas/buscar?termo=...` -> `list[LinhaRead]`.
- `GET /api/v1/linhas/{codigo_linha}/posicoes` -> `PosicaoLinhaRead`.
- `GET /api/v1/linhas/{codigo_linha}/previsao` -> `PrevisaoLinhaRead`.
- `GET /api/v1/paradas/buscar?termo=...` -> `list[ParadaRead]`.

Pontos-chave:

- Os schemas de saída em `server/app/schemas.py` (`LinhaRead`,
  `VeiculoPosicaoRead`, `PosicaoLinhaRead`, `PrevisaoVeiculoRead`,
  `ParadaPrevisaoRead`, `PrevisaoLinhaRead`, `ParadaRead`) usam
  `ConfigDict(from_attributes=True)` para serem construídos a partir das
  dataclasses do serviço e expõem os campos `tempo_real` e `fonte`, documentando
  na própria resposta se o dado é tempo real ou de EXEMPLO.
- O parâmetro `termo` das buscas é validado por `Query(..., min_length=1)`, então
  a sua ausência (ou vazio) resulta em 422 padronizado (`ErroResposta`), antes de
  tocar a fonte externa.
- A autenticação (token + sessão por cookie) é a mesma de
  `buscar_transporte_publico`: o token vem só de `SPTRANS_TOKEN` (`obter_token`) e
  nunca aparece no repositório; sem token, o app funciona de ponta a ponta via
  fallback.

### 6.1.6 Base geográfica OFICIAL (IBGE) - `server/app/services/ibge.py`

Consome a API de Localidades do IBGE (UF 35 = São Paulo), fonte OFICIAL e nacional
sem chave:

```python
IBGE_MUNICIPIOS_SP_URL = (
    "https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios")
UF_SP_CODIGO = 35

def buscar_municipios_sp(client=None):
    ...
    try:
        resposta = client.get(IBGE_MUNICIPIOS_SP_URL)
        resposta.raise_for_status()
        payload = resposta.json()
    except httpx.HTTPError as exc:
        raise IbgeError(f"Falha ao consultar a API do IBGE: {exc}") from exc
    return mapear_payload(payload)
```

O endpoint retorna uma **lista** JSON; `mapear_payload` lê `id`, `nome` e a sigla
da UF dos blocos aninhados (`microrregiao.mesorregiao.UF.sigla` ou
`regiao-imediata.regiao-intermediaria.UF.sigla`), com fallback "SP".

Pontos-chave:

- Fonte OFICIAL no próprio código (constante `FONTE`):
  [IBGE - API de Localidades](https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios).
- O IBGE não fornece latitude/longitude de distritos; por isso as coordenadas do
  seed vêm de fontes oficiais da PMSP (GeoSampa), nunca inventadas.
- Exposta por `GET /api/v1/localidades/sp` (`routers/localidades.py`), que
  converte `IbgeError` em 502 padronizado.

### 6.1.7 Consulta por região e helper 404 - `server/app/routers/regioes.py`

```python
def obter_regiao_ou_404(db, regiao_id):
    regiao = db.get(Regiao, regiao_id)
    if regiao is None:
        raise HTTPException(status_code=404, detail=f"Regiao {regiao_id} nao encontrada.")
    return regiao
```

Pontos-chave:

- `GET /api/v1/regioes` alimenta a lista de regiões de SP do cliente (com lat/lon).
- O helper é reutilizado por medições, relatórios e alertas, padronizando a
  resposta 404 em PT-BR.

### 6.1.8 Relatórios agregados - `server/app/routers/relatorios.py`

Agrupa as medições por `(tipo, parametro)` e calcula média, mínimo, máximo,
contagem e última leitura. Como a agregação é genérica, os parâmetros de
`transporte_publico` entram automaticamente no relatório quando há medições. Cobre
o requisito de "relatórios adicionais" da APS.

### 6.1.9 Alertas por limiar - `server/app/routers/alertas.py`

Compara a medição mais recente de cada `(tipo, parametro)` com as regras ativas
(`>` ou `<`), retornando os alertas disparados com o valor observado e a mensagem
em PT-BR. Regras são criadas por `POST /api/v1/alertas` (validadas por Pydantic).

### 6.1.10 Tratamento de erros global - `server/app/errors.py`

Instala handlers para `HTTPException` (ex.: 404 e 502), `RequestValidationError`
(422) e um genérico para `Exception` (500 tratado), todos no schema `ErroResposta`
(`codigo`, `mensagem`, `detalhe`) em PT-BR. O handler genérico impede vazamento de
stack trace cru. Referência:
[FastAPI - Handling Errors](https://fastapi.tiangolo.com/tutorial/handling-errors/).

### 6.1.11 Inicialização e seed de SP - `server/app/main.py` e `server/app/seed.py`

No `main.py`, o `lifespan` cria as tabelas e roda o seed idempotente no startup; o
CORS é liberado para o app Expo consumir a API; o título do Swagger é "API
Transporte Publico SP - APS SD".

O `seed.py` cria 12 regiões reais de São Paulo/SP (distritos da capital) com
coordenadas de fontes oficiais da PMSP (GeoSampa) citadas na docstring, e nome
validável pelo IBGE (código 35 / 3550308). As cinco regiões originais seguem
preservadas na mesma ordem (Sé, Pinheiros, Mooca, Santana, Itaquera) e foram
acrescentados mais sete distritos (Santo Amaro, Butantã, Lapa, Vila Mariana,
Ipiranga, Penha, Tatuapé), cada um com coordenadas de um marco reconhecido
(praça/estação/terminal). Para cada região gera uma medição-semente de transporte
público de EXEMPLO (`veiculos_em_operacao`) e uma regra de alerta
(`veiculos_em_operacao > 300`). As medições de seed são apenas valores iniciais de
exemplo (o campo `fonte` aponta a fonte real substituível). O seed é idempotente.

## 6.2 Cliente móvel

### 6.2.1 Cliente HTTP tipado - `mobile/src/api/client.ts`

Base da URL adaptável ao ambiente, classe de erro amigável e timeout por
`AbortController`. A função de transporte público mapeia o endpoint:

```typescript
export function atualizarTransporte(regiaoId: number): Promise<Medicao[]> {
  return requisitar<Medicao[]>(`/regioes/${regiaoId}/atualizar-transporte`, {
    method: 'POST',
  });
}
```

Pontos-chave:

- `10.0.2.2` é o alias do host no emulador Android
  ([Android emulator networking](https://developer.android.com/studio/run/emulator-networking)).
  Para iOS/web use `localhost`; para dispositivo físico, o IP da LAN. Configurável
  por `EXPO_PUBLIC_API_BASE_URL`.
- Toda falha (rede, timeout, HTTP, JSON) vira `ApiError` com mensagem PT-BR; as
  telas exibem `e.mensagem` sem crashar.
- As funções mapeiam 1:1 os endpoints da API (`getRegioes`, `getMedicoes`,
  `atualizarTransporte`, `getRelatorio`, `getAlertas`, etc.). Usa a
  [Fetch API](https://developer.mozilla.org/pt-BR/docs/Web/API/Fetch_API).

### 6.2.2 Lista de regiões de São Paulo - `mobile/src/screens/MapaScreen.tsx`

A tela inicial carrega as regiões de São Paulo da API (`getRegioes`) e as exibe em
uma **lista clicável** ("Regiões monitoradas em São Paulo"), em que cada item abre
o detalhe da região. A tela não depende de nenhum módulo nativo de mapa.

Pontos-chave:

- A tela trata os três estados de carregamento de dados: carregando, erro (com
  opção de tentar novamente) e vazio (nenhuma região cadastrada).
- O conteúdo é a mesma lista em qualquer plataforma (Android, iOS ou web), sem
  depender de nenhum módulo nativo de mapa, garantindo que a tela sempre abra.
- Cada card mostra nome, cidade/UF e as coordenadas (latitude/longitude) da
  região, e o toque navega para o Detalhe. Referência:
  [FlatList](https://reactnative.dev/docs/flatlist).
- No cabeçalho da lista há dois botões de acesso rápido: **"Linhas de onibus"**,
  que navega para a tela de Linhas (`navigation.navigate('Linhas')`), e **"Ver
  alertas"**. O cabeçalho usa `flexWrap` para acomodar os dois botões sem quebrar
  o layout.

### 6.2.3 Linhas de ônibus (acompanhamento e busca) - `mobile/src/screens/LinhasScreen.tsx`

Tela que consome o acompanhamento de ônibus e a busca da SPTrans Olho Vivo. Tem
duas abas ("Linhas" e "Paradas") que reutilizam o mesmo campo de busca:

- **Busca de linhas** (`buscarLinhas`, `GET /api/v1/linhas/buscar?termo=`): lista
  letreiro, terminais, sentido (`rotuloSentido`) e indicação de circular.
- **Acompanhamento da linha selecionada:** os botões "Ver posicao"
  (`getPosicoesLinha`, `GET /api/v1/linhas/{codigo_linha}/posicoes`) e "Ver
  previsao" (`getPrevisaoLinha`, `GET /api/v1/linhas/{codigo_linha}/previsao`)
  mostram, em LISTA, a posição dos veículos (prefixo, acessibilidade via
  `rotuloAcessivel`, horário e latitude/longitude em texto) e a previsão de
  chegada por parada (cada parada com os seus veículos e o horário previsto).
- **Busca de paradas** (`buscarParadas`, `GET /api/v1/paradas/buscar?termo=`):
  lista nome, endereço e coordenadas.

Pontos-chave:

- Todo o conteúdo é exibido em **lista** (latitude/longitude em texto); a tela não
  usa nenhum módulo nativo de mapa, garantindo que sempre abra.
- Usa `EstadoErro` (de `src/ui/estados.tsx`) com o `detalhe` técnico e captura
  `ApiError` para exibir a mensagem PT-BR ao usuário.
- Quando o back-end sinaliza `tempo_real === false` (servidor sem token da
  SPTrans), a tela exibe o aviso `AVISO_DADO_EXEMPLO` (de `src/ui/rotulos.ts`),
  deixando claro que o dado é de EXEMPLO e não tempo real.

### 6.2.4 Detalhe da região - `mobile/src/screens/DetalheScreen.tsx`

Lista as medições de transporte público da região e oferece um único botão de
atualização, **"Atualizar transporte"**, que chama `atualizarTransporte(regiaoId)`
(endpoint `POST /api/v1/regioes/{id}/atualizar-transporte`). Após a atualização, a
lista recarrega com as novas medições e cada item mostra valor, unidade, data/hora
e a `fonte` (tempo real com token ou exemplo no fallback). Também dá acesso à tela
de relatório da região.

### 6.2.5 Relatório com gráfico de barras - `mobile/src/screens/RelatoriosScreen.tsx`

Além da lista tabular, a tela resume as médias por par tipo/parâmetro num gráfico
de barras com `BarChart` do **react-native-chart-kit** (desenha via
**react-native-svg**), medindo a largura com `useWindowDimensions`:

```tsx
import { BarChart } from 'react-native-chart-kit';

function GraficoMedias({ resumos, larguraJanela }) {
  if (resumos.length === 0) return null;            // trata dataset vazio
  const labels = resumos.map(
    (item) => `${rotuloTipo(item.tipo)} - ${rotuloParametro(item.parametro)}`,
  );
  const valores = resumos.map((item) =>
    Number.isFinite(item.media) ? item.media : 0,
  );
  const larguraGrafico = Math.max(larguraJanela - 32, 0);
  return (
    <View style={styles.graficoCartao}>
      <Text style={styles.graficoTitulo}>Medias por parametro</Text>
      <BarChart data={{ labels, datasets: [{ data: valores }] }} ... />
    </View>
  );
}
```

Pontos-chave:

- **Biblioteca e justificativa:** react-native-chart-kit (7.0.4) foi escolhida por
  ser compatível com o stack atual (Expo SDK 57, React 19.2.3, React Native
  0.86.3) e por ter como única dependência nativa o react-native-svg (15.15.4),
  módulo suportado pelo Expo. Instalada com
  `npx expo install react-native-chart-kit react-native-svg`. Referências:
  [react-native-chart-kit](https://github.com/indiespirit/react-native-chart-kit)
  e [npm](https://www.npmjs.com/package/react-native-chart-kit).
- O rótulo das barras combina **tipo + parâmetro**, usando `rotuloTipo`/
  `rotuloParametro` de `src/ui/rotulos.ts`; assim o tipo `transporte_publico`
  ("Transporte publico (SPTrans)") aparece com rótulo PT-BR.
- Trata dataset vazio (não renderiza o gráfico) e é injetado como
  `ListHeaderComponent` da `FlatList`, preservando a lista tabular.

### 6.2.6 Rótulos PT-BR - `mobile/src/ui/rotulos.ts`

Mapeia o tipo e os parâmetros técnicos para texto PT-BR:

```typescript
const ROTULOS_TIPO = {
  transporte_publico: 'Transporte publico (SPTrans)',
};
const ROTULOS_PARAMETRO = {
  linhas_monitoradas: 'Linhas monitoradas',
  veiculos_em_operacao: 'Veiculos em operacao',
  linhas_exemplo: 'Linhas (exemplo, sem token)',
};
```

### 6.2.7 Alertas - `mobile/src/screens/AlertasScreen.tsx`

Lista as regras cadastradas, oferece um formulário para criar uma regra (com o
tipo `transporte_publico`, parâmetro, condição `>`/`<` e limiar) e um botão para
avaliar os alertas de uma região selecionada, destacando os alertas disparados.

### 6.2.8 Navegação - `mobile/App.tsx`

Registra as telas em um stack nativo do React Navigation
(`@react-navigation/native-stack`), com títulos em PT-BR. Referência:
[React Navigation - Native Stack](https://reactnavigation.org/docs/native-stack-navigator).

## 6.3 Testes automatizados (`server/tests/`)

A suíte pytest usa o `TestClient` do FastAPI e um banco SQLite em memória isolado
(configurado em `server/conftest.py`), sem tocar o banco real. **A rede e o token
são SEMPRE mockados** (nenhum teste acessa a SPTrans ou o IBGE reais, nem usa token
real).

- **Transporte público** (`server/tests/test_transporte.py`): valida o mapeamento
  do payload do `/Posicao` a partir do fixture
  `server/tests/fixtures/sptrans_posicao_sample.json` (métricas
  `linhas_monitoradas` e `veiculos_em_operacao`); o fallback sem token
  (`linhas_exemplo`), com `SPTRANS_TOKEN` ausente; e o endpoint
  `POST /api/v1/regioes/{id}/atualizar-transporte` (status 200 e 502 em falha),
  com a chamada externa e o token mockados.
- **Acompanhamento de ônibus e busca** (`server/tests/test_linhas.py`): valida o
  mapeamento puro dos payloads a partir dos fixtures
  `sptrans_linha_buscar_sample.json`, `sptrans_posicao_linha_sample.json`,
  `sptrans_previsao_linha_sample.json` e `sptrans_parada_buscar_sample.json`; o
  fluxo HTTP autenticado (verificando os parâmetros `termosBusca`/`codigoLinha` e
  o reúso do cookie na mesma sessão); o fallback sem token (que NÃO toca a rede e
  devolve o conjunto de EXEMPLO rotulado, `tempo_real=false`); e o erro externo
  (autenticação recusada ou HTTP 401/500) virando `SPTransError` e, pelos
  endpoints `GET /api/v1/linhas/buscar`, `/linhas/{codigo_linha}/posicoes`,
  `/linhas/{codigo_linha}/previsao` e `/paradas/buscar`, HTTP 502 no schema
  `ErroResposta`. Rede e token sempre mockados.
- **Base geográfica** (`server/tests/test_ibge.py`): valida o mapeamento do
  payload de municípios a partir do fixture
  `server/tests/fixtures/ibge_municipios_sample.json` e o endpoint
  `GET /api/v1/localidades/sp`, com a rede mockada; ramos de erro levantam
  `IbgeError`.
- **Demais** (`test_health.py`, `test_regioes.py`, `test_medicoes.py`,
  `test_relatorios.py`, `test_alertas.py`): saúde, regiões (404 no schema de
  erro, além de confirmar as 12 regiões do seed, incluindo os distritos
  acrescentados), listagem/filtro de medições, agregação do relatório,
  criação/avaliação de alertas e validação inválida (422).
