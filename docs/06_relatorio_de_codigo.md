# 6. Relatorio com as linhas de codigo

Este relatorio comenta os trechos de codigo mais relevantes do projeto, indicando
o arquivo, a funcao e a tecnologia/fonte aplicada em cada ponto. Nao repete todo o
codigo; destaca os nucleos. Os caminhos apontam para o codigo real do repositorio
(versao reorientada a Sao Paulo).

## 6.0 Mapa de rastreabilidade (fonte -> arquivo/funcao)

| Fonte / biblioteca | Papel | Arquivo | Funcao / ponto | Endpoint que a usa |
| --- | --- | --- | --- | --- |
| **SPTrans Olho Vivo** (OFICIAL SP, token) | Transporte publico, tempo real | `server/app/services/sptrans.py` | `obter_token`, `_autenticar`, `mapear_payload`, `buscar_transporte_publico`; constantes `FONTE`/`FONTE_FALLBACK` | `POST /api/v1/regioes/{id}/atualizar-transporte` |
| **SPTrans GTFS / exemplo** (fallback) | Transporte sem token | `server/app/services/sptrans.py` | `_leituras_fallback` (`LINHAS_EXEMPLO`) | idem (quando `SPTRANS_TOKEN` ausente) |
| **Open-Meteo Air Quality** (operacional) | Qualidade do ar | `server/app/services/openmeteo.py` | `mapear_payload`, `buscar_qualidade_ar` | `POST /api/v1/regioes/{id}/atualizar-ar` |
| **CETESB / QUALAR** (autoridade oficial SP) | Referencia de qualidade do ar | `server/app/services/openmeteo.py` | constante `FONTE` (citacao) | idem (gravado no campo `fonte`) |
| **Open-Meteo Flood / GloFAS** (operacional) | Alagamento (descarga fluvial) | `server/app/services/flood.py` | `mapear_payload`, `buscar_alagamento` | `POST /api/v1/regioes/{id}/atualizar-alagamento` |
| **CGE-SP** (autoridade oficial SP) | Referencia de alagamentos | `server/app/services/flood.py` | constante `FONTE` (citacao) | idem (gravado no campo `fonte`) |
| **IBGE Localidades** (OFICIAL, UF 35) | Base geografica de SP | `server/app/services/ibge.py` | `mapear_payload`, `buscar_municipios_sp` | `GET /api/v1/localidades/sp` |
| **PMSP / GeoSampa** | Coordenadas dos distritos | `server/app/seed.py` | `REGIOES_SEED` (citacao na docstring) | seed de startup |
| **Overpass / OpenStreetMap** (LEGADO, ODbL) | Transito viario | `server/app/services/overpass.py` | `mapear_payload`, `buscar_transito` | `POST /api/v1/regioes/{id}/atualizar-transito` |
| **httpx** | Cliente HTTP do servidor | `server/app/services/*` | chamadas `client.get/post` | todos os servicos |
| **react-native-maps** | Mapa de SP | `mobile/src/screens/MapaScreen.tsx` | `MapView`/`Marker`, `REGIAO_INICIAL` | tela Mapa |
| **react-native-chart-kit** | Grafico de barras | `mobile/src/screens/RelatoriosScreen.tsx` | `GraficoMedias` (`BarChart`) | tela Relatorios |
| **Fetch API** | Cliente HTTP do app | `mobile/src/api/client.ts` | `requisitar`, `atualizarTransporte` etc. | todas as telas |

## 6.1 Back-end

### 6.1.1 Camada de dados - `server/app/database.py`

Configura o ORM SQLAlchemy 2.x e o banco SQLite. Pontos-chave:

- `DATABASE_URL` vem de variavel de ambiente; o default e um arquivo SQLite. Para
  **migrar a PostgreSQL**, basta definir `DATABASE_URL` sem mudar modelos ou
  rotas, exemplificando a escalabilidade do banco no sistema distribuido.
- `check_same_thread=False` e especifico do SQLite.
- `get_db` e a **dependencia** injetada nas rotas (`Depends(get_db)`), garantindo
  uma sessao por requisicao, sempre fechada ao final. Referencia:
  [SQLAlchemy ORM Quickstart](https://docs.sqlalchemy.org/en/20/orm/quickstart.html).

### 6.1.2 Modelo generico - `server/app/models.py`

O enum e a tabela `Medicao` sao o coracao do modelo generico. Nesta versao, o enum
ganhou o valor `transporte_publico`:

```python
class TipoMedicao(str, enum.Enum):
    qualidade_ar = "qualidade_ar"
    transito = "transito"            # LEGADO (Overpass/OpenStreetMap)
    alagamento = "alagamento"
    transporte_publico = "transporte_publico"  # SPTrans Olho Vivo
```

Pontos-chave:

- Um unico esquema representa qualquer assunto ambiental via `tipo` + `parametro`,
  o que permitiu adicionar `transporte_publico` sem alterar tabelas.
- `native_enum=False` armazena o enum como texto (portavel entre SQLite e outros).
- `fonte` guarda a origem do dado, sustentando a rastreabilidade em runtime.

### 6.1.3 Transporte publico OFICIAL de SP - `server/app/services/sptrans.py`

Esta e a integracao central desta versao: a **SPTrans Olho Vivo**, fonte OFICIAL
da Prefeitura de Sao Paulo para a frota de onibus. O token e lido somente da
variavel de ambiente, nunca do codigo:

```python
ENV_TOKEN = "SPTRANS_TOKEN"

def obter_token():
    token = os.environ.get(ENV_TOKEN)
    if token is None:
        return None
    token = token.strip()
    return token or None
```

A autenticacao estabelece a sessao (cookie `apManager`) reutilizando o MESMO
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

O `mapear_payload` deriva metricas reais do bloco `l` (linhas) e `vs` (veiculos)
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

E o fallback (sem token) usa um conjunto estatico de linhas de EXEMPLO,
explicitamente rotulado:

```python
def _leituras_fallback():
    total = len(LINHAS_EXEMPLO)
    return [LeituraTransporte(
        parametro="linhas_exemplo", valor=float(total), unidade="linhas",
        detalhe="Dado de EXEMPLO (fallback sem token SPTRANS_TOKEN): ... NAO e tempo real.")]
```

Pontos-chave:

- **Fonte OFICIAL** no proprio codigo (constante `FONTE`):
  [SPTrans Olho Vivo](https://www.sptrans.com.br/desenvolvedores/). O fallback usa
  a constante `FONTE_FALLBACK`, que deixa explicito ser dado de exemplo/GTFS
  estatico, NAO tempo real.
- O **token nunca aparece no repositorio**: so e lido de `SPTRANS_TOKEN`.
- A ausencia de token NAO e erro: cai no fallback funcional (o app roda ponta a
  ponta sem token). Qualquer `httpx.HTTPError` com token vira `SPTransError`.

### 6.1.4 Rota de transporte publico - `server/app/routers/medicoes.py`

Funcao `atualizar_transporte` (endpoint `POST /api/v1/regioes/{id}/atualizar-transporte`):

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

- Valida a existencia da regiao (404) antes de buscar dados.
- Escolhe o campo `fonte` conforme a presenca de `SPTRANS_TOKEN` (tempo real ou
  fallback de exemplo), mantendo a rastreabilidade da origem na propria medicao.
- Traduz a falha da fonte externa em **502 Bad Gateway** padronizado (nunca 500
  cru), atendendo ao requisito de tratamento de erros.
- Persiste as medicoes com `tipo=transporte_publico`.

### 6.1.5 Qualidade do ar (Open-Meteo + CETESB) - `server/app/services/openmeteo.py`

Consome a Open-Meteo Air Quality API (dado operacional) e cita a CETESB/QUALAR
como autoridade oficial de SP no campo `fonte`:

```python
OPEN_METEO_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
HOURLY_PARAMS = "pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone"

FONTE = ("Open-Meteo Air Quality API (dado operacional, ...); "
         "referencia oficial de SP: CETESB/QUALAR "
         "(https://qualar.cetesb.sp.gov.br, https://cetesb.sp.gov.br/ar/)")

def buscar_qualidade_ar(latitude, longitude, client=None):
    params = {"latitude": latitude, "longitude": longitude, "hourly": HOURLY_PARAMS}
    ...
    try:
        resposta = client.get(OPEN_METEO_URL, params=params)
        resposta.raise_for_status()
        payload = resposta.json()
    except httpx.HTTPError as exc:
        raise OpenMeteoError(f"Falha ao consultar a Open-Meteo: {exc}") from exc
    return mapear_payload(payload)
```

Pontos-chave:

- Fonte operacional:
  [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api).
  Autoridade oficial de SP citada no `fonte`:
  [CETESB/QUALAR](https://qualar.cetesb.sp.gov.br).
- A unidade (ug/m3) e lida do bloco `hourly_units` do payload, com fallback.
- `mapear_payload` pega o valor horario nao-nulo mais recente por parametro.
- O endpoint `POST /api/v1/regioes/{id}/atualizar-ar` persiste com
  `tipo=qualidade_ar` e `fonte=FONTE`, convertendo falha em 502 padronizado.

### 6.1.6 Alagamento (Open-Meteo Flood/GloFAS + CGE-SP) - `server/app/services/flood.py`

Consome a Open-Meteo Flood API (base GloFAS) e cita o CGE-SP como autoridade
oficial de SP no campo `fonte`:

```python
FLOOD_API_URL = "https://flood-api.open-meteo.com/v1/flood"
DAILY_PARAMS = "river_discharge,river_discharge_mean,river_discharge_max"
UNIDADE_PADRAO = "m3/s"  # fallback; a unidade real vem de daily_units

FONTE = ("Open-Meteo Flood API / GloFAS (dado operacional, ...); "
         "referencia oficial de SP: CGE-SP (https://www.cgesp.org/)")
```

O `mapear_payload` deriva descarga atual, media e maxima do periodo, lendo a
unidade de `daily_units`:

```python
def mapear_payload(payload):
    if payload.get("error"):
        raise FloodError(f"Erro retornado pela Open-Meteo Flood API: {payload.get('reason')}")
    daily = payload.get("daily")
    ...
    unidade_descarga = daily_units.get("river_discharge") or UNIDADE_PADRAO
    # river_discharge (atual), river_discharge_media, river_discharge_maxima
```

Pontos-chave:

- Fonte operacional:
  [Open-Meteo Flood API](https://open-meteo.com/en/docs/flood-api); base cientifica
  [GloFAS](https://global-flood.emergency.copernicus.eu). Autoridade oficial de SP
  citada no `fonte`: [CGE-SP](https://www.cgesp.org/).
- A descarga fluvial (`river_discharge`, em m3/s) e indicador de risco de cheia.
- A unidade e lida de `daily_units` com fallback `m3/s`, nunca hardcodada.
- O endpoint `POST /api/v1/regioes/{id}/atualizar-alagamento` persiste com
  `tipo=alagamento` e `fonte=FONTE`, convertendo falha em 502 padronizado.

### 6.1.7 Base geografica OFICIAL (IBGE) - `server/app/services/ibge.py`

Consome a API de Localidades do IBGE (UF 35 = Sao Paulo), fonte OFICIAL e nacional
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

O endpoint retorna uma **lista** JSON; `mapear_payload` le `id`, `nome` e a sigla
da UF dos blocos aninhados (`microrregiao.mesorregiao.UF.sigla` ou
`regiao-imediata.regiao-intermediaria.UF.sigla`), com fallback "SP".

Pontos-chave:

- Fonte OFICIAL no proprio codigo (constante `FONTE`):
  [IBGE - API de Localidades](https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios).
- O IBGE nao fornece latitude/longitude de distritos; por isso as coordenadas do
  seed vem de fontes oficiais da PMSP (GeoSampa), nunca inventadas.
- Exposta por `GET /api/v1/localidades/sp` (`routers/localidades.py`), que
  converte `IbgeError` em 502 padronizado.

### 6.1.8 Transito LEGADO (Overpass) - `server/app/services/overpass.py`

Mantido do projeto anterior como tipo `transito`. Consome a Overpass API do
OpenStreetMap (dados ODbL), exige o header `User-Agent` (`APS-UNIP-SD/1.0`, sem o
qual a API responde HTTP 406) e deriva metricas de infraestrutura viaria em
`mapear_payload`. Qualquer `httpx.HTTPError` vira `OverpassError`. Consumido por
`POST /api/v1/regioes/{id}/atualizar-transito`. Fonte:
[Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API); licenca
[ODbL](https://www.openstreetmap.org/copyright).

### 6.1.9 Consulta por regiao e helper 404 - `server/app/routers/regioes.py`

```python
def obter_regiao_ou_404(db, regiao_id):
    regiao = db.get(Regiao, regiao_id)
    if regiao is None:
        raise HTTPException(status_code=404, detail=f"Regiao {regiao_id} nao encontrada.")
    return regiao
```

Pontos-chave:

- `GET /api/v1/regioes` alimenta o mapa de SP do cliente (lista com lat/lon).
- O helper e reutilizado por medicoes, relatorios e alertas, padronizando a
  resposta 404 em PT-BR.

### 6.1.10 Relatorios agregados - `server/app/routers/relatorios.py`

Agrupa as medicoes por `(tipo, parametro)` e calcula media, minimo, maximo,
contagem e ultima leitura. Como a agregacao e generica, o novo tipo
`transporte_publico` entra automaticamente no relatorio quando ha medicoes. Cobre
o requisito de "relatorios adicionais" da APS.

### 6.1.11 Alertas por limiar - `server/app/routers/alertas.py`

Compara a medicao mais recente de cada `(tipo, parametro)` com as regras ativas
(`>` ou `<`), retornando os alertas disparados com o valor observado e a mensagem
em PT-BR. Regras sao criadas por `POST /api/v1/alertas` (validadas por Pydantic).

### 6.1.12 Tratamento de erros global - `server/app/errors.py`

Instala handlers para `HTTPException` (ex.: 404 e 502), `RequestValidationError`
(422) e um generico para `Exception` (500 tratado), todos no schema `ErroResposta`
(`codigo`, `mensagem`, `detalhe`) em PT-BR. O handler generico impede vazamento de
stack trace cru. Referencia:
[FastAPI - Handling Errors](https://fastapi.tiangolo.com/tutorial/handling-errors/).

### 6.1.13 Inicializacao e seed de SP - `server/app/main.py` e `server/app/seed.py`

No `main.py`, o `lifespan` cria as tabelas e roda o seed idempotente no startup; o
CORS e liberado para o app Expo consumir a API; o titulo do Swagger e "API
Ambiental Urbana - APS SD".

O `seed.py` cria 5 regioes reais de Sao Paulo/SP (distritos da capital: Se,
Pinheiros, Mooca, Santana, Itaquera) com coordenadas de fontes oficiais da PMSP
(GeoSampa) citadas na docstring, e nome validavel pelo IBGE (codigo 35 /
3550308). As medicoes de seed sao apenas valores iniciais de exemplo (o campo
`fonte` aponta a fonte real substituivel). O seed e idempotente.

## 6.2 Cliente movel

### 6.2.1 Cliente HTTP tipado - `mobile/src/api/client.ts`

Base da URL adaptavel ao ambiente, classe de erro amigavel e timeout por
`AbortController`. A funcao de transporte publico mapeia o novo endpoint:

```typescript
export function atualizarTransporte(regiaoId: number): Promise<Medicao[]> {
  return requisitar<Medicao[]>(`/regioes/${regiaoId}/atualizar-transporte`, {
    method: 'POST',
  });
}
```

Pontos-chave:

- `10.0.2.2` e o alias do host no emulador Android
  ([Android emulator networking](https://developer.android.com/studio/run/emulator-networking)).
  Para iOS/web use `localhost`; para dispositivo fisico, o IP da LAN. Configuravel
  por `EXPO_PUBLIC_API_BASE_URL`.
- Toda falha (rede, timeout, HTTP, JSON) vira `ApiError` com mensagem PT-BR; as
  telas exibem `e.mensagem` sem crashar.
- As funcoes mapeiam 1:1 os endpoints da API (`atualizarAr`, `atualizarAlagamento`,
  `atualizarTransporte`, `atualizarTransito`, etc.). Usa a
  [Fetch API](https://developer.mozilla.org/pt-BR/docs/Web/API/Fetch_API).

### 6.2.2 Mapa de Sao Paulo com fallback - `mobile/src/screens/MapaScreen.tsx`

O react-native-maps e importado condicionalmente (nao existe build web) e o mapa e
enquadrado na cidade de Sao Paulo:

```tsx
const REGIAO_INICIAL = {
  latitude: -23.55,
  longitude: -46.63,
  latitudeDelta: 0.3,
  longitudeDelta: 0.3,
};
```

Pontos-chave:

- Import condicional evita quebrar a web e mantem a checagem de tipos verde.
- Ha sempre uma **lista clicavel** ("Regioes monitoradas em Sao Paulo") como
  alternativa ao mapa (util quando o mapa aparece em cinza no Android sem Google
  Maps API key). Referencia:
  [react-native-maps](https://github.com/react-native-maps/react-native-maps).

### 6.2.3 Relatorio com grafico de barras - `mobile/src/screens/RelatoriosScreen.tsx`

Alem da lista tabular, a tela resume as medias por par tipo/parametro num grafico
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
  ser compativel com o stack atual (Expo SDK 57, React 19.2.3, React Native
  0.86.3) e por ter como unica dependencia nativa o react-native-svg (15.15.4),
  modulo suportado pelo Expo. Instalada com
  `npx expo install react-native-chart-kit react-native-svg`. Referencias:
  [react-native-chart-kit](https://github.com/indiespirit/react-native-chart-kit)
  e [npm](https://www.npmjs.com/package/react-native-chart-kit).
- O rotulo das barras combina **tipo + parametro**, usando `rotuloTipo`/
  `rotuloParametro` de `src/ui/rotulos.ts`; assim o novo tipo
  `transporte_publico` ("Transporte publico (SPTrans)") aparece com rotulo PT-BR.
- Trata dataset vazio (nao renderiza o grafico) e e injetado como
  `ListHeaderComponent` da `FlatList`, preservando a lista tabular.

### 6.2.4 Rotulos PT-BR - `mobile/src/ui/rotulos.ts`

Mapeia os tipos e parametros tecnicos para texto PT-BR. O novo tipo e seus
parametros da SPTrans estao mapeados:

```typescript
const ROTULOS_TIPO = {
  qualidade_ar: 'Qualidade do ar',
  transito: 'Transito',
  alagamento: 'Alagamento',
  transporte_publico: 'Transporte publico (SPTrans)',
};
const ROTULOS_PARAMETRO = {
  linhas_monitoradas: 'Linhas monitoradas',
  veiculos_em_operacao: 'Veiculos em operacao',
};
```

### 6.2.5 Navegacao - `mobile/App.tsx`

Registra as telas em um stack nativo do React Navigation
(`@react-navigation/native-stack`), com titulos em PT-BR. Referencia:
[React Navigation - Native Stack](https://reactnavigation.org/docs/native-stack-navigator).

## 6.3 Testes automatizados (`server/tests/`)

A suite pytest usa o `TestClient` do FastAPI e um banco SQLite em memoria isolado
(configurado em `server/conftest.py`), sem tocar o banco real. **A rede e o token
sao SEMPRE mockados** (nenhum teste acessa a SPTrans, a Open-Meteo, o IBGE ou a
Overpass reais, nem usa token real).

- **Transporte publico** (`server/tests/test_transporte.py`): valida o mapeamento
  do payload do `/Posicao` a partir do fixture
  `server/tests/fixtures/sptrans_posicao_sample.json` (metricas
  `linhas_monitoradas` e `veiculos_em_operacao`); o fallback sem token
  (`linhas_exemplo`), com `SPTRANS_TOKEN` ausente; e o endpoint
  `POST /api/v1/regioes/{id}/atualizar-transporte` (status 200 e 502 em falha),
  com a chamada externa e o token mockados.
- **Base geografica** (`server/tests/test_ibge.py`): valida o mapeamento do
  payload de municipios a partir do fixture
  `server/tests/fixtures/ibge_municipios_sample.json` e o endpoint
  `GET /api/v1/localidades/sp`, com a rede mockada; ramos de erro levantam
  `IbgeError`.
- **Qualidade do ar** (`server/tests/test_medicoes.py`): mapeamento do payload da
  Open-Meteo a partir de `openmeteo_sample.json`, com a chamada mockada.
- **Alagamento** (`server/tests/test_alagamento.py`): mapeamento do payload da
  Flood API a partir de `flood_sample.json`, ramos de erro (`FloodError`) e o
  endpoint `atualizar-alagamento` (200 e 502), inclusive a camada HTTP com
  `httpx.MockTransport`.
- **Transito LEGADO** (`server/tests/test_transito.py`): mapeamento do payload da
  Overpass a partir de `overpass_sample.json` e o endpoint `atualizar-transito`
  (200 e 502), com a rede mockada.
- **Demais** (`test_health.py`, `test_regioes.py`, `test_relatorios.py`,
  `test_alertas.py`): saude, regioes (404 no schema de erro), agregacao do
  relatorio, criacao/avaliacao de alertas e validacao invalida (422).
