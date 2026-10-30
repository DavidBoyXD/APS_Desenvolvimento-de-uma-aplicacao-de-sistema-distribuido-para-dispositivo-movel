# 3. Fundamentos das tecnologias móveis escolhidas

Este capítulo apresenta os conceitos gerais das tecnologias móveis e de sistemas
distribuídos empregadas e justifica cada escolha. Toda tecnologia e fonte citada
traz o link oficial de referência e a indicação de onde foi aplicada no projeto.

## 3.1 Conceitos gerais de aplicações móveis

Aplicativos móveis podem ser construídos de três formas principais:

- **Nativo:** escrito na linguagem/SDK de cada plataforma (Kotlin/Java para
  Android; Swift/Objective-C para iOS). Máximo desempenho e acesso a APIs do
  sistema, mas exige uma base de código por plataforma.
- **Híbrido/WebView:** uma página web empacotada como app. Simples, mas com
  limitações de desempenho e de acesso a recursos nativos.
- **Multiplataforma (cross-platform):** uma única base de código compilada/
  interpretada para Android e iOS, com acesso a recursos nativos. É o caso do
  React Native e do Flutter.

Como a APS pede uma aplicação demonstrável em dispositivo portátil ou simulador e
valoriza refinamento com bom custo de desenvolvimento, optou-se pela abordagem
**multiplataforma com React Native + Expo**.

## 3.2 Por que Python puro não serve como app móvel nativo

Python é a linguagem preferida do projeto (usada no back-end), mas **não é
adequada para construir a interface de um app móvel nativo**. Nem o Android nem o
iOS executam Python como runtime de UI de primeira classe; não há um SDK oficial
de interface móvel mantido pelas plataformas para Python. Existem projetos como
Kivy e BeeWare/Toga, porém com ecossistema, componentes de UI, integração com
lojas e suporte a bibliotecas (por exemplo, mapas) muito menos maduros do que o
de React Native ou Flutter.

Por isso, a arquitetura separa responsabilidades: **Python fica no servidor**
(onde é excelente para APIs, integração de dados e regras de negócio) e a
**camada móvel usa React Native/Expo**. Essa separação é, ela própria, uma
característica de sistema distribuído: cada camada usa a melhor ferramenta para o
seu papel e se comunica por rede.

## 3.3 Plataforma móvel: React Native + Expo

- **React Native** - framework para criar apps nativos Android/iOS com
  JavaScript/TypeScript e React. Referência oficial:
  [https://reactnative.dev](https://reactnative.dev).
  Aplicado em: todas as telas do app (`mobile/src/screens/*`), componentes de UI
  (`mobile/src/ui/*`) e no componente raiz `mobile/App.tsx`.
- **Expo (SDK 57)** - plataforma e conjunto de ferramentas sobre o React Native
  que simplifica configuração, build e execução (inclusive em emulador e via app
  Expo Go em dispositivo físico). Referência oficial:
  [https://docs.expo.dev](https://docs.expo.dev).
  Aplicado em: projeto inicializado com Expo, configuração em `mobile/app.json`
  (nome "Monitor Ambiental Urbano"), scripts em `mobile/package.json`.

Justificativa: React Native/Expo entrega uma única base TypeScript para Android e
iOS, ecossistema maduro (navegação, listas, gráficos), execução em
emulador/dispositivo com recarregamento rápido e boa integração com APIs REST via
`fetch`. Isso maximiza o refinamento e a demonstrabilidade exigidos pela APS com
esforço controlado.

### Bibliotecas móveis usadas

- **React Navigation** (`@react-navigation/native` 7.5.0 e
  `@react-navigation/native-stack` 7.20.0) - navegação entre telas em pilha.
  Referência: [https://reactnavigation.org](https://reactnavigation.org).
  Aplicado em: `mobile/App.tsx` (registro do stack e das rotas) e
  `mobile/src/navigation.ts` (tipos das rotas). Observação: adotou-se React
  Navigation (e **não** o Expo Router) para casar com o contrato do projeto; o
  código real importa de `@react-navigation/native-stack`.
- **FlatList** (React Native) - lista performática usada na tela inicial.
  Referência: [https://reactnative.dev/docs/flatlist](https://reactnative.dev/docs/flatlist).
  Aplicado em: `mobile/src/screens/MapaScreen.tsx`, para exibir as regiões de São
  Paulo em uma lista clicável (cada item mostra nome, cidade/UF e as coordenadas e
  abre o Detalhe ao ser tocado). A tela inicial não depende de nenhum módulo nativo
  de mapa nem de uma Google Maps API key, garantindo que o app sempre abra.
- **react-native-screens** (4.26.2) e **react-native-safe-area-context** (5.7.0) -
  dependências nativas exigidas pelo React Navigation (telas nativas e áreas
  seguras). Aplicado em: `mobile/App.tsx` (envolvido por `SafeAreaProvider`).
- **react-native-chart-kit** (7.0.4) - biblioteca de gráficos para React Native
  (gráfico de barras, linhas, pizza etc.). Referência:
  [https://github.com/indiespirit/react-native-chart-kit](https://github.com/indiespirit/react-native-chart-kit)
  e [https://www.npmjs.com/package/react-native-chart-kit](https://www.npmjs.com/package/react-native-chart-kit).
  Aplicado em: `mobile/src/screens/RelatoriosScreen.tsx`, onde um `BarChart`
  resume visualmente as **médias por parâmetro** do relatório da região, acima da
  lista tabular. Depende de **react-native-svg** (15.15.4) para desenhar as barras:
  [https://github.com/software-mansion/react-native-svg](https://github.com/software-mansion/react-native-svg).
  Justificativa da escolha: é compatível com o stack atual (Expo SDK 57, React
  19.2.3 e React Native 0.86.3) e sua única dependência nativa é o
  react-native-svg, módulo suportado pelo Expo (instalado via `npx expo install`).
  As alternativas **react-native-gifted-charts** (exige react-native-linear-gradient
  nativo) e **victory-native** (peer dependencies mais pesadas) foram descartadas
  por adicionarem dependências nativas extras. Instalado com
  `npx expo install react-native-chart-kit react-native-svg`.

### Alternativas de plataforma móvel (registro)

- **Java/Kotlin (Android nativo)** -
  [https://developer.android.com](https://developer.android.com). Ótima
  performance e acesso total ao sistema, mas exige uma base de código por
  plataforma e mais tempo de desenvolvimento.
- **Flutter (Dart)** - [https://flutter.dev](https://flutter.dev).
  Multiplataforma com excelente UI; foi descartado por o restante do projeto já
  adotar o ecossistema JavaScript/TypeScript e React.

## 3.4 Servidor de aplicação: FastAPI (Python)

- **FastAPI** (0.115.6) - framework web ASGI para APIs REST em Python, com
  validação automática e documentação interativa (Swagger em `/docs`).
  Referência: [https://fastapi.tiangolo.com](https://fastapi.tiangolo.com).
  Aplicado em: `server/app/main.py` (aplicação, título "API Transporte Publico SP
  - APS SD", rotas),
  `server/app/routers/*` (endpoints por domínio) e `server/app/errors.py`
  (tratamento de erros).
- **Uvicorn** (0.32.1) - servidor ASGI usado para executar a aplicação FastAPI.
  Referência: [https://www.uvicorn.org](https://www.uvicorn.org).
  Aplicado em: comando de execução do servidor (ver capítulo 7).

Justificativa: FastAPI é um framework Python moderno, rápido de desenvolver,
com validação via Pydantic e documentação automática, ideal para expor a API REST
que o app móvel consome e para orquestrar as chamadas às fontes externas.

## 3.5 Persistência: SQLite com caminho para PostgreSQL

- **SQLAlchemy** (2.0.36) - ORM (mapeamento objeto-relacional) que abstrai o banco.
  Referência: [https://www.sqlalchemy.org](https://www.sqlalchemy.org).
  Aplicado em: `server/app/database.py` (engine e sessão) e `server/app/models.py`
  (entidades Regiao, Medicao, Alerta).
- **SQLite** - banco relacional em arquivo, embutido, sem servidor separado.
  Referência: [https://www.sqlite.org](https://www.sqlite.org).
  Aplicado em: banco padrão em `server/data/app.db`, criado em runtime.
- **PostgreSQL** (caminho de evolução) -
  [https://www.postgresql.org](https://www.postgresql.org). O código em
  `server/app/database.py` documenta como migrar trocando apenas a URL do engine,
  sem alterar modelos nem o cliente. Isso ilustra a escalabilidade típica de um
  sistema distribuído (de banco local para banco cliente-servidor).

Justificativa: SQLite zera a configuração para desenvolvimento e demonstração,
enquanto o desenho com SQLAlchemy mantém o caminho aberto para um banco de
produção (PostgreSQL) sem reescrever a aplicação.

## 3.6 Contrato de dados e comunicação: REST + Pydantic + JSON

- **REST (Representational State Transfer)** - estilo arquitetural para APIs
  sobre HTTP, com recursos identificados por URLs e verbos HTTP (GET, POST).
  Referência conceitual (MDN, HTTP):
  [https://developer.mozilla.org/pt-BR/docs/Web/HTTP](https://developer.mozilla.org/pt-BR/docs/Web/HTTP).
  Aplicado em: todos os endpoints sob o prefixo `/api/v1` em `server/app/routers/*`.
- **Pydantic** (2.10.4) - validação e serialização dos dados de entrada/saída da
  API (schemas). Referência:
  [https://docs.pydantic.dev](https://docs.pydantic.dev).
  Aplicado em: `server/app/schemas.py`.
- **httpx** (0.28.1) - cliente HTTP em Python usado pelo servidor para consumir as
  fontes externas de dados. Referência:
  [https://www.python-httpx.org](https://www.python-httpx.org).
  Aplicado em: `server/app/services/sptrans.py` (transporte público, inclusive a
  sessão autenticada por cookie) e `server/app/services/ibge.py` (base
  geográfica).
- **Fetch API** - usada pelo cliente móvel para chamar a API REST. Referência:
  [https://developer.mozilla.org/pt-BR/docs/Web/API/Fetch_API](https://developer.mozilla.org/pt-BR/docs/Web/API/Fetch_API).
  Aplicado em: `mobile/src/api/client.ts`.

## 3.7 Fontes de dados oficiais de São Paulo

O sistema usa fontes OFICIAIS do território nacional/paulistano, de onde os valores
são efetivamente consumidos em runtime.

### 3.7.1 Transporte público - SPTrans Olho Vivo (fonte OFICIAL de SP)

- **SPTrans Olho Vivo** - API oficial de monitoramento da frota de ônibus da
  capital, operada pela SPTrans (São Paulo Transporte S/A, da Prefeitura de São
  Paulo). Portal do desenvolvedor:
  [https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/).
  Endpoint base: `https://api.olhovivo.sptrans.com.br/v2.1`.
  Aplicado em: `server/app/services/sptrans.py`, consumido pelo endpoint
  `POST /api/v1/regioes/{id}/atualizar-transporte`.
- **Autenticação com token gratuito:** a API Olho Vivo exige um **token** de
  acesso. O fluxo é um `POST /Login/Autenticar?token=SEU_TOKEN` que estabelece uma
  sessão (cookie `apManager`), reutilizada nas chamadas seguintes (ex.:
  `GET /Posicao`). O código usa o MESMO `httpx.Client` para preservar o cookie. O
  token é lido exclusivamente da variável de ambiente `SPTRANS_TOKEN` (nunca há
  token literal no repositório). O passo a passo de cadastro está em
  `07_apresentacao_do_programa.md`.
- **Comportamento com e sem token:** com token, o serviço deriva métricas REAIS
  (tempo real) a partir do `GET /Posicao` (`linhas_monitoradas` e
  `veiculos_em_operacao`); sem token, usa um **fallback funcional** com um pequeno
  conjunto de linhas de SP de EXEMPLO (no espírito dos dados GTFS estáticos da
  própria SPTrans), claramente ROTULADO como NÃO tempo real (parâmetro
  `linhas_exemplo`, e o campo `fonte` deixa isso explícito). Assim o app funciona
  de ponta a ponta mesmo sem o token.
- **GTFS da SPTrans:** a mesma seção de desenvolvedores do portal da SPTrans
  também disponibiliza os dados em formato **GTFS estático** (sem token), citados
  como base/espírito do conjunto de linhas de exemplo do fallback.

### 3.7.2 Base geográfica - IBGE (fonte OFICIAL, nacional)

- **IBGE - API de Localidades** - fonte OFICIAL, nacional e sem chave, dos nomes e
  códigos dos municípios brasileiros. Referência:
  [https://servicodados.ibge.gov.br/api/docs/localidades](https://servicodados.ibge.gov.br/api/docs/localidades).
  Endpoint usado:
  `https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios`
  (código 35 = UF São Paulo). Aplicado em: `server/app/services/ibge.py`,
  consumido pelo endpoint `GET /api/v1/localidades/sp`. Usado para validar/listar
  os municípios de SP. O IBGE não fornece latitude/longitude de distritos neste
  endpoint; por isso as coordenadas das regiões do seed vêm de fontes oficiais da
  Prefeitura de São Paulo (GeoSampa/PMSP,
  [http://dados.prefeitura.sp.gov.br/](http://dados.prefeitura.sp.gov.br/)), nunca
  inventadas.

## 3.8 Testes

- **pytest** (8.3.4) - framework de testes do back-end.
  Referência: [https://docs.pytest.org](https://docs.pytest.org).
  Aplicado em: `server/tests/*`, usando o `TestClient` do FastAPI/Starlette. A
  rede e o token são SEMPRE mockados nos testes (nenhum teste toca a SPTrans ou o
  IBGE reais, nem usa token real); ver `06_relatorio_de_codigo.md`.
- **TypeScript** - checagem estática de tipos no cliente
  ([https://www.typescriptlang.org](https://www.typescriptlang.org)), validada com
  `npx tsc --noEmit`. Aplicado em: todo o código em `mobile/src/*` e `mobile/App.tsx`.
