# 7. Apresentação do programa em funcionamento

Este capítulo é o roteiro para demonstrar o sistema distribuído em funcionamento:
subir o servidor (API REST), configurar (opcionalmente) o token da SPTrans, rodar
o cliente móvel em emulador/dispositivo e percorrer as funcionalidades. As
referências das ferramentas estão no capítulo 8.

## 7.1 Pré-requisitos

- **Python 3.11+** para o back-end ([python.org](https://www.python.org)).
- **Node.js 18+** e **npm** para o cliente ([nodejs.org](https://nodejs.org)).
- **Expo** (usado via `npx`, não requer instalação global) e, para testar em
  celular físico, o app **Expo Go** ([expo.dev/go](https://expo.dev/go)).
- Para o emulador Android: **Android Studio** com um AVD (Android Virtual Device)
  configurado ([developer.android.com/studio](https://developer.android.com/studio)).
- Para o simulador iOS: **Xcode** (apenas em macOS).

## 7.2 Passo 1 - Subir o servidor (API REST)

No diretório do repositório:

```bash
cd server
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Observações:

- No Windows, o executável do venv fica em `.venv\Scripts\` (ex.:
  `.venv\Scripts\python -m uvicorn ...`).
- `--host 0.0.0.0` permite que o emulador e dispositivos na mesma rede acessem a
  API.
- No startup, o servidor cria as tabelas e roda o seed (12 regiões reais de São
  Paulo/SP com medições e alertas de exemplo).

Verificações rápidas (em outro terminal ou no navegador):

- `http://localhost:8000/health` -> `{"status":"ok"}`.
- `http://localhost:8000/api/v1/regioes` -> lista de regiões de SP (JSON).
- `http://localhost:8000/api/v1/localidades/sp` -> municípios de SP via IBGE.
- `http://localhost:8000/docs` -> documentação interativa Swagger ("API Transporte
  Publico SP - APS SD").

## 7.3 Passo 2 - Configurar o token da SPTrans (transporte público em tempo real)

O transporte público usa a **SPTrans Olho Vivo**, a API OFICIAL da Prefeitura de
São Paulo para a frota de ônibus. Ela exige um **token gratuito**. O sistema foi
desenhado para funcionar **com** e **sem** token:

- **Com token (`SPTRANS_TOKEN` definido):** o servidor autentica no Olho Vivo e
  deriva métricas REAIS, em **tempo real**, da frota (linhas monitoradas e
  veículos em operação).
- **Sem token:** o servidor usa um **fallback de exemplo** (conjunto estático de
  linhas de SP, no espírito dos dados GTFS da SPTrans), claramente ROTULADO como
  NÃO tempo real. Assim, a demonstração funciona de ponta a ponta mesmo sem token.

### 7.3.1 Passo a passo para gerar o token no portal da SPTrans

1. Acesse o portal do desenvolvedor da SPTrans:
   [https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/).
2. Cadastre-se / faça login e solicite a sua **chave de ativação** (token) da API
   Olho Vivo. O cadastro é gratuito; o próprio portal traz a opção de solicitar a
   chave de ativação.
3. Copie o token recebido. **Nunca** escreva o token no código nem o publique em
   repositório.

### 7.3.2 Configurar a variável de ambiente `SPTRANS_TOKEN`

Defina a variável de ambiente ANTES de iniciar o servidor (o valor abaixo é apenas
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

Observações:

- O token é lido exclusivamente de `SPTRANS_TOKEN` em
  `server/app/services/sptrans.py` (função `obter_token`); não há token literal no
  repositório.
- Se a variável não estiver definida (ou estiver vazia), o servidor usa o fallback
  de exemplo automaticamente, sem erro.

## 7.4 Passo 3 - Rodar o cliente móvel

```bash
cd mobile
npm install
npx expo start
```

O `expo start` abre um painel com um QR Code e atalhos de teclado:

- Pressione **a** para abrir no **emulador Android** (requer AVD em execução).
- Pressione **i** para abrir no **simulador iOS** (apenas macOS/Xcode).
- Escaneie o **QR Code** com o app **Expo Go** para rodar em um **celular físico**.

### 7.4.1 Configurar o endereço da API (importante)

O cliente precisa saber onde está a API. O default é `http://10.0.2.2:8000`
(alias do host no emulador Android). Ajuste conforme o ambiente definindo a
variável de ambiente antes do `expo start`:

```bash
# Emulador Android (padrao, pode omitir):
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000 npx expo start

# Simulador iOS ou navegador (web):
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000 npx expo start

# Celular fisico (Expo Go): use o IP da sua maquina na rede local
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:8000 npx expo start
```

Descubra o IP da máquina com `ipconfig` (Windows) ou `ifconfig`/`ip addr`
(Linux/macOS). O celular e o computador precisam estar na mesma rede Wi-Fi.

### 7.4.2 Tela inicial no Android (lista de regiões de São Paulo)

A tela inicial do app é a **lista de regiões monitoradas em São Paulo**: uma
lista clicável em que cada item abre o detalhe da região. A **tela inicial não
depende de nenhum módulo nativo de mapa** nem de uma chave do Google Maps,
portanto o app **sempre abre** e a lista garante a navegação e a demonstração de
todas as funcionalidades (detalhe, relatórios e alertas).

Há ainda um **mapa visual** em uma tela **separada e opcional** (botão "Ver no
mapa"), que plota as regiões como marcadores e, a partir das Linhas de ônibus,
a posição em tempo real dos veículos de uma linha. Essa tela usa o Google Maps e
depende de uma chave de API configurada no `app.json` (ver `mobile/BUILD_APK.md`);
por ser separada e opcional, mesmo que o mapa não esteja configurado, o app
continua abrindo normalmente na lista.

> Nota sobre o ambiente de desenvolvimento deste trabalho: não havia emulador
> disponível no ambiente onde o código foi construído. Por isso, o cliente foi
> validado por checagem de tipos (`npx tsc --noEmit`), e este roteiro documenta o
> passo a passo completo para execução em emulador/dispositivo real.

## 7.5 Roteiro de demonstração das funcionalidades

Com o servidor no ar e o app aberto, percorra o fluxo:

1. **Lista e consulta por região.** A tela inicial mostra a lista clicável
   "Regiões monitoradas em São Paulo" com os 12 distritos reais da capital (Sé,
   Pinheiros, Mooca, Santana, Itaquera, Santo Amaro, Butantã, Lapa, Vila Mariana,
   Ipiranga, Penha e Tatuapé). Toque em um item da lista para abrir o detalhe.

2. **Detalhe da região.** Veja as medições de **Transporte público (SPTrans)**,
   com valor, unidade, data/hora e a fonte de cada dado.

   > **Origem dos dados (fonte oficial de SP):**
   > - **Transporte público:** SPTrans Olho Vivo (fonte OFICIAL da Prefeitura de
   >   SP). Com `SPTRANS_TOKEN`, os valores são em tempo real; sem token, o campo
   >   `fonte` indica explicitamente dado de EXEMPLO (fallback, NÃO tempo real).
   > As medições criadas pelo seed são apenas **valores iniciais de exemplo**, e o
   > próprio campo `fonte` registra a origem em tempo de execução.

3. **Atualização com dados da fonte.** No detalhe, toque no botão **"Atualizar
   transporte"**, que chama `POST /api/v1/regioes/{id}/atualizar-transporte`.
   Com token, o servidor autentica no Olho Vivo, lê o `/Posicao` e persiste
   `linhas_monitoradas` e `veiculos_em_operacao` (tempo real). Sem token,
   persiste `linhas_exemplo` (fallback rotulado). Observação de semântica: essas
   métricas são da cidade de São Paulo como um todo (o `/Posicao` devolve a frota
   inteira e ignora o lat/lon da região), não geofiltradas por região; por isso
   regiões diferentes atualizadas no mesmo instante recebem os mesmos valores.
   Após a atualização, a lista recarrega com as medições e o campo `fonte` registra
   a origem.

4. **Relatórios.** No detalhe, toque em "Ver relatório" para abrir as agregações
   por parâmetro: média, mínimo, máximo, contagem (amostras) e última leitura. No
   topo, um **gráfico de barras** ("Médias por parâmetro") resume visualmente os
   dados, incluindo os parâmetros de transporte público quando houver medições.

5. **Linhas de ônibus (acompanhamento e busca).** Na tela inicial, toque no botão
   **"Linhas de onibus"** para abrir a tela de Linhas. Nela há duas abas,
   "Linhas" e "Paradas", que compartilham o mesmo campo de busca:
   - Na aba **Linhas**, digite um termo (ex.: `8000` ou `Lapa`) e toque em
     "Buscar" (`GET /api/v1/linhas/buscar`). Cada resultado mostra o letreiro, os
     terminais e o sentido. Toque em "Ver posicao" para listar a posição dos
     veículos em operação (`GET /api/v1/linhas/{codigo_linha}/posicoes`) ou em "Ver
     previsao" para a previsão de chegada por parada
     (`GET /api/v1/linhas/{codigo_linha}/previsao`).
   - Na aba **Paradas**, busque por um termo (ex.: `Av. Paulista`) para listar
     paradas com nome, endereço e coordenadas (`GET /api/v1/paradas/buscar`).

   Todos esses dados vêm da **SPTrans Olho Vivo**, a fonte OFICIAL da Prefeitura
   de São Paulo. Com `SPTRANS_TOKEN` definido, são em tempo real; sem token, a
   tela exibe um aviso de que o dado é de EXEMPLO (não tempo real).

6. **Alertas.** Pela tela de Alertas, veja as regras cadastradas, crie uma nova
   regra (escolha região, tipo, parâmetro, condição `>`/`<` e limiar) e toque em
   "Avaliar região selecionada". Os alertas disparados aparecem destacados com o
   valor observado. Dica: crie uma regra com limiar baixo (ex.: veículos em
   operação > 1) para forçar um disparo.

7. **Tratamento de erros (demonstração).** Pare o servidor (encerre o uvicorn) e
   tente recarregar uma tela no app: em vez de travar, o app exibe uma mensagem
   amigável em PT-BR ("Nao foi possivel conectar ao servidor...") com a opção de
   "Tentar novamente". No servidor, uma região inexistente
   (`GET /api/v1/regioes/99999`) retorna 404 no formato padronizado `ErroResposta`;
   e uma falha na fonte externa retorna 502 padronizado (nunca 500 cru).

## 7.6 Executar os testes do back-end (opcional na apresentação)

```bash
cd server
.venv/bin/python -m pytest -q
```

A suíte valida saúde, regiões, medições, relatórios, alertas, tratamento de erros,
a base geográfica do IBGE e o transporte público da SPTrans (com token e
fallback), incluindo o acompanhamento de ônibus e a busca de linhas/paradas
(`test_linhas.py`). A rede e o token são SEMPRE mockados: nenhum teste acessa a
SPTrans ou o IBGE reais nem usa token real.

## 7.7 Checagem de tipos do cliente (opcional na apresentação)

```bash
cd mobile
npx tsc --noEmit
```

Deve terminar sem erros de tipo, confirmando a integridade do código TypeScript.
