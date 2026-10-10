# 7. Apresentacao do programa em funcionamento

Este capitulo e o roteiro para demonstrar o sistema distribuido em funcionamento:
subir o servidor (API REST), configurar (opcionalmente) o token da SPTrans, rodar
o cliente movel em emulador/dispositivo e percorrer as funcionalidades. As
referencias das ferramentas estao no capitulo 8.

## 7.1 Pre-requisitos

- **Python 3.11+** para o back-end ([python.org](https://www.python.org)).
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
- No startup, o servidor cria as tabelas e roda o seed (5 regioes reais de Sao
  Paulo/SP com medicoes e alertas de exemplo).

Verificacoes rapidas (em outro terminal ou no navegador):

- `http://localhost:8000/health` -> `{"status":"ok"}`.
- `http://localhost:8000/api/v1/regioes` -> lista de regioes de SP (JSON).
- `http://localhost:8000/api/v1/localidades/sp` -> municipios de SP via IBGE.
- `http://localhost:8000/docs` -> documentacao interativa Swagger ("API Ambiental
  Urbana - APS SD").

## 7.3 Passo 2 - Configurar o token da SPTrans (transporte publico em tempo real)

O transporte publico usa a **SPTrans Olho Vivo**, a API OFICIAL da Prefeitura de
Sao Paulo para a frota de onibus. Ela exige um **token gratuito**. O sistema foi
desenhado para funcionar **com** e **sem** token:

- **Com token (`SPTRANS_TOKEN` definido):** o servidor autentica no Olho Vivo e
  deriva metricas REAIS, em **tempo real**, da frota (linhas monitoradas e
  veiculos em operacao).
- **Sem token:** o servidor usa um **fallback de exemplo** (conjunto estatico de
  linhas de SP, no espirito dos dados GTFS da SPTrans), claramente ROTULADO como
  NAO tempo real. Assim, a demonstracao funciona de ponta a ponta mesmo sem token.

### 7.3.1 Passo a passo para gerar o token no portal da SPTrans

1. Acesse o portal do desenvolvedor da SPTrans:
   [https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/).
2. Cadastre-se / faca login e solicite a sua **chave de ativacao** (token) da API
   Olho Vivo. O cadastro e gratuito; o proprio portal traz a opcao de solicitar a
   chave de ativacao.
3. Copie o token recebido. **Nunca** escreva o token no codigo nem o publique em
   repositorio.

### 7.3.2 Configurar a variavel de ambiente `SPTRANS_TOKEN`

Defina a variavel de ambiente ANTES de iniciar o servidor (o valor abaixo e apenas
um **placeholder**; use o seu token real no seu ambiente):

```bash
# Linux / macOS
export SPTRANS_TOKEN="COLE_AQUI_O_SEU_TOKEN"
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

```bat
rem Windows (prompt de comando)
set SPTRANS_TOKEN=COLE_AQUI_O_SEU_TOKEN
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Observacoes:

- O token e lido exclusivamente de `SPTRANS_TOKEN` em
  `server/app/services/sptrans.py` (funcao `obter_token`); nao ha token literal no
  repositorio.
- Se a variavel nao estiver definida (ou estiver vazia), o servidor usa o fallback
  de exemplo automaticamente, sem erro.

## 7.4 Passo 3 - Rodar o cliente movel

```bash
cd mobile
npm install
npx expo start
```

O `expo start` abre um painel com um QR Code e atalhos de teclado:

- Pressione **a** para abrir no **emulador Android** (requer AVD em execucao).
- Pressione **i** para abrir no **simulador iOS** (apenas macOS/Xcode).
- Escaneie o **QR Code** com o app **Expo Go** para rodar em um **celular fisico**.

### 7.4.1 Configurar o endereco da API (importante)

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

### 7.4.2 Google Maps API key no Android (mapa de Sao Paulo)

No Android, o `MapView` do react-native-maps usa o Google Maps e pode exigir uma
**Google Maps API key**; sem ela, o mapa pode aparecer em cinza. Para habilitar,
obtenha uma chave no Google Cloud Console
([console.cloud.google.com](https://console.cloud.google.com), habilitando o
"Maps SDK for Android") e configure-a conforme a documentacao do react-native-maps
([github.com/react-native-maps/react-native-maps](https://github.com/react-native-maps/react-native-maps))
e do Expo ([docs.expo.dev](https://docs.expo.dev)). Mesmo sem a chave, a **lista de
regioes clicavel** na tela do mapa (enquadrada em Sao Paulo) garante a navegacao e
a demonstracao de todas as funcionalidades.

> Nota sobre o ambiente de desenvolvimento deste trabalho: nao havia emulador
> disponivel no ambiente onde o codigo foi construido. Por isso, o cliente foi
> validado por checagem de tipos (`npx tsc --noEmit`), e este roteiro documenta o
> passo a passo completo para execucao em emulador/dispositivo real.

## 7.5 Roteiro de demonstracao das funcionalidades

Com o servidor no ar e o app aberto, percorra o fluxo:

1. **Mapa e consulta por regiao.** A tela inicial ("Monitor Ambiental Urbano")
   mostra o mapa enquadrado em Sao Paulo com marcadores nas regioes (Se,
   Pinheiros, Mooca, Santana, Itaquera) e uma lista clicavel abaixo ("Regioes
   monitoradas em Sao Paulo"). Toque em um marcador (callout) ou em um item da
   lista para abrir o detalhe.

2. **Detalhe da regiao.** Veja as medicoes agrupadas por tipo (Qualidade do ar,
   Alagamento, Transporte publico (SPTrans)), com valor, unidade, data/hora e a
   fonte de cada dado.

   > **Origem dos dados (fontes e autoridades oficiais de SP):**
   > - **Transporte publico:** SPTrans Olho Vivo (fonte OFICIAL da Prefeitura de
   >   SP). Com `SPTRANS_TOKEN`, os valores sao em tempo real; sem token, o campo
   >   `fonte` indica explicitamente dado de EXEMPLO (fallback, NAO tempo real).
   > - **Qualidade do ar:** Open-Meteo Air Quality API (dado operacional), tendo a
   >   **CETESB/QUALAR** como autoridade oficial de referencia em SP (citada no
   >   campo `fonte`).
   > - **Alagamento:** Open-Meteo Flood API / GloFAS (dado operacional), tendo o
   >   **CGE-SP** como autoridade oficial de referencia em SP (citado no `fonte`).
   > As medicoes criadas pelo seed sao apenas **valores iniciais de exemplo**, e o
   > proprio campo `fonte` registra a origem em tempo de execucao.

3. **Atualizacao com dados das fontes.** Acione as atualizacoes do detalhe:
   - **Transporte publico:** chama `POST /api/v1/regioes/{id}/atualizar-transporte`.
     Com token, o servidor autentica no Olho Vivo, le o `/Posicao` e persiste
     `linhas_monitoradas` e `veiculos_em_operacao` (tempo real). Sem token,
     persiste `linhas_exemplo` (fallback rotulado).
   - **Qualidade do ar:** `POST /api/v1/regioes/{id}/atualizar-ar` (Open-Meteo).
   - **Alagamento:** `POST /api/v1/regioes/{id}/atualizar-alagamento` (Open-Meteo
     Flood/GloFAS).
   Em cada caso, a lista recarrega com as medicoes atualizadas e o campo `fonte`
   registra a origem.

4. **Relatorios.** No detalhe, toque em "Ver relatorio" para abrir as agregacoes
   por parametro: media, minimo, maximo, contagem (amostras) e ultima leitura. No
   topo, um **grafico de barras** ("Medias por parametro") resume visualmente os
   dados, incluindo os parametros de transporte publico quando houver medicoes.

5. **Alertas.** Pela tela de Alertas, veja as regras cadastradas, crie uma nova
   regra (escolha regiao, tipo, parametro, condicao `>`/`<` e limiar) e toque em
   "Avaliar regiao selecionada". Os alertas disparados aparecem destacados com o
   valor observado. Dica: crie uma regra com limiar baixo (ex.: PM2.5 > 1) para
   forcar um disparo.

6. **Tratamento de erros (demonstracao).** Pare o servidor (encerre o uvicorn) e
   tente recarregar uma tela no app: em vez de travar, o app exibe uma mensagem
   amigavel em PT-BR ("Nao foi possivel conectar ao servidor...") com a opcao de
   "Tentar novamente". No servidor, uma regiao inexistente
   (`GET /api/v1/regioes/99999`) retorna 404 no formato padronizado `ErroResposta`;
   e uma falha na fonte externa retorna 502 padronizado (nunca 500 cru).

## 7.6 Executar os testes do back-end (opcional na apresentacao)

```bash
cd server
.venv/bin/python -m pytest -q
```

A suite valida saude, regioes, medicoes, relatorios, alertas, tratamento de erros,
a base geografica do IBGE e o transporte publico da SPTrans (com token e fallback),
alem do mapeamento dos payloads das demais fontes. A rede e o token sao SEMPRE
mockados: nenhum teste acessa a SPTrans real nem usa token real.

## 7.7 Checagem de tipos do cliente (opcional na apresentacao)

```bash
cd mobile
npx tsc --noEmit
```

Deve terminar sem erros de tipo, confirmando a integridade do codigo TypeScript.
