# 3. Fundamentos das tecnologias moveis escolhidas

Este capitulo apresenta os conceitos gerais das tecnologias moveis e de sistemas
distribuidos empregadas e justifica cada escolha. Toda tecnologia citada traz o
link oficial de referencia e a indicacao de onde foi aplicada no projeto.

## 3.1 Conceitos gerais de aplicacoes moveis

Aplicativos moveis podem ser construidos de tres formas principais:

- **Nativo:** escrito na linguagem/SDK de cada plataforma (Kotlin/Java para
  Android; Swift/Objective-C para iOS). Maximo desempenho e acesso a APIs do
  sistema, mas exige uma base de codigo por plataforma.
- **Hibrido/WebView:** uma pagina web empacotada como app. Simples, mas com
  limitacoes de desempenho e de acesso a recursos nativos.
- **Multiplataforma (cross-platform):** uma unica base de codigo compilada/
  interpretada para Android e iOS, com acesso a recursos nativos. E o caso do
  React Native e do Flutter.

Como a APS pede uma aplicacao demonstravel em dispositivo portatil ou simulador e
valoriza refinamento com bom custo de desenvolvimento, optou-se pela abordagem
**multiplataforma com React Native + Expo**.

## 3.2 Por que Python puro nao serve como app movel nativo

Python e a linguagem preferida do projeto (usada no back-end), mas **nao e
adequada para construir a interface de um app movel nativo**. Nem o Android nem o
iOS executam Python como runtime de UI de primeira classe; nao ha um SDK oficial
de interface movel mantido pelas plataformas para Python. Existem projetos como
Kivy e BeeWare/Toga, porem com ecossistema, componentes de UI, integracao com
lojas e suporte a bibliotecas (por exemplo, mapas) muito menos maduros do que o
de React Native ou Flutter.

Por isso, a arquitetura separa responsabilidades: **Python fica no servidor**
(onde e excelente para APIs, integracao de dados e regras de negocio) e a
**camada movel usa React Native/Expo**. Essa separacao e, ela propria, uma
caracteristica de sistema distribuido: cada camada usa a melhor ferramenta para o
seu papel e se comunica por rede.

## 3.3 Plataforma movel: React Native + Expo

- **React Native** - framework para criar apps nativos Android/iOS com
  JavaScript/TypeScript e React. Referencia oficial:
  [https://reactnative.dev](https://reactnative.dev).
  Aplicado em: todas as telas do app (`mobile/src/screens/*`), componentes de UI
  (`mobile/src/ui/*`) e no componente raiz `mobile/App.tsx`.
- **Expo (SDK 57)** - plataforma e conjunto de ferramentas sobre o React Native
  que simplifica configuracao, build e execucao (inclusive em emulador e via app
  Expo Go em dispositivo fisico). Referencia oficial:
  [https://docs.expo.dev](https://docs.expo.dev).
  Aplicado em: projeto inicializado com Expo, configuracao em `mobile/app.json`
  (nome "Monitor Ambiental Urbano"), scripts em `mobile/package.json`.

Justificativa: React Native/Expo entrega uma unica base TypeScript para Android e
iOS, ecossistema maduro (navegacao, mapas), execucao em emulador/dispositivo com
recarregamento rapido e boa integracao com APIs REST via `fetch`. Isso maximiza o
refinamento e a demonstrabilidade exigidos pela APS com esforco controlado.

### Bibliotecas moveis usadas

- **React Navigation** (`@react-navigation/native` 7.5.0 e
  `@react-navigation/native-stack` 7.20.0) - navegacao entre telas em pilha.
  Referencia: [https://reactnavigation.org](https://reactnavigation.org).
  Aplicado em: `mobile/App.tsx` (registro do stack e das rotas) e
  `mobile/src/navigation.ts` (tipos das rotas). Observacao: adotou-se React
  Navigation em vez do Expo Router para casar com o contrato do projeto.
- **react-native-maps** (1.27.2) - componente de mapa nativo (MapView e Marker).
  Referencia:
  [https://github.com/react-native-maps/react-native-maps](https://github.com/react-native-maps/react-native-maps).
  Aplicado em: `mobile/src/screens/MapaScreen.tsx`, para posicionar as regioes por
  latitude/longitude. No Android, o MapView usa o Google Maps e pode exigir uma
  **Google Maps API key** (sem ela o mapa pode aparecer em cinza); por isso a tela
  tambem oferece uma lista clicavel como alternativa. Detalhes de configuracao em
  `07_apresentacao_do_programa.md`.
- **react-native-screens** (4.26.2) e **react-native-safe-area-context** (5.7.0) -
  dependencias nativas exigidas pelo React Navigation (telas nativas e areas
  seguras). Aplicado em: `mobile/App.tsx` (envolvido por `SafeAreaProvider`).
- **react-native-chart-kit** (7.0.4) - biblioteca de graficos para React Native
  (grafico de barras, linhas, pizza etc.). Referencia:
  [https://github.com/indiespirit/react-native-chart-kit](https://github.com/indiespirit/react-native-chart-kit)
  e [https://www.npmjs.com/package/react-native-chart-kit](https://www.npmjs.com/package/react-native-chart-kit).
  Aplicado em: `mobile/src/screens/RelatoriosScreen.tsx`, onde um `BarChart`
  resume visualmente as **medias por parametro** do relatorio da regiao, acima da
  lista tabular ja existente. Depende de **react-native-svg** (15.15.4) para
  desenhar as barras. Referencia:
  [https://github.com/software-mansion/react-native-svg](https://github.com/software-mansion/react-native-svg).
  Justificativa da escolha: e compativel com o stack atual (Expo SDK 57, React
  19.2.3 e React Native 0.86.3) e sua unica dependencia nativa e o
  react-native-svg, que e um modulo suportado pelo Expo (instalado via
  `npx expo install`). As alternativas **react-native-gifted-charts** (exige
  react-native-linear-gradient nativo alem do svg) e **victory-native** (peer
  dependencies mais pesadas) foram descartadas por adicionarem dependencias
  nativas extras. Instalado com
  `npx expo install react-native-chart-kit react-native-svg` para resolver as
  versoes compativeis com o SDK.

### Alternativas de plataforma movel (registro)

- **Java/Kotlin (Android nativo)** -
  [https://developer.android.com](https://developer.android.com). Otima
  performance e acesso total ao sistema, mas exige uma base de codigo por
  plataforma e mais tempo de desenvolvimento. Java e uma opcao interessante e
  citada no proprio enunciado.
- **Flutter (Dart)** - [https://flutter.dev](https://flutter.dev).
  Multiplataforma com excelente UI; foi descartado por o restante da equipe/
  projeto ja adotar o ecossistema JavaScript/TypeScript e React.

## 3.4 Servidor de aplicacao: FastAPI (Python)

- **FastAPI** (0.115.6) - framework web ASGI para APIs REST em Python, com
  validacao automatica e documentacao interativa (Swagger em `/docs`).
  Referencia: [https://fastapi.tiangolo.com](https://fastapi.tiangolo.com).
  Aplicado em: `server/app/main.py` (aplicacao e rotas), `server/app/routers/*`
  (endpoints por dominio) e `server/app/errors.py` (tratamento de erros).
- **Uvicorn** (0.32.1) - servidor ASGI usado para executar a aplicacao FastAPI.
  Referencia: [https://www.uvicorn.org](https://www.uvicorn.org).
  Aplicado em: comando de execucao do servidor (ver capitulo 7).

Justificativa: FastAPI e um framework Python moderno, rapido de desenvolver,
com validacao via Pydantic e documentacao automatica, ideal para expor a API REST
que o app movel consome.

## 3.5 Persistencia: SQLite com caminho para PostgreSQL

- **SQLAlchemy** (2.0.36) - ORM (mapeamento objeto-relacional) que abstrai o banco.
  Referencia: [https://www.sqlalchemy.org](https://www.sqlalchemy.org).
  Aplicado em: `server/app/database.py` (engine e sessao) e `server/app/models.py`
  (entidades Regiao, Medicao, Alerta).
- **SQLite** - banco relacional em arquivo, embutido, sem servidor separado.
  Referencia: [https://www.sqlite.org](https://www.sqlite.org).
  Aplicado em: banco padrao em `server/data/app.db`, criado em runtime.
- **PostgreSQL** (caminho de evolucao) -
  [https://www.postgresql.org](https://www.postgresql.org). O codigo em
  `server/app/database.py` documenta como migrar trocando apenas a URL do engine,
  sem alterar modelos nem o cliente. Isso ilustra a escalabilidade tipica de um
  sistema distribuido (de banco local para banco cliente-servidor).

Justificativa: SQLite zera a configuracao para desenvolvimento e demonstracao,
enquanto o desenho com SQLAlchemy mantem o caminho aberto para um banco de
producao (PostgreSQL) sem reescrever a aplicacao.

## 3.6 Contrato de dados e comunicacao: REST + Pydantic + JSON

- **REST (Representational State Transfer)** - estilo arquitetural para APIs
  sobre HTTP, com recursos identificados por URLs e verbos HTTP (GET, POST).
  Referencia conceitual (MDN, HTTP):
  [https://developer.mozilla.org/pt-BR/docs/Web/HTTP](https://developer.mozilla.org/pt-BR/docs/Web/HTTP).
  Aplicado em: todos os endpoints sob o prefixo `/api/v1` em `server/app/routers/*`.
- **Pydantic** (2.10.4) - validacao e serializacao dos dados de entrada/saida da
  API (schemas). Referencia:
  [https://docs.pydantic.dev](https://docs.pydantic.dev).
  Aplicado em: `server/app/schemas.py`.
- **httpx** (0.28.1) - cliente HTTP em Python usado pelo servidor para consumir as
  fontes externas de dados. Referencia:
  [https://www.python-httpx.org](https://www.python-httpx.org).
  Aplicado em: `server/app/services/openmeteo.py` (qualidade do ar) e
  `server/app/services/overpass.py` (transito via OpenStreetMap).
- **Fetch API** - usada pelo cliente movel para chamar a API REST. Referencia:
  [https://developer.mozilla.org/pt-BR/docs/Web/API/Fetch_API](https://developer.mozilla.org/pt-BR/docs/Web/API/Fetch_API).
  Aplicado em: `mobile/src/api/client.ts`.

## 3.7 Fontes de dados ambientais reais

O sistema prioriza dados publicos, gratuitos, sem chave de API e comprovaveis.

- **Open-Meteo Air Quality API** - fonte real de qualidade do ar. Referencia:
  [https://open-meteo.com/en/docs/air-quality-api](https://open-meteo.com/en/docs/air-quality-api).
  Endpoint: `https://air-quality-api.open-meteo.com/v1/air-quality`. Sem chave.
  Aplicado em: `server/app/services/openmeteo.py`, consumido pelo endpoint
  `POST /api/v1/regioes/{id}/atualizar-ar`.
- **Overpass API do OpenStreetMap** - fonte real de infraestrutura viaria
  (transito). Referencia da API:
  [https://wiki.openstreetmap.org/wiki/Overpass_API](https://wiki.openstreetmap.org/wiki/Overpass_API).
  Endpoint: `https://overpass-api.de/api/interpreter`. Gratuita e sem chave; os
  dados do OpenStreetMap sao publicados sob a licenca **ODbL (Open Database
  License)**: [https://www.openstreetmap.org/copyright](https://www.openstreetmap.org/copyright).
  Aplicado em: `server/app/services/overpass.py`, consumido pelo endpoint
  `POST /api/v1/regioes/{id}/atualizar-transito`. A partir das vias reais ao
  redor de uma regiao (lat/lon do modelo `Regiao`), o servico deriva metricas de
  infraestrutura: numero de vias principais, media de faixas (`lanes`) e media de
  velocidade maxima (`maxspeed`). **Observacao tecnica:** a chamada HTTP a
  Overpass exige o header `User-Agent` (usamos `APS-UNIP-SD/1.0`); sem ele a API
  responde HTTP 406.
- **Alagamento** - permanece com dado simulado (academico), pois nao ha API
  publica gratuita e sem chave unificada para esse indicador.

## 3.8 Testes

- **pytest** (8.3.4) - framework de testes do back-end.
  Referencia: [https://docs.pytest.org](https://docs.pytest.org).
  Aplicado em: `server/tests/*`, usando o `TestClient` do FastAPI/Starlette.
- **TypeScript** - checagem estatica de tipos no cliente
  ([https://www.typescriptlang.org](https://www.typescriptlang.org)), validada com
  `npx tsc --noEmit`. Aplicado em: todo o codigo em `mobile/src/*` e `mobile/App.tsx`.
