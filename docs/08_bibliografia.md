# 8. Bibliografia

Todas as referências abaixo foram efetivamente utilizadas no projeto. Cada item
indica onde foi aplicado (arquivo/função). Os links foram acessados durante o
desenvolvimento (ano de 2026).

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
- **react-native-maps** - mapa nativo (MapView e Marker), enquadrado em São Paulo.
  [https://github.com/react-native-maps/react-native-maps](https://github.com/react-native-maps/react-native-maps).
  Aplicado em `mobile/src/screens/MapaScreen.tsx`.
- **react-native-chart-kit** - biblioteca de gráficos usada no relatório.
  npm: [https://www.npmjs.com/package/react-native-chart-kit](https://www.npmjs.com/package/react-native-chart-kit).
  GitHub: [https://github.com/indiespirit/react-native-chart-kit](https://github.com/indiespirit/react-native-chart-kit).
  Aplicado em `mobile/src/screens/RelatoriosScreen.tsx` (gráfico de barras
  "Médias por parâmetro").
- **react-native-svg** - renderização vetorial (SVG) exigida pelo
  react-native-chart-kit.
  [https://github.com/software-mansion/react-native-svg](https://github.com/software-mansion/react-native-svg).
  Aplicado (indiretamente) em `mobile/src/screens/RelatoriosScreen.tsx`.
- **react-native-screens** - telas nativas exigidas pela navegação.
  [https://github.com/software-mansion/react-native-screens](https://github.com/software-mansion/react-native-screens).
- **react-native-safe-area-context** - áreas seguras da tela.
  [https://github.com/th3rdwave/react-native-safe-area-context](https://github.com/th3rdwave/react-native-safe-area-context).
  Aplicado em `mobile/App.tsx`.
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

## 8.5 Documento base da disciplina

- **Documento de requisitos da APS** (`APS_7_8_CC_2025_DSD.docx`), disciplina
  Sistemas Distribuídos, 7o/8o semestre CC, Universidade Paulista (UNIP).
  Presente na raiz deste repositório.
