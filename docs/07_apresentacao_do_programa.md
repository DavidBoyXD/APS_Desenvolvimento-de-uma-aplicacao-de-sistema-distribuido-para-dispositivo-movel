# 7. Apresentacao do programa em funcionamento

Este capitulo e o roteiro para demonstrar o sistema distribuido em funcionamento:
subir o servidor (API REST), rodar o cliente movel em emulador/dispositivo e
percorrer as funcionalidades. As referencias das ferramentas estao no capitulo 8.

## 7.1 Pre-requisitos

- **Python 3.9+** para o back-end ([python.org](https://www.python.org)).
- **Node.js 18+** e **npm** para o cliente ([nodejs.org](https://nodejs.org)).
- **Expo** (usado via `npx`, nao requer instalacao global) e, para testar em
  celular fisico, o app **Expo Go** ([expo.dev/go](https://expo.dev/go)).
- Para o emulador Android: **Android Studio** com um AVD (Android Virtual Device)
  configurado ([developer.android.com/studio](https://developer.android.com/studio)).
- Para o simulador iOS: **Xcode** (apenas em macOS).

## 7.2 Passo 1 - Subir o servidor (API REST)

No diretorio do repositorio:

```bash
cd server
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Observacoes:

- No Windows, o executavel do venv fica em `.venv\Scripts\` (ex.:
  `.venv\Scripts\python -m uvicorn ...`).
- `--host 0.0.0.0` permite que o emulador e dispositivos na mesma rede acessem a
  API.
- No startup, o servidor cria as tabelas e roda o seed (3 regioes reais com
  medicoes e alertas de exemplo).

Verificacoes rapidas (em outro terminal ou no navegador):

- `http://localhost:8000/health` -> `{"status":"ok"}`.
- `http://localhost:8000/api/v1/regioes` -> lista de regioes (JSON).
- `http://localhost:8000/docs` -> documentacao interativa Swagger da API
  (titulo e descricao em PT-BR).

## 7.3 Passo 2 - Rodar o cliente movel

```bash
cd mobile
npm install
npx expo start
```

O `expo start` abre um painel com um QR Code e atalhos de teclado:

- Pressione **a** para abrir no **emulador Android** (requer AVD em execucao).
- Pressione **i** para abrir no **simulador iOS** (apenas macOS/Xcode).
- Escaneie o **QR Code** com o app **Expo Go** para rodar em um **celular fisico**.

### 7.3.1 Configurar o endereco da API (importante)

O cliente precisa saber onde esta a API. O default e `http://10.0.2.2:8000`
(alias do host no emulador Android). Ajuste conforme o ambiente definindo a
variavel de ambiente antes do `expo start`:

```bash
# Emulador Android (padrao, pode omitir):
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000 npx expo start

# Simulador iOS ou navegador (web):
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000 npx expo start

# Celular fisico (Expo Go): use o IP da sua maquina na rede local
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:8000 npx expo start
```

Descubra o IP da maquina com `ipconfig` (Windows) ou `ifconfig`/`ip addr`
(Linux/macOS). O celular e o computador precisam estar na mesma rede Wi-Fi.

### 7.3.2 Google Maps API key no Android (mapa)

No Android, o `MapView` do react-native-maps usa o Google Maps e pode exigir uma
**Google Maps API key**; sem ela, o mapa pode aparecer em cinza. Para habilitar,
obtenha uma chave no Google Cloud Console
([console.cloud.google.com](https://console.cloud.google.com), habilitando o
"Maps SDK for Android") e configure-a conforme a documentacao do react-native-maps
([github.com/react-native-maps/react-native-maps](https://github.com/react-native-maps/react-native-maps))
e do Expo ([docs.expo.dev](https://docs.expo.dev)). Mesmo sem a chave, a
**lista de regioes clicavel** na tela do mapa garante a navegacao e a demonstracao
de todas as funcionalidades.

> Nota sobre o ambiente de desenvolvimento deste trabalho: nao havia emulador
> disponivel no ambiente onde o codigo foi construido. Por isso, o cliente foi
> validado por checagem de tipos (`npx tsc --noEmit`), e este roteiro documenta o
> passo a passo completo para execucao em emulador/dispositivo real.

## 7.4 Roteiro de demonstracao das funcionalidades

Com o servidor no ar e o app aberto, percorra o fluxo:

1. **Mapa e consulta por regiao.** A tela inicial ("Monitor Ambiental Urbano")
   mostra o mapa com marcadores nas regioes (Sao Paulo, Rio de Janeiro, Curitiba)
   e uma lista clicavel abaixo. Toque em um marcador (callout) ou em um item da
   lista para abrir o detalhe.

2. **Detalhe da regiao.** Veja as medicoes agrupadas por tipo (Qualidade do ar,
   Transito, Alagamento), com valor, unidade, data/hora e a fonte de cada dado.

   > **Importante (origem dos dados):** os **tres tipos** de medicao tem fonte
   > real, publica, gratuita e sem chave de API: a **qualidade do ar** usa a
   > **Open-Meteo Air Quality API**, o **transito** usa a **Overpass API do
   > OpenStreetMap** (dados sob licenca ODbL) e o **alagamento** usa a
   > **Open-Meteo Flood API** (base cientifica **GloFAS**, do programa Copernicus),
   > que fornece a descarga fluvial (`river_discharge`, em m3/s). Ver capitulo 8.
   > As medicoes criadas pelo seed sao apenas **valores iniciais de exemplo**, e o
   > proprio campo `fonte` de cada medicao registra, em tempo de execucao, a
   > origem do dado (a fonte real substituivel), justamente para que o valor
   > inicial nunca seja confundido com uma leitura observada. A modelagem generica
   > (uma tabela de medicao por tipo/parametro) permite atualizar os tres tipos com
   > dados reais sem alterar a API nem o cliente.

3. **Atualizacao com dados reais.** Toque em "Atualizar qualidade do ar". O app
   chama `POST /api/v1/regioes/{id}/atualizar-ar`; o servidor consulta a Open-Meteo
   com a latitude/longitude da regiao, persiste as novas medicoes e as retorna. A
   lista recarrega com os dados reais mais recentes (PM2.5, PM10, etc.). De forma
   analoga, o servidor tambem expoe `POST /api/v1/regioes/{id}/atualizar-transito`
   (vias reais na Overpass API do OpenStreetMap) e
   `POST /api/v1/regioes/{id}/atualizar-alagamento` (descarga fluvial real na
   Open-Meteo Flood API / GloFAS), cada um persistindo as medicoes reais do seu
   tipo e registrando a fonte no campo `fonte`.

4. **Relatorios.** No detalhe, toque em "Ver relatorio" para abrir as agregacoes
   por parametro: media, minimo, maximo, contagem (amostras) e ultima leitura.

5. **Alertas.** Pela tela de Alertas, veja as regras cadastradas, crie uma nova
   regra (escolha regiao, tipo, parametro, condicao `>`/`<` e limiar) e toque em
   "Avaliar regiao selecionada". Os alertas disparados aparecem destacados com o
   valor observado. Dica de demonstracao: crie uma regra com limiar baixo (ex.:
   PM2.5 > 1) para forcar um disparo.

6. **Tratamento de erros (demonstracao).** Pare o servidor (encerre o uvicorn) e
   tente recarregar uma tela no app: em vez de travar, o app exibe uma mensagem
   amigavel em PT-BR ("Nao foi possivel conectar ao servidor...") com a opcao de
   "Tentar novamente". No servidor, uma regiao inexistente
   (`GET /api/v1/regioes/99999`) retorna 404 no formato padronizado `ErroResposta`.

## 7.5 Executar os testes do back-end (opcional na apresentacao)

```bash
cd server
.venv/bin/python -m pytest -q
```

A suite valida saude, regioes, medicoes, relatorios, alertas, tratamento de erros
e o mapeamento dos payloads das fontes reais (Open-Meteo Air Quality, Overpass e
Open-Meteo Flood API / GloFAS), sempre com a chamada externa mockada.

## 7.6 Checagem de tipos do cliente (opcional na apresentacao)

```bash
cd mobile
npx tsc --noEmit
```

Deve terminar sem erros de tipo, confirmando a integridade do codigo TypeScript.
