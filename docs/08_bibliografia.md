# 8. Bibliografia

Todas as referencias abaixo foram efetivamente utilizadas no projeto. Cada item
indica onde foi aplicado. Os links foram acessados durante o desenvolvimento (ano
de 2026).

## 8.1 Back-end (Python / API REST)

- **FastAPI** - framework web para a API REST.
  [https://fastapi.tiangolo.com](https://fastapi.tiangolo.com).
  Aplicado em `server/app/main.py` e `server/app/routers/*`.
  - Tratamento de erros: [https://fastapi.tiangolo.com/tutorial/handling-errors/](https://fastapi.tiangolo.com/tutorial/handling-errors/)
    (aplicado em `server/app/errors.py`).
  - CORS: [https://fastapi.tiangolo.com/tutorial/cors/](https://fastapi.tiangolo.com/tutorial/cors/)
    (aplicado em `server/app/main.py`).
- **SQLAlchemy** - ORM de persistencia.
  [https://www.sqlalchemy.org](https://www.sqlalchemy.org).
  Guia rapido do ORM 2.0:
  [https://docs.sqlalchemy.org/en/20/orm/quickstart.html](https://docs.sqlalchemy.org/en/20/orm/quickstart.html).
  Aplicado em `server/app/database.py` e `server/app/models.py`.
- **Pydantic** - validacao e serializacao (schemas).
  [https://docs.pydantic.dev](https://docs.pydantic.dev).
  Aplicado em `server/app/schemas.py`.
- **Uvicorn** - servidor ASGI que executa a aplicacao.
  [https://www.uvicorn.org](https://www.uvicorn.org).
  Aplicado no comando de execucao do servidor (capitulo 7).
- **httpx** - cliente HTTP usado para consumir a Open-Meteo.
  [https://www.python-httpx.org](https://www.python-httpx.org).
  Aplicado em `server/app/services/openmeteo.py`.
- **pytest** - testes automatizados do back-end.
  [https://docs.pytest.org](https://docs.pytest.org).
  Aplicado em `server/tests/*`.
- **Python** - linguagem do back-end.
  [https://www.python.org](https://www.python.org).
- **SQLite** - banco de dados padrao (arquivo).
  [https://www.sqlite.org](https://www.sqlite.org).
  Aplicado em `server/data/app.db` (gerado em runtime).
- **PostgreSQL** - banco de dados para evolucao/producao (documentado como
  caminho de migracao). [https://www.postgresql.org](https://www.postgresql.org).

## 8.2 Cliente movel (React Native / Expo)

- **Expo** - plataforma e ferramentas do app movel.
  [https://docs.expo.dev](https://docs.expo.dev).
  Aplicado no projeto `mobile/` e em `mobile/app.json`.
  - Variaveis de ambiente:
    [https://docs.expo.dev/guides/environment-variables/](https://docs.expo.dev/guides/environment-variables/)
    (uso de `EXPO_PUBLIC_API_BASE_URL` em `mobile/src/api/client.ts`).
- **React Native** - framework de UI multiplataforma.
  [https://reactnative.dev](https://reactnative.dev).
  Aplicado em todas as telas e componentes de `mobile/src/*`.
  - FlatList: [https://reactnative.dev/docs/flatlist](https://reactnative.dev/docs/flatlist)
  - SectionList: [https://reactnative.dev/docs/sectionlist](https://reactnative.dev/docs/sectionlist)
  - TextInput: [https://reactnative.dev/docs/textinput](https://reactnative.dev/docs/textinput)
- **React Navigation** - navegacao entre telas.
  [https://reactnavigation.org](https://reactnavigation.org).
  Aplicado em `mobile/App.tsx` e `mobile/src/navigation.ts`.
  - Native Stack Navigator:
    [https://reactnavigation.org/docs/native-stack-navigator](https://reactnavigation.org/docs/native-stack-navigator)
- **react-native-maps** - mapa nativo (MapView e Marker).
  [https://github.com/react-native-maps/react-native-maps](https://github.com/react-native-maps/react-native-maps).
  Aplicado em `mobile/src/screens/MapaScreen.tsx`.
- **react-native-screens** - telas nativas exigidas pela navegacao.
  [https://github.com/software-mansion/react-native-screens](https://github.com/software-mansion/react-native-screens).
- **react-native-safe-area-context** - areas seguras da tela.
  [https://github.com/th3rdwave/react-native-safe-area-context](https://github.com/th3rdwave/react-native-safe-area-context).
  Aplicado em `mobile/App.tsx`.
- **TypeScript** - linguagem/tipagem do cliente.
  [https://www.typescriptlang.org](https://www.typescriptlang.org).
- **MDN - Fetch API** - API de requisicoes HTTP usada no cliente.
  [https://developer.mozilla.org/pt-BR/docs/Web/API/Fetch_API](https://developer.mozilla.org/pt-BR/docs/Web/API/Fetch_API).
  Aplicado em `mobile/src/api/client.ts`.
- **MDN - AbortController** - cancelamento/timeout de requisicao.
  [https://developer.mozilla.org/pt-BR/docs/Web/API/AbortController](https://developer.mozilla.org/pt-BR/docs/Web/API/AbortController).

## 8.3 Fontes de dados ambientais

- **Open-Meteo Air Quality API** - fonte real de qualidade do ar (sem chave).
  Documentacao:
  [https://open-meteo.com/en/docs/air-quality-api](https://open-meteo.com/en/docs/air-quality-api).
  Endpoint usado:
  `https://air-quality-api.open-meteo.com/v1/air-quality`.
  Aplicado em `server/app/services/openmeteo.py`.
- **OpenAQ** - agregador de dados oficiais de qualidade do ar.
  [https://openaq.org](https://openaq.org).
  Registrado como alternativa relevante; **nao** usado como fonte primaria porque
  a versao atual da API exige chave de acesso (X-API-Key).
- **Copernicus Atmosphere Monitoring Service (CAMS)** - base dos modelos de
  qualidade do ar servidos pela Open-Meteo.
  [https://atmosphere.copernicus.eu](https://atmosphere.copernicus.eu).

## 8.4 Conceitos e plataformas de referencia

- **MDN - HTTP** - fundamentos do protocolo usado na comunicacao REST.
  [https://developer.mozilla.org/pt-BR/docs/Web/HTTP](https://developer.mozilla.org/pt-BR/docs/Web/HTTP).
- **Android Developers - Emulator networking** - explica o alias `10.0.2.2`.
  [https://developer.android.com/studio/run/emulator-networking](https://developer.android.com/studio/run/emulator-networking).
- **Android Studio** - IDE e emulador Android.
  [https://developer.android.com/studio](https://developer.android.com/studio).
- **Flutter** - alternativa multiplataforma considerada (nao adotada).
  [https://flutter.dev](https://flutter.dev).
- **Java (Android nativo)** - alternativa nativa considerada (nao adotada).
  [https://developer.android.com](https://developer.android.com).
- **TANENBAUM, A. S.; VAN STEEN, M.** *Distributed Systems: Principles and
  Paradigms.* Referencia conceitual sobre sistemas distribuidos.
  Material do autor disponivel em:
  [https://www.distributed-systems.net](https://www.distributed-systems.net).

## 8.5 Documento base da disciplina

- **Documento de requisitos da APS** (`APS_7_8_CC_2025_DSD.docx`), disciplina
  Sistemas Distribuidos, 7o/8o semestre CC, Universidade Paulista (UNIP).
  Presente na raiz deste repositorio.
