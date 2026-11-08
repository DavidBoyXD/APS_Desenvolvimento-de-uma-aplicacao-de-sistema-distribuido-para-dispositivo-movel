# Licenças e Atribuições

**Aplicativo:** Monitoramento de transporte público em SP
**Versão deste documento:** 1.0
**Data:** 10 de novembro de 2026
**Responsável / contato:** David Andrew — daviddeziderio07@gmail.com

> **Aviso acadêmico:** este é um projeto **ACADÊMICO** desenvolvido para a disciplina de
> Sistemas Distribuídos no âmbito das Atividades Práticas Supervisionadas (APS) da
> Universidade Paulista (UNIP). **Não** é um produto comercial nem um serviço oficial da
> SPTrans, da Prefeitura de São Paulo ou do IBGE.
>
> **Este documento não constitui aconselhamento jurídico.** Ele registra, de forma honesta, a
> auditoria das licenças do código, dos ativos (imagem e fonte) e das bibliotecas/serviços de
> terceiros usados pelo aplicativo, e confirma que as atribuições obrigatórias estão presentes.

---

## 1. Resumo da auditoria

- **Código-fonte do projeto:** licenciado sob **MIT** (ver `LICENSE` na raiz do repositório).
- **Ícone do aplicativo:** ativo **original** do projeto (tema ônibus + olho em verde
  `#0B6E4F`), sem logotipos ou marcas de terceiros. Coberto pela licença do projeto.
- **Fontes tipográficas:** o aplicativo **não embarca nenhuma fonte**; usa a **fonte padrão do
  sistema** de cada aparelho. Portanto **não há obrigação de licença de fonte de terceiros**.
- **Dados cartográficos (OpenStreetMap):** sob **ODbL**. Exigem atribuição e ela **está
  presente** no mapa ("© colaboradores do OpenStreetMap").
- **Biblioteca de mapa (Leaflet):** sob **BSD-2-Clause** (carregada via CDN unpkg).
- **Bibliotecas de software (mobile e server):** todas com licenças **permissivas** (MIT / BSD),
  compatíveis com o uso acadêmico e com a redistribuição do código.

---

## 2. Ativos do projeto (originais)

| Ativo | Arquivo(s) | Origem | Licença | Observação |
| --- | --- | --- | --- | --- |
| Ícone do app | `mobile/assets/icon.png`, `mobile/assets/android-icon-background.png`, `mobile/assets/android-icon-foreground.png`, `mobile/assets/android-icon-monochrome.png`, `mobile/assets/splash-icon.png`, `mobile/assets/favicon.png` | Criado para o projeto (tema ônibus + olho, verde `#0B6E4F`) | MIT (licença do projeto) | **Original**, sem marcas/logotipos de terceiros. Configurado em `mobile/app.json` (ícone, ícone adaptativo Android e favicon web). |
| Tipografia | — (nenhum arquivo) | Fonte padrão do sistema | n/a | O app **não** usa `expo-font`, `useFonts`, `loadAsync` nem arquivos `.ttf`/`.otf`. Verificado por busca no código e na pasta `mobile/assets` (só há imagens `.png`). |

### 2.1 Como a ausência de fonte embarcada foi verificada

- Busca por `expo-font`, `useFonts`, `loadAsync`, `.ttf`, `.otf` em `mobile/` (fora de
  `node_modules`): **nenhuma ocorrência**.
- Listagem de `mobile/assets/`: apenas imagens `.png` (ícones e splash); **nenhum** arquivo de
  fonte.

Conclusão: o app depende da fonte do sistema operacional de cada dispositivo, o que **dispensa**
licença de fonte de terceiros.

---

## 3. Serviços e dados de terceiros

| Serviço / dado | Uso no app | Licença / termos | Atribuição obrigatória | Situação |
| --- | --- | --- | --- | --- |
| **OpenStreetMap (tiles + dados)** | Camada cartográfica do mapa (`tile.openstreetmap.org`) | Dados sob **ODbL**; uso dos tiles sujeito à *Tile Usage Policy* da OSMF | **Sim:** "© OpenStreetMap contributors" (equivalente PT-BR: "© colaboradores do OpenStreetMap") | **Atendida** — ver seção 5 |
| **Leaflet** | Biblioteca JS de mapa dentro do WebView (CDN `unpkg.com/leaflet@1.9.4`) | **BSD-2-Clause** | Não obrigatória (recomenda-se manter o aviso de copyright) | OK |
| **SPTrans — API Olho Vivo** | Fonte dos dados de linhas, paradas e posição dos ônibus (consumida pelo back-end) | Termos da SPTrans; exige **token** de desenvolvedor (variável `SPTRANS_TOKEN`, não versionada) | Crédito à fonte dos dados | Creditada nesta doc e nos documentos do projeto |
| **IBGE** | Dados de referência territorial/regiões | Dados públicos do IBGE | Crédito à fonte dos dados | Creditada nesta doc e nos documentos do projeto |

> Observação: o aplicativo **não** usa Google Maps, não exige chave de API de mapa e não embute
> imagens de satélite. O mapa usa um **único tile fixo** do OpenStreetMap padrão.

---

## 4. Bibliotecas de software

As licenças do mobile foram conferidas no campo `license` de
`mobile/node_modules/<pacote>/package.json` quando o pacote está instalado. Os pacotes com código
nativo isolados atrás de wrappers protegidos (`react-native-webview`,
`@react-native-async-storage/async-storage`, `expo-location`) **não estão em `node_modules`** no
ambiente de desenvolvimento do repositório (são instalados na máquina do desenvolvedor com
`npx expo install`); a licença listada é a licença **pública conhecida** de cada um (todas MIT).

### 4.1 Mobile (Expo / React Native) — ver `mobile/package.json`

| Pacote | Origem | Licença | Observação |
| --- | --- | --- | --- |
| `expo` | Expo | MIT | SDK e runtime do app. |
| `react` | Meta | MIT | Biblioteca de UI. |
| `react-native` | Meta | MIT | Framework mobile. |
| `@react-navigation/native` | React Navigation | MIT | Navegação (o projeto usa React Navigation, **não** Expo Router). |
| `@react-navigation/native-stack` | React Navigation | MIT | Pilha de navegação nativa. |
| `react-native-webview` | React Native Community | MIT | WebView que hospeda o mapa (Leaflet). *Pacote nativo, não presente em `node_modules` no repo.* |
| `@react-native-async-storage/async-storage` | React Native Async Storage | MIT | Armazenamento local (favoritos, consentimento). *Pacote nativo, não presente em `node_modules` no repo.* |
| `react-native-safe-area-context` | Software Mansion | MIT | Áreas seguras. |
| `react-native-screens` | Software Mansion | MIT | Telas nativas de navegação. |
| `react-native-svg` | Software Mansion | MIT | Renderização SVG. |
| `react-native-chart-kit` | Comunidade | MIT | Gráficos (dependência declarada). |
| `expo-status-bar` | Expo | MIT | Barra de status. |
| `expo-location` | Expo | MIT | Localização ("Você está aqui"). *Pacote nativo, não presente em `node_modules` no repo.* |
| `typescript` (dev) | Microsoft | Apache-2.0 | Ferramenta de build/typecheck. |
| `@types/react` (dev) | DefinitelyTyped | MIT | Tipos de desenvolvimento. |

### 4.2 Server (FastAPI / SQLite) — ver `server/requirements.txt`

| Pacote | Origem | Licença | Observação |
| --- | --- | --- | --- |
| `fastapi` | Sebastián Ramírez | MIT | Framework web ASGI da API REST. |
| `uvicorn[standard]` | Encode | BSD-3-Clause | Servidor ASGI. |
| `starlette` (via FastAPI) | Encode | BSD-3-Clause | Toolkit ASGI usado pelo FastAPI. |
| `sqlalchemy` | SQLAlchemy | MIT | ORM sobre o SQLite. |
| `pydantic` | Pydantic | MIT | Validação/serialização de schemas. |
| `httpx` | Encode | BSD-3-Clause | Cliente HTTP assíncrono. |
| `pytest` (dev/teste) | pytest-dev | MIT | Testes automatizados. |

Todas as licenças acima são **permissivas** (MIT / BSD / Apache-2.0), compatíveis entre si e com a
licença MIT do projeto.

---

## 5. Confirmação das atribuições obrigatórias

A **única** atribuição legalmente obrigatória para este aplicativo é a do **OpenStreetMap**
(dados sob ODbL). Ela está presente no mapa, embutida no HTML da camada de tiles em
`mobile/src/screens/MapaVisualScreen.tsx`:

```js
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; colaboradores do OpenStreetMap'
}).addTo(mapa);
```

A atribuição é renderizada pelo controle padrão de atribuição da Leaflet (canto inferior direito
do mapa) e fica visível ao usuário. "© colaboradores do OpenStreetMap" é o equivalente em
português de "© OpenStreetMap contributors". **Nenhuma atribuição obrigatória estava faltando**,
portanto não foi necessário adicionar nova atribuição ao código nesta auditoria.

---

## 6. Decisão sobre o arquivo LICENSE

- **Raiz do repositório (`/LICENSE`):** **adicionado** nesta auditoria. Optou-se pela licença
  **MIT** em nome de *David Andrew — APS / UNIP (projeto acadêmico)*, por ser permissiva, simples
  e adequada a um trabalho acadêmico que também reutiliza bibliotecas MIT/BSD. O arquivo inclui
  uma observação esclarecendo que a licença cobre o código e os ativos originais do projeto, mas
  **não** as bibliotecas de terceiros (cada uma mantém sua própria licença) nem os dados do
  OpenStreetMap (ODbL, com atribuição obrigatória).
- **`mobile/LICENSE`:** foi **mantido como está** e **não** representa a licença do projeto. É o
  **MIT boilerplate da Expo** ("Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)"),
  herdado do template inicial do app Expo. A licença que vale para o projeto é a da **raiz**
  (`/LICENSE`). Evitou-se sobrescrever `mobile/LICENSE` para não apagar o aviso de copyright do
  template; esta nota deixa a situação explícita.

---

## 7. Referências

- OpenStreetMap — Copyright e Licença: https://www.openstreetmap.org/copyright
- Open Database License (ODbL): https://opendatacommons.org/licenses/odbl/
- Leaflet (licença BSD-2-Clause): https://github.com/Leaflet/Leaflet/blob/main/LICENSE
- Licença MIT: https://opensource.org/license/mit
- SPTrans — API Olho Vivo: https://www.sptrans.com.br/desenvolvedores/
- IBGE: https://www.ibge.gov.br/
