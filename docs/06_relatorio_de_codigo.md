# 6. Relatorio com as linhas de codigo

Este relatorio comenta os trechos de codigo mais relevantes do projeto, indicando
o arquivo, a funcao e a tecnologia/referencia aplicada em cada ponto. Nao repete
todo o codigo; destaca os nucleos. Os caminhos apontam para o codigo real do
repositorio.

## 6.1 Back-end

### 6.1.1 Camada de dados - `server/app/database.py`

Configura o ORM SQLAlchemy 2.x e o banco SQLite. O trecho central cria o engine e
a fabrica de sessoes:

```python
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

class Base(DeclarativeBase):
    ...

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

Pontos-chave:

- `DATABASE_URL` vem de variavel de ambiente; o default e um arquivo SQLite. Para
  **migrar a PostgreSQL**, basta definir `DATABASE_URL` (ex.:
  `postgresql+psycopg://...`) sem mudar modelos ou rotas. Isso exemplifica a
  escalabilidade do banco no sistema distribuido.
- `check_same_thread=False` e especifico do SQLite (necessario pois o servidor
  acessa a conexao de threads diferentes).
- `get_db` e a **dependencia** injetada nas rotas (`Depends(get_db)`), garantindo
  uma sessao por requisicao, sempre fechada ao final. Referencia:
  [SQLAlchemy ORM Quickstart](https://docs.sqlalchemy.org/en/20/orm/quickstart.html).

### 6.1.2 Modelo generico - `server/app/models.py`

O enum e a tabela `Medicao` sao o coracao do modelo generico:

```python
class TipoMedicao(str, enum.Enum):
    qualidade_ar = "qualidade_ar"
    transito = "transito"
    alagamento = "alagamento"

class Medicao(Base):
    __tablename__ = "medicoes"
    id: Mapped[int] = mapped_column(primary_key=True)
    regiao_id: Mapped[int] = mapped_column(ForeignKey("regioes.id", ondelete="CASCADE"), ...)
    tipo: Mapped[TipoMedicao] = mapped_column(Enum(TipoMedicao, native_enum=False), ...)
    parametro: Mapped[str] = mapped_column(String(60), nullable=False)
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    unidade: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), ..., default=_agora_utc)
    fonte: Mapped[str] = mapped_column(String(255), nullable=False, default="")
```

Pontos-chave:

- Um unico esquema representa qualquer assunto ambiental via `tipo` + `parametro`.
- `native_enum=False` armazena o enum como texto (portavel entre SQLite e outros
  bancos).
- `fonte` guarda a origem do dado, sustentando a rastreabilidade tambem em runtime.
- Uso do estilo SQLAlchemy 2.x com `Mapped`/`mapped_column`.

### 6.1.3 Integracao com dados reais - `server/app/services/openmeteo.py`

Consome a Open-Meteo Air Quality API e converte falhas em erro tratado:

```python
OPEN_METEO_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
HOURLY_PARAMS = "pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone"

def buscar_qualidade_ar(latitude, longitude, client=None):
    params = {"latitude": latitude, "longitude": longitude, "hourly": HOURLY_PARAMS}
    ...
    try:
        resposta = client.get(OPEN_METEO_URL, params=params)
        resposta.raise_for_status()
        payload = resposta.json()
    except httpx.HTTPError as exc:
        raise OpenMeteoError(f"Falha ao consultar a Open-Meteo: {exc}") from exc
    ...
    return mapear_payload(payload)
```

E a extracao da leitura mais recente por parametro:

```python
def mapear_payload(payload):
    hourly = payload.get("hourly")
    ...
    for parametro in ("pm2_5", "pm10", "carbon_monoxide", "nitrogen_dioxide", "ozone"):
        valores = hourly.get(parametro)
        ...
        for indice in range(len(valores) - 1, -1, -1):
            valor = valores[indice]
            if valor is None:
                continue
            leituras.append(LeituraAr(parametro=parametro, valor=float(valor), ...))
            break
    ...
```

Pontos-chave:

- URL e documentacao da fonte estao no proprio codigo (rastreabilidade). Fonte:
  [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api).
- Cliente HTTP `httpx` com timeout; qualquer `httpx.HTTPError` vira
  `OpenMeteoError`, evitando erro 500 cru.
- `mapear_payload` percorre a serie horaria de tras para frente e pega o primeiro
  valor nao nulo, garantindo a leitura mais recente disponivel.

### 6.1.4 Rota de atualizacao com fonte real - `server/app/routers/medicoes.py`

Funcao `atualizar_qualidade_ar` (endpoint `POST /api/v1/regioes/{id}/atualizar-ar`):

```python
regiao = obter_regiao_ou_404(db, regiao_id)
try:
    leituras = buscar_qualidade_ar(regiao.latitude, regiao.longitude)
except OpenMeteoError as exc:
    raise HTTPException(status_code=502, detail=f"Nao foi possivel obter dados de qualidade do ar: {exc}") from exc
...
for leitura in leituras:
    medicao = Medicao(regiao_id=regiao.id, tipo=TipoMedicao.qualidade_ar, parametro=leitura.parametro, ...)
    db.add(medicao)
db.commit()
```

Pontos-chave:

- Valida a existencia da regiao (404) antes de buscar dados.
- Traduz a falha da fonte externa em **502 Bad Gateway** padronizado (nunca 500
  cru), atendendo ao requisito de tratamento de erros.
- Persiste as novas medicoes com `tipo=qualidade_ar` e `fonte` da Open-Meteo.

### 6.1.4.1 Integracao com dados reais de transito - `server/app/services/overpass.py`

Consome a Overpass API do OpenStreetMap e deriva metricas reais de infraestrutura
viaria, espelhando o padrao do servico da Open-Meteo (dataclass de leitura,
funcao `mapear_payload`, funcao `buscar_*` com `httpx.Client` injetavel e excecao
dedicada). A chamada obrigatoriamente envia o header `User-Agent`:

```python
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "APS-UNIP-SD/1.0"  # sem User-Agent a Overpass retorna HTTP 406

def buscar_transito(latitude, longitude, client=None):
    query = _montar_query(latitude, longitude)
    headers = {"User-Agent": USER_AGENT}
    ...
    try:
        resposta = client.post(OVERPASS_URL, data={"data": query}, headers=headers)
        resposta.raise_for_status()
        payload = resposta.json()
    except httpx.HTTPError as exc:
        raise OverpassError(f"Falha ao consultar a Overpass API: {exc}") from exc
    ...
    return mapear_payload(payload)
```

E a derivacao das metricas a partir das vias (`way`) e suas tags:

```python
def mapear_payload(payload):
    elements = payload.get("elements")
    if not isinstance(elements, list):
        raise OverpassError("Resposta da Overpass sem o bloco 'elements'.")
    for elemento in elements:
        ...
        tags = elemento.get("tags")
        if not isinstance(tags, dict) or not tags.get("name"):
            continue
        total_vias += 1
        # lê lanes (faixas) e maxspeed (km/h), ignorando ausentes/invalidas
    ...
    # deriva: vias_principais (contagem), faixas_media, velocidade_maxima_media
```

Pontos-chave:

- Query Overpass QL validada em runtime, com raio e limite parametrizados por
  constantes: `way(around:1500,LAT,LON)[highway~"primary|secondary|trunk|motorway"][name]`.
- A fonte e sua licenca ficam no proprio codigo (rastreabilidade). Fonte:
  [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API); dados sob
  licenca **ODbL** ([openstreetmap.org/copyright](https://www.openstreetmap.org/copyright)).
- Qualquer `httpx.HTTPError` vira `OverpassError`, evitando erro 500 cru.
- `mapear_payload` levanta `OverpassError` quando falta `elements` ou nao ha via
  valida, mesma filosofia do servico da Open-Meteo.

### 6.1.4.2 Rota de atualizacao de transito - `server/app/routers/medicoes.py`

Funcao `atualizar_transito` (endpoint `POST /api/v1/regioes/{id}/atualizar-transito`):

```python
regiao = obter_regiao_ou_404(db, regiao_id)
try:
    leituras = buscar_transito(regiao.latitude, regiao.longitude)
except OverpassError as exc:
    raise HTTPException(status_code=502, detail=f"Nao foi possivel obter dados de transito: {exc}") from exc
...
for leitura in leituras:
    medicao = Medicao(regiao_id=regiao.id, tipo=TipoMedicao.transito, parametro=leitura.parametro, ..., fonte=FONTE_TRANSITO)
    db.add(medicao)
db.commit()
```

Pontos-chave:

- Reusa `obter_regiao_ou_404` e o padrao de **502 Bad Gateway** padronizado da
  atualizacao de ar.
- Persiste as metricas derivadas com `tipo=transito` e `fonte` citando
  OpenStreetMap/Overpass (ODbL) com link.

### 6.1.5 Consulta por regiao e helper 404 - `server/app/routers/regioes.py`

```python
def obter_regiao_ou_404(db, regiao_id):
    regiao = db.get(Regiao, regiao_id)
    if regiao is None:
        raise HTTPException(status_code=404, detail=f"Regiao {regiao_id} nao encontrada.")
    return regiao
```

Pontos-chave:

- `GET /api/v1/regioes` alimenta o mapa do cliente (lista com latitude/longitude).
- O helper `obter_regiao_ou_404` e reutilizado por medicoes, relatorios e alertas,
  padronizando a resposta 404 em PT-BR.

### 6.1.6 Relatorios agregados - `server/app/routers/relatorios.py`

Funcao `relatorio_regiao` agrupa as medicoes por `(tipo, parametro)` e calcula as
estatisticas:

```python
grupos = {}
for m in medicoes:
    grupos.setdefault((m.tipo, m.parametro), []).append(m)

for (tipo, parametro), itens in grupos.items():
    valores = [i.valor for i in itens]
    ultimo = itens[-1]
    resumos.append(ResumoParametro(
        tipo=tipo, parametro=parametro, unidade=ultimo.unidade,
        contagem=len(valores), media=sum(valores)/len(valores),
        minimo=min(valores), maximo=max(valores),
        ultimo_valor=ultimo.valor, ultimo_timestamp=ultimo.timestamp))
```

Pontos-chave:

- Cobre o requisito de "relatorios adicionais" da APS (media, minimo, maximo,
  contagem, ultima leitura por parametro).
- A ordenacao cronologica ascendente garante que `itens[-1]` seja a leitura mais
  recente.

### 6.1.7 Alertas por limiar - `server/app/routers/alertas.py`

A avaliacao compara a medicao mais recente de cada `(tipo, parametro)` com as
regras ativas:

```python
def _viola_limiar(valor, condicao, limiar):
    if condicao == ">":
        return valor > limiar
    if condicao == "<":
        return valor < limiar
    return False
...
if _viola_limiar(medicao.valor, regra.condicao, regra.limiar):
    disparados.append(AlertaDisparado(alerta_id=regra.id, ..., valor_observado=medicao.valor, mensagem=regra.mensagem or ...))
```

Pontos-chave:

- Regras sao criadas via `POST /api/v1/alertas` (validadas por Pydantic: a
  condicao aceita apenas `>` ou `<`).
- `GET /api/v1/alertas/avaliar/{regiao_id}` retorna os alertas efetivamente
  disparados, com o valor observado e a mensagem em PT-BR.

### 6.1.8 Tratamento de erros global - `server/app/errors.py`

```python
@app.exception_handler(StarletteHTTPException)
async def _http_exception_handler(request, exc):
    mensagem = exc.detail if isinstance(exc.detail, str) else "Erro na requisicao."
    return _resposta_erro(exc.status_code, mensagem)

@app.exception_handler(RequestValidationError)
async def _validation_exception_handler(request, exc):
    return _resposta_erro(422, "Dados de entrada invalidos.", detalhe=str(jsonable_encoder(exc.errors())))

@app.exception_handler(Exception)
async def _generic_exception_handler(request, exc):
    return _resposta_erro(500, "Ocorreu um erro interno no servidor.", detalhe=str(exc))
```

Pontos-chave:

- Todas as respostas de erro seguem o schema `ErroResposta` (`codigo`, `mensagem`,
  `detalhe`), com mensagens em PT-BR.
- O handler generico impede vazamento de stack trace cru ao cliente. Referencia:
  [FastAPI - Handling Errors](https://fastapi.tiangolo.com/tutorial/handling-errors/).

### 6.1.9 Inicializacao e seed - `server/app/main.py` e `server/app/seed.py`

No `main.py`, o `lifespan` cria as tabelas e roda o seed idempotente no startup, e
o CORS e liberado para o app Expo consumir a API:

```python
@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        executar_seed(db)
    finally:
        db.close()
    yield
```

O `seed.py` cria 3 regioes reais e, por regiao, medicoes dos tres tipos e duas
regras de alerta, distinguindo dados reais de simulados pelo campo `fonte`. E
idempotente: se ja houver regioes, nao faz nada.

## 6.2 Cliente movel

### 6.2.1 Cliente HTTP tipado - `mobile/src/api/client.ts`

Base da URL adaptavel ao ambiente e classe de erro amigavel:

```typescript
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:8000';

export class ApiError extends Error {
  readonly codigo: number;
  readonly detalhe?: string | null;
  get mensagem(): string { return this.message; }
}
```

Tratamento central de falhas (timeout via `AbortController` e erros de rede):

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
try {
  resposta = await fetch(url, { ..., signal: controller.signal });
} catch (erro) {
  const abortado = erro instanceof Error && erro.name === 'AbortError';
  const mensagem = abortado
    ? 'A conexao demorou demais para responder. ...'
    : 'Nao foi possivel conectar ao servidor. ...';
  throw new ApiError(mensagem, 0, ...);
}
```

Pontos-chave:

- `10.0.2.2` e o alias do host no emulador Android
  ([Android emulator networking](https://developer.android.com/studio/run/emulator-networking)).
  Para iOS/web use `localhost`; para dispositivo fisico, o IP da LAN.
- Toda falha (rede, timeout, HTTP, JSON) vira `ApiError` com mensagem PT-BR; as
  telas exibem `e.mensagem` sem crashar.
- As funcoes (`getRegioes`, `atualizarAr`, etc.) mapeiam 1:1 os endpoints da API.

### 6.2.2 Mapa com fallback - `mobile/src/screens/MapaScreen.tsx`

O react-native-maps e importado condicionalmente (nao existe build web):

```typescript
let MapaComponente: any = null;
let MarcadorComponente: any = null;
if (Platform.OS !== 'web') {
  const mapas = require('react-native-maps');
  MapaComponente = mapas.default;
  MarcadorComponente = mapas.Marker;
}
```

E os marcadores sao posicionados por latitude/longitude:

```tsx
<MarcadorComponente
  coordinate={{ latitude: regiao.latitude, longitude: regiao.longitude }}
  title={regiao.nome}
  description={`${regiao.cidade} - ${regiao.uf}`}
  onCalloutPress={() => abrirDetalhe(regiao)}
/>
```

Pontos-chave:

- Import condicional evita quebrar a web e mantem a checagem de tipos verde.
- Ha sempre uma **lista clicavel** de regioes como alternativa ao mapa (util
  quando o mapa aparece em cinza no Android sem Google Maps API key). Referencia:
  [react-native-maps](https://github.com/react-native-maps/react-native-maps).

### 6.2.3 Atualizacao de dados reais na tela - `mobile/src/screens/DetalheScreen.tsx`

```typescript
const onAtualizarAr = useCallback(async () => {
  setAtualizando(true);
  try {
    await atualizarAr(regiaoId);
    setAviso('Qualidade do ar atualizada com dados da Open-Meteo.');
    await carregar();
  } catch (e) {
    const msg = e instanceof ApiError ? e.mensagem : 'Nao foi possivel atualizar ...';
    setAviso(msg);
  } finally {
    setAtualizando(false);
  }
}, [regiaoId, carregar]);
```

Pontos-chave:

- Aciona o endpoint que busca dados reais na Open-Meteo e recarrega a lista.
- Erros sao mostrados como aviso amigavel, sem interromper a tela.

### 6.2.4 Relatorio com grafico de barras - `mobile/src/screens/RelatoriosScreen.tsx`

Alem da lista tabular (cards com media/minimo/maximo/amostras por parametro), a
tela agora resume os dados agregados em um **grafico de barras** com a media de
cada par tipo/parametro. Usa o componente `BarChart` da biblioteca
**react-native-chart-kit** (que desenha via **react-native-svg**) e mede a largura
disponivel com `useWindowDimensions`:

```tsx
import { BarChart } from 'react-native-chart-kit';
import { useWindowDimensions } from 'react-native';

function GraficoMedias({ resumos, larguraJanela }) {
  if (resumos.length === 0) {
    return null; // trata dataset vazio: nao renderiza o grafico
  }
  const labels = resumos.map((item) => item.parametro);
  const valores = resumos.map((item) =>
    Number.isFinite(item.media) ? item.media : 0,
  );
  const larguraGrafico = Math.max(larguraJanela - 32, 0);
  return (
    <View style={styles.graficoCartao}>
      <Text style={styles.graficoTitulo}>Medias por parametro</Text>
      <BarChart
        data={{ labels, datasets: [{ data: valores }] }}
        width={larguraGrafico}
        height={220}
        yAxisLabel=""
        yAxisSuffix=""
        fromZero
        showValuesOnTopOfBars
        verticalLabelRotation={30}
        chartConfig={chartConfig}
      />
    </View>
  );
}
```

O grafico e injetado como `ListHeaderComponent` da `FlatList`, mantendo a lista
tabular intacta:

```tsx
<FlatList
  data={relatorio.resumos}
  keyExtractor={(item) => `${item.tipo}-${item.parametro}`}
  ListHeaderComponent={cabecalho}
  renderItem={renderItem}
/>
```

Pontos-chave:

- **Biblioteca e justificativa:** react-native-chart-kit (7.0.4) foi escolhida por
  ser compativel com o stack atual (Expo SDK 57, React 19.2.3, React Native
  0.86.3) e por ter como unica dependencia nativa o react-native-svg (15.15.4),
  modulo suportado pelo Expo. Instalada com
  `npx expo install react-native-chart-kit react-native-svg`. Alternativas
  (react-native-gifted-charts, victory-native) foram descartadas por exigirem
  dependencias nativas adicionais. Referencias:
  [react-native-chart-kit](https://github.com/indiespirit/react-native-chart-kit)
  e [npm](https://www.npmjs.com/package/react-native-chart-kit).
- **Tratamento de dataset vazio:** se `resumos` estiver vazio, o grafico nao e
  renderizado, evitando quebra em runtime. (A propria tela ja exibe um estado
  vazio quando o relatorio nao tem resumos.)
- **Complementar, nao substitutivo:** o grafico soma-se a exibicao tabular
  existente; nenhuma outra tela (Mapa, Detalhe, Alertas) foi alterada.
- Textos/legendas do grafico em PT-BR ("Medias por parametro"); identificadores em
  ingles conforme a convencao do codigo.

### 6.2.5 Navegacao - `mobile/App.tsx`

Registra as quatro telas em um stack nativo do React Navigation, com titulos em
PT-BR e o tema visual do app. Referencia:
[React Navigation - Native Stack](https://reactnavigation.org/docs/native-stack-navigator).

## 6.3 Testes automatizados (`server/tests/`)

A suite pytest usa o `TestClient` do FastAPI e um banco SQLite em memoria isolado
(configurado em `server/conftest.py`), sem tocar o banco real. Cobre: `/health`;
listagem de regioes; regiao inexistente retornando 404 no schema de erro;
listagem/filtro de medicoes; agregacao do relatorio; criacao e avaliacao de
alertas; validacao invalida retornando 422; e o mapeamento do payload da
Open-Meteo a partir de um JSON fixture (`server/tests/fixtures/openmeteo_sample.json`),
com a chamada externa mockada para nao depender de rede.

A fonte real de transito tem testes proprios em `server/tests/test_transito.py`,
espelhando o padrao da Open-Meteo: mapeamento do payload da Overpass a partir de
um JSON fixture (`server/tests/fixtures/overpass_sample.json`) validando as
metricas derivadas (numero de vias, media de faixas e media de velocidade
maxima); payload invalido levantando `OverpassError`; e o endpoint
`POST /api/v1/regioes/{id}/atualizar-transito` com a rede mockada, cobrindo o
caminho de sucesso (status 200, tipo `transito`) e o de falha (HTTP 502
padronizado). Os testes **nunca** acessam a Overpass real.
