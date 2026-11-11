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
2. Cadastre-se / faça login e solicite a **chave de ativação** (token) da API
   Olho Vivo. O cadastro é gratuito; o próprio portal traz a opção de solicitar a
   chave de ativação.
3. Copie o token recebido. **Nunca** escreva o token no código nem o publique em
   repositório.

### 7.3.2 Configurar a variável de ambiente `SPTRANS_TOKEN`

Defina a variável de ambiente ANTES de iniciar o servidor (o valor abaixo é apenas
um **placeholder**; use o token real no ambiente):

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

# Celular fisico (Expo Go): use o IP da maquina na rede local
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

Há ainda um **mapa visual com busca integrada** em uma tela **separada e
opcional** (botão "Ver no mapa"), uma segunda porta de entrada mais visual para
acompanhar as linhas, que complementa a tela de Linhas (que continua em lista).
O mapa ocupa a tela toda e, por cima dele (numa camada React Native sobreposta,
nunca dentro do WebView), traz uma **barra de busca flutuante**, um **painel
inferior expansível por toque** com o catálogo/sugestões e os favoritos, e o
controle **"Você está aqui"** (GPS). Sem linha selecionada, plota as regiões como
marcadores; ao selecionar uma linha (pela busca na própria tela ou vindo das
Linhas de ônibus), plota a posição em tempo real dos veículos (com **atualização
automática** periódica e botão de pausar); ao selecionar uma **parada**, plota um
marcador nela. Essa tela desenha o mapa com **um único tile fixo do
OpenStreetMap** (biblioteca Leaflet dentro de um `react-native-webview`),
portanto **não precisa de chave de API** nem de billing e **não usa satélite**;
requer apenas internet para carregar os tiles. Por ser separada e opcional, mesmo
que o mapa não carregue (ex.: sem internet), o app continua abrindo normalmente
na lista.

> Nota sobre o ambiente de desenvolvimento deste trabalho: não havia emulador
> disponível no ambiente onde o código foi construído. Por isso, o cliente foi
> validado por checagem de tipos (`npx tsc --noEmit`), e este roteiro documenta o
> passo a passo completo para execução em emulador/dispositivo real.

## 7.5 Roteiro de demonstração das funcionalidades

Com o servidor no ar e o app aberto, percorra o fluxo:

0. **Consentimento (LGPD) na primeira execução.** Na primeira abertura (ou quando
   a versão dos Termos muda), o app exibe a tela de **Consentimento** antes de
   qualquer outra. Ela traz um resumo honesto, botões para ler a **Política de
   Privacidade** e os **Termos de Uso**, um **checkbox obrigatório** ("Li e aceito
   os Termos de Uso e a Política de Privacidade") e um **checkbox opcional** de
   consentimento de localização para o "Você está aqui". Toque em **ACEITAR**
   (habilitado somente com o aceite marcado) ou em **RECUSAR**: em ambos os casos
   a resposta é **registrada localmente** (com versão e data/hora) e o aviso não
   reaparece a cada abertura. Quem recusa continua usando o app sem o "Você está
   aqui".

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
   topo, um **gráfico de barras horizontais** ("Médias por parâmetro") resume
   visualmente os dados, incluindo os parâmetros de transporte público quando
   houver medições, com o **rótulo completo** de cada parâmetro ao lado da barra.
   Como o histórico de medições é **acumulado e limitado a 50** por parâmetro
   (ver passo 3 de "Atualizar transporte"), as **amostras passam a ser maiores
   que 1** e média/mínimo/máximo variam a cada atualização.

5. **Linhas de ônibus (acompanhamento e busca).** Na tela inicial, toque no botão
   **"Linhas de onibus"** para abrir a tela de Linhas. Nela há duas abas,
   "Linhas" e "Paradas", que compartilham o mesmo campo de busca:
   - Na aba **Linhas**, digite um termo (ex.: `8000` ou `Lapa`) e toque em
     "Buscar" (`GET /api/v1/linhas/buscar`). Cada resultado mostra o letreiro, os
     terminais e o sentido. Toque em "Ver posicao" para listar a posição dos
     veículos em operação (`GET /api/v1/linhas/{codigo_linha}/posicoes`) ou em "Ver
     previsao" para a previsão de chegada por parada
     (`GET /api/v1/linhas/{codigo_linha}/previsao`). Ao ver a posição, um **selo**
     destaca o **número de veículos em operação** da linha (verde com a contagem,
     ex.: "7 em operacao", ou neutro "Sem veiculos no momento" quando a lista vem
     vazia); quando o dado é de EXEMPLO (servidor sem token), o selo acrescenta
     "(exemplo)".
   - Na aba **Paradas**, busque por um termo (ex.: `Av. Paulista`) para listar
     paradas com nome, endereço e coordenadas (`GET /api/v1/paradas/buscar`).

   **Busca aproximada (fuzzy).** Não é preciso digitar o termo exatamente como no
   Olho Vivo: a tela **normaliza** o texto (ignora acentos e pontuação) e
   **ordena** os resultados por similaridade com o que foi digitado, trazendo o
   mais parecido primeiro. Na aba de **Paradas**, se a primeira consulta vier
   vazia, a tela ainda tenta automaticamente uma **variação abreviada** do termo
   (ex.: "avenida" → "av", "praça" → "pça"), pois são as formas que a SPTrans
   reconhece. A busca livre continua idêntica; a fuzzy apenas melhora a ordem e a
   tolerância.

   **Navegação assistida (catálogo).** Enquanto o campo de busca estiver vazio, a
   tela mostra conteúdo de apoio: na aba de **Linhas**, apenas a lista de
   **Favoritos** (quando houver); na aba de **Paradas**, uma **orientação curta**
   para digitar o nome da parada, avenida ou referência (não há mais sugestões
   fixas de parada, pois alguns termos não existiam na busca real). A **busca
   livre continua disponível** e permite pesquisar **qualquer linha ou parada**.
   A seção some assim que há termo digitado ou resultados, para não poluir a tela.

   **Favoritos (salvos no aparelho).** Cada linha nos resultados tem uma
   **estrela** para favoritar/desfavoritar. Os favoritos ficam salvos
   **localmente no dispositivo** (não dependem do servidor) e reaparecem na seção
   "Favoritos" da navegação assistida; tocar em um favorito reabre a linha pelo
   mesmo fluxo de busca. Se o armazenamento local não estiver disponível, a tela
   continua funcionando normalmente (apenas sem persistir entre sessões).

   Ainda na posição dos veículos, o botão **"Ver no mapa"** abre o mapa visual
   com os ônibus plotados. Nesse modo, a posição é **atualizada automaticamente**
   a cada intervalo (padrão de 15 segundos, selecionável entre 10s, 15s e 30s),
   com um botão **"Pausar"/"Retomar"** e um indicador do estado
   ("Atualizando a cada 15s" / "Pausado") e do horário da última atualização. Os
   marcadores são trocados sem recarregar o mapa, preservando o zoom e o centro
   escolhidos pelo usuário.

   Todos esses dados vêm da **SPTrans Olho Vivo**, a fonte OFICIAL da Prefeitura
   de São Paulo. Com `SPTRANS_TOKEN` definido, são em tempo real; sem token, a
   tela exibe um aviso de que o dado é de EXEMPLO (não tempo real).

6. **Mapa com busca integrada.** Na tela inicial, toque em **"Ver no mapa"**. O
   mapa abre ocupando a tela toda, mostrando as regiões. No topo há uma **barra de
   busca flutuante** (abas "Linhas"/"Paradas" + campo "Buscar linha ou parada"):
   é a **mesma busca livre** da tela de Linhas, então qualquer linha pode ser
   pesquisada. No rodapé há um **painel que abre e fecha ao toque**: recolhido,
   mostra um resumo (a linha selecionada e o número de veículos em operação, ou um
   convite a buscar); expandido, revela os **resultados da busca** e, quando o
   campo está vazio, a **navegação assistida** (favoritos de linhas na aba Linhas;
   uma orientação curta na aba Paradas) e os **favoritos** (com a estrela para
   salvar/remover). A mesma **busca aproximada (fuzzy)** da tela de Linhas vale
   aqui. O painel respeita a **área segura** do aparelho: o cabeçalho e os itens
   tocáveis ficam acima da barra de navegação do Android (botões
   voltar/home/recentes), nunca escondidos atrás dela. Toque numa linha para
   **plotá-la no mapa**: os veículos aparecem com o mesmo **auto-refresh**
   (10/15/30s e botão pausar) e o painel recolhe para dar espaço ao mapa. Ao
   buscar e tocar numa **parada**, o mapa plota um **marcador** nela (nome +
   endereço) e centraliza a visão no ponto. O mapa usa **um único tile fixo do
   OpenStreetMap** (sem alternância de camadas, sem satélite e sem chave de API),
   com a atribuição "© colaboradores do OpenStreetMap" visível no canto; os
   controles de zoom +/- ficam no canto inferior esquerdo.

7. **"Você está aqui" (GPS, condicionado ao consentimento).** Ainda no mapa, se
   houve consentimento de localização no passo 0, aparece o controle **"📍 Você está
   aqui"** no canto inferior direito. Ao tocá-lo, o app pede (uma única vez) a
   permissão de localização do sistema e, concedida, plota um marcador "Você está
   aqui" na posição atual do aparelho, **apenas no mapa do aparelho**: a coordenada
   **nunca é enviada ao servidor**. Se o consentimento foi recusado, o controle
   não aparece (é possível reativá-lo na tela de Privacidade). Caso a permissão do
   SO seja negada ou o GPS esteja desligado, o app exibe uma mensagem amigável e o
   mapa continua funcionando.

8. **Privacidade e direitos do titular (LGPD).** Abra a tela de **Privacidade**.
   Nela é possível **ver os dados guardados localmente** no aparelho (linhas
   favoritas e o registro de consentimento), **excluir** esses dados locais e
   **revogar** o consentimento de localização. Como o app não tem conta nem coleta
   dados no servidor, esses direitos (acesso, correção, exclusão e revogação) são
   exercidos diretamente no dispositivo; para solicitações adicionais, o canal é o
   e-mail do encarregado (daviddeziderio07@gmail.com).

9. **Alertas.** Pela tela de Alertas, veja as regras cadastradas, crie uma nova
   regra (escolha região, tipo, parâmetro, condição `>`/`<` e limiar) e toque em
   "Avaliar região selecionada". Tanto as regras cadastradas quanto os alertas
   disparados identificam a região pelo **nome** (ex.: "Sé", "Lapa"), e não pelo
   número interno. Os alertas disparados aparecem destacados com o valor
   observado. Dica: crie uma regra com limiar baixo (ex.: veículos em operação >
   1) para forçar um disparo.

10. **Tratamento de erros (demonstração).** Pare o servidor (encerre o uvicorn) e
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
