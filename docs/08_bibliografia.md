# 8. Bibliografia

Todas as referências abaixo foram efetivamente utilizadas no projeto. Cada item
indica onde foi aplicado (arquivo/função). Os links foram acessados durante o
desenvolvimento (ano de 2025).

## 8.1 Back-end (Python / API REST)

- **FastAPI** - framework web para a API REST.
  [https://fastapi.tiangolo.com](https://fastapi.tiangolo.com).
  Aplicado em `server/app/main.py` e `server/app/routers/*`.
  - Tratamento de erros: [https://fastapi.tiangolo.com/tutorial/handling-errors/](https://fastapi.tiangolo.com/tutorial/handling-errors/)
    (aplicado em `server/app/errors.py`).
  - CORS: [https://fastapi.tiangolo.com/tutorial/cors/](https://fastapi.tiangolo.com/tutorial/cors/)
    (aplicado em `server/app/main.py`).
- **SQLAlchemy** - ORM de persistência.
  [https://www.sqlalchemy.org](https://www.sqlalchemy.org).
  Guia rápido do ORM 2.0:
  [https://docs.sqlalchemy.org/en/20/orm/quickstart.html](https://docs.sqlalchemy.org/en/20/orm/quickstart.html).
  Aplicado em `server/app/database.py` e `server/app/models.py`.
- **Pydantic** - validação e serialização (schemas).
  [https://docs.pydantic.dev](https://docs.pydantic.dev).
  Aplicado em `server/app/schemas.py`.
- **Uvicorn** - servidor ASGI que executa a aplicação.
  [https://www.uvicorn.org](https://www.uvicorn.org).
  Aplicado no comando de execução do servidor (capítulo 7).
- **httpx** - cliente HTTP usado para consumir a SPTrans Olho Vivo e o IBGE.
  [https://www.python-httpx.org](https://www.python-httpx.org).
  Aplicado em `server/app/services/sptrans.py` e `server/app/services/ibge.py`.
- **pytest** - testes automatizados do back-end.
  [https://docs.pytest.org](https://docs.pytest.org).
  Aplicado em `server/tests/*` (rede e token sempre mockados).
- **Python** - linguagem do back-end.
  [https://www.python.org](https://www.python.org).
- **SQLite** - banco de dados padrão (arquivo).
  [https://www.sqlite.org](https://www.sqlite.org).
  Aplicado em `server/data/app.db` (gerado em runtime).
- **PostgreSQL** - banco de dados para evolução/produção (documentado como
  caminho de migração). [https://www.postgresql.org](https://www.postgresql.org).

## 8.2 Cliente móvel (React Native / Expo)

- **Expo** - plataforma e ferramentas do app móvel.
  [https://docs.expo.dev](https://docs.expo.dev).
  Aplicado no projeto `mobile/` e em `mobile/app.json`.
  - Variáveis de ambiente:
    [https://docs.expo.dev/guides/environment-variables/](https://docs.expo.dev/guides/environment-variables/)
    (uso de `EXPO_PUBLIC_API_BASE_URL` em `mobile/src/api/client.ts`).
- **React Native** - framework de UI multiplataforma.
  [https://reactnative.dev](https://reactnative.dev).
  Aplicado em todas as telas e componentes de `mobile/src/*`.
  - FlatList: [https://reactnative.dev/docs/flatlist](https://reactnative.dev/docs/flatlist)
  - SectionList: [https://reactnative.dev/docs/sectionlist](https://reactnative.dev/docs/sectionlist)
  - useWindowDimensions: [https://reactnative.dev/docs/usewindowdimensions](https://reactnative.dev/docs/usewindowdimensions)
- **React** - biblioteca base dos componentes.
  [https://react.dev](https://react.dev).
- **React Navigation** - navegação entre telas (não Expo Router).
  [https://reactnavigation.org](https://reactnavigation.org).
  Aplicado em `mobile/App.tsx` e `mobile/src/navigation.ts`.
  - Native Stack Navigator:
    [https://reactnavigation.org/docs/native-stack-navigator](https://reactnavigation.org/docs/native-stack-navigator)
- **FlatList (React Native)** - lista performática usada na tela inicial.
  [https://reactnative.dev/docs/flatlist](https://reactnative.dev/docs/flatlist).
  Aplicado em `mobile/src/screens/MapaScreen.tsx`.
- **Gráfico de barras com `View`** - o relatório ("Médias por parâmetro") é
  desenhado com barras horizontais proporcionais feitas de `View` (layout flex),
  sem biblioteca de gráficos, para manter os rótulos legíveis. Documentação de
  layout do `View`: [https://reactnative.dev/docs/view](https://reactnative.dev/docs/view).
  Aplicado em `mobile/src/screens/RelatoriosScreen.tsx`.
- **react-native-screens** - telas nativas exigidas pela navegação.
  [https://github.com/software-mansion/react-native-screens](https://github.com/software-mansion/react-native-screens).
- **react-native-safe-area-context** - áreas seguras da tela.
  [https://github.com/th3rdwave/react-native-safe-area-context](https://github.com/th3rdwave/react-native-safe-area-context).
  Aplicado em `mobile/App.tsx`.
- **react-native-webview** - WebView que hospeda o mapa (Leaflet + OpenStreetMap).
  [https://docs.expo.dev/versions/v58.0.0/sdk/webview/](https://docs.expo.dev/versions/v58.0.0/sdk/webview/).
  Aplicado em `mobile/src/screens/MapaVisualScreen.tsx`.
- **@react-native-async-storage/async-storage** - armazenamento local chave-valor
  no aparelho.
  [https://react-native-async-storage.github.io/async-storage/](https://react-native-async-storage.github.io/async-storage/).
  Aplicado em `mobile/src/ui/favoritos.ts` (favoritos de linhas) e
  `mobile/src/ui/consentimento.ts` (registro de consentimento LGPD).
- **expo-location** - acesso à localização (GPS) para o "Você está aqui".
  [https://docs.expo.dev/versions/v58.0.0/sdk/location/](https://docs.expo.dev/versions/v58.0.0/sdk/location/).
  Aplicado em `mobile/src/ui/localizacao.ts` e
  `mobile/src/screens/MapaVisualScreen.tsx`, condicionado ao consentimento do
  usuário (a coordenada nunca é enviada ao back-end).
- **Leaflet** - biblioteca JavaScript de mapas carregada via CDN (licença
  BSD-2-Clause). [https://leafletjs.com](https://leafletjs.com).
  Aplicado no HTML embutido do mapa em
  `mobile/src/screens/MapaVisualScreen.tsx`.
- **TypeScript** - linguagem/tipagem do cliente.
  [https://www.typescriptlang.org](https://www.typescriptlang.org).
- **MDN - Fetch API** - API de requisições HTTP usada no cliente.
  [https://developer.mozilla.org/pt-BR/docs/Web/API/Fetch_API](https://developer.mozilla.org/pt-BR/docs/Web/API/Fetch_API).
  Aplicado em `mobile/src/api/client.ts`.
- **MDN - AbortController** - cancelamento/timeout de requisição.
  [https://developer.mozilla.org/pt-BR/docs/Web/API/AbortController](https://developer.mozilla.org/pt-BR/docs/Web/API/AbortController).
  Aplicado em `mobile/src/api/client.ts`.

## 8.3 Fontes de dados oficiais de São Paulo

### 8.3.1 Transporte público (fonte OFICIAL de SP)

- **SPTrans Olho Vivo** - API oficial de monitoramento da frota de ônibus da
  capital, operada pela SPTrans (São Paulo Transporte S/A, da Prefeitura de SP).
  Portal do desenvolvedor (cadastro e token gratuitos):
  [https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/).
  Endpoint base usado: `https://api.olhovivo.sptrans.com.br/v2.1`
  (`/Login/Autenticar`, `/Posicao`). Aplicado em `server/app/services/sptrans.py`,
  consumido por `POST /api/v1/regioes/{id}/atualizar-transporte`. Token lido de
  `SPTRANS_TOKEN` (nunca hardcode).
- **GTFS da SPTrans** - dados estáticos (sem token) disponibilizados na mesma seção
  de desenvolvedores do portal da SPTrans
  ([https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/)),
  citados como base/espírito do conjunto de linhas de EXEMPLO do fallback em
  `server/app/services/sptrans.py` (`LINHAS_EXEMPLO`).

### 8.3.2 Base geográfica oficial e dados abertos da PMSP

- **IBGE - API de Localidades** - fonte OFICIAL e nacional dos municípios
  brasileiros (sem chave). Documentação:
  [https://servicodados.ibge.gov.br/api/docs/localidades](https://servicodados.ibge.gov.br/api/docs/localidades).
  Endpoint usado (UF 35 = São Paulo):
  [https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios](https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios).
  Base de referência geral:
  [https://servicodados.ibge.gov.br/api/v1/localidades](https://servicodados.ibge.gov.br/api/v1/localidades).
  Aplicado em `server/app/services/ibge.py`, consumido por
  `GET /api/v1/localidades/sp`.
- **Prefeitura de São Paulo - Dados Abertos (CKAN) / GeoSampa** - origem das
  coordenadas dos distritos da capital usadas no seed (não inventadas).
  Portal de dados abertos: [http://dados.prefeitura.sp.gov.br/](http://dados.prefeitura.sp.gov.br/).
  GeoSampa: [https://geosampa.prefeitura.sp.gov.br/](https://geosampa.prefeitura.sp.gov.br/).
  Referenciado na docstring de `server/app/seed.py` (`REGIOES_SEED`).

### 8.3.3 Cartografia do mapa (OpenStreetMap)

- **OpenStreetMap** - tiles e dados cartográficos do mapa visual (© colaboradores
  do OpenStreetMap). Os dados estão sob a licença **ODbL**, que exige atribuição.
  Copyright e licença: [https://www.openstreetmap.org/copyright](https://www.openstreetmap.org/copyright).
  ODbL: [https://opendatacommons.org/licenses/odbl/](https://opendatacommons.org/licenses/odbl/).
  Aplicado em `mobile/src/screens/MapaVisualScreen.tsx` (um único tile fixo,
  `tile.openstreetmap.org`, com a atribuição exibida no mapa). Detalhes da
  auditoria de licenças em `11_licencas_e_atribuicoes.md`.

## 8.4 Conceitos e plataformas de referência

- **MDN - HTTP** - fundamentos do protocolo usado na comunicação REST.
  [https://developer.mozilla.org/pt-BR/docs/Web/HTTP](https://developer.mozilla.org/pt-BR/docs/Web/HTTP).
- **Android Developers - Emulator networking** - explica o alias `10.0.2.2`.
  [https://developer.android.com/studio/run/emulator-networking](https://developer.android.com/studio/run/emulator-networking).
- **Android Studio** - IDE e emulador Android.
  [https://developer.android.com/studio](https://developer.android.com/studio).
- **Flutter** - alternativa multiplataforma considerada (não adotada).
  [https://flutter.dev](https://flutter.dev).
- **Java (Android nativo)** - alternativa nativa considerada (não adotada).
  [https://developer.android.com](https://developer.android.com).
- **TANENBAUM, A. S.; VAN STEEN, M.** *Distributed Systems: Principles and
  Paradigms.* Referência conceitual sobre sistemas distribuídos.
  Material do autor disponível em:
  [https://www.distributed-systems.net](https://www.distributed-systems.net).

## 8.5 Conformidade e proteção de dados

- **Lei Geral de Proteção de Dados Pessoais (LGPD) - Lei nº 13.709/2018** - base
  legal da conformidade do aplicativo (consentimento, direitos do titular,
  retenção e responsabilização). Texto oficial:
  [http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).
  Aplicada na Política de Privacidade (`12_politica_de_privacidade.md`), nos
  Termos de Uso (`13_termos_de_uso.md`) e no fluxo de consentimento do app
  (`mobile/src/ui/consentimento.ts`,
  `mobile/src/screens/ConsentimentoScreen.tsx` e
  `mobile/src/screens/PrivacidadeScreen.tsx`).

## 8.6 Documento base da disciplina

- **Documento de requisitos da APS** (`APS_7_8_CC_2025_DSD.docx`), disciplina
  Sistemas Distribuídos, 7o/8o semestre CC, Universidade Paulista (UNIP).
  Presente na raiz deste repositório.
