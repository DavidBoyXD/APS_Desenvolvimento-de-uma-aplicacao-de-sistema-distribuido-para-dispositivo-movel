# Como gerar o APK (Android) com EAS Build

Este guia explica, passo a passo, como você gera um arquivo **.apk** instalável
do aplicativo móvel usando o **EAS Build** (serviço de build na nuvem do Expo).
O build roda nos servidores do Expo, então **não** é necessário instalar o
Android Studio nem o SDK do Android na sua máquina.

Todos os comandos abaixo são executados **no terminal, dentro da pasta
`mobile/`** do repositório, exceto quando indicado o contrário. Siga os passos na
ordem apresentada.

## Pré-requisitos (faça antes de começar)

1. **Conta Expo gratuita.** Crie uma conta em
   [https://expo.dev](https://expo.dev) (gratuita). Você vai usar esse login no
   passo de autenticação.
2. **Node.js instalado** na sua máquina (versão 18 ou superior) com o `npm`.
   Confira com `node --version` e `npm --version`.
3. **Repositório clonado** na sua máquina e um terminal aberto.

## Passo 1 — Entrar na pasta do app e instalar as dependências

No terminal, a partir da raiz do repositório:

```bash
cd mobile
npm install
```

- **O que faz:** baixa todas as bibliotecas do aplicativo para a pasta
  `mobile/node_modules`.
- **Onde:** terminal, na pasta `mobile/`.
- **Quando:** uma vez, antes de qualquer build (ou sempre que o `package.json`
  mudar).

## Passo 2 — Instalar o EAS CLI

O EAS CLI é a ferramenta de linha de comando que fala com o serviço de build do
Expo. Instale de forma global:

```bash
npm install -g eas-cli
```

- **Alternativa sem instalar global:** você pode trocar `eas` por
  `npx eas-cli@latest` em todos os comandos adiante (por exemplo,
  `npx eas-cli@latest login`). Use a forma que preferir.
- **Onde:** terminal (qualquer pasta; é instalação global).
- **Quando:** uma vez por máquina.

## Passo 3 — Autenticar com a sua conta Expo

```bash
eas login
```

- **O que faz:** conecta o EAS CLI à **sua** conta Expo. Serão solicitados o seu
  e-mail/usuário e a senha do Expo.
- **Onde:** terminal, na pasta `mobile/`.
- **Quando:** antes de inicializar o projeto e de gerar o build. Esta etapa é
  feita **na sua máquina**, com **as suas credenciais** — ninguém mais faz o login
  por você.
- Para conferir se já está logado: `eas whoami`.

## Passo 4 — Inicializar/vincular o projeto EAS

```bash
eas init
```

- **O que faz:** cria (ou vincula) o projeto na sua conta Expo e **adiciona
  automaticamente** o campo `extra.eas.projectId` no arquivo `mobile/app.json`,
  já com o identificador real (um UUID). Você **não** precisa digitar nenhum
  `projectId` à mão, e o repositório **não** traz esse campo preenchido de
  propósito: o `eas init` é quem o insere.
- **Importante:** se você vir o erro `Invalid UUID appId` ou a mensagem
  `Project already linked (ID: ...)` com um valor que **não** seja um UUID, é
  porque existe um `extra.eas.projectId` invalido no `app.json`. Remova o bloco
  `extra` do `app.json` (conforme a mensagem do proprio EAS sugere) e rode
  `eas init` novamente.
- **Onde:** terminal, na pasta `mobile/`.
- **Quando:** uma vez por projeto/conta (depois do `eas login`).

## Passo 5 (opcional, mas importante) — Definir o endereço do servidor da API

O aplicativo lê a base da API pela variável de ambiente
`EXPO_PUBLIC_API_BASE_URL`. As variáveis com prefixo `EXPO_PUBLIC_` são
**embutidas no pacote em tempo de build**, ou seja, o valor é "congelado" no APK
no momento em que você gera o build.

- O valor padrão do código é `http://10.0.2.2:8000`, que funciona **apenas no
  emulador Android** (`10.0.2.2` é o apelido do `localhost` da sua máquina visto
  de dentro do emulador).
- Em um **APK instalado em um celular físico**, `10.0.2.2` **não funciona**. O
  celular precisa de um servidor FastAPI acessível pela internet (ou pelo IP da
  sua rede local/LAN). Defina o endereço real **antes** de rodar o build:

  ```bash
  # Linux/macOS (define a variavel apenas para o comando de build)
  EXPO_PUBLIC_API_BASE_URL=https://SEU_SERVIDOR_PUBLICO eas build -p android --profile preview

  # Windows (PowerShell): defina antes e depois rode o build
  $env:EXPO_PUBLIC_API_BASE_URL="https://SEU_SERVIDOR_PUBLICO"
  eas build -p android --profile preview
  ```

  Há um modelo em [`.env.example`](.env.example) mostrando essa variável.
- **Onde:** terminal, na pasta `mobile/`.
- **Quando:** imediatamente antes do build (Passo 6), sempre que quiser apontar o
  APK para um servidor remoto. Se for usar só no emulador, pode pular este passo.

## Passo 6 — Gerar o APK

```bash
eas build -p android --profile preview
```

- **O que faz:** envia o projeto para a nuvem do Expo e gera um **.apk**
  instalável. O perfil `preview` está configurado em `mobile/eas.json` com
  `distribution: internal` e `android.buildType: apk`, exatamente o que produz um
  APK (e não um `.aab`).
- **Onde:** terminal, na pasta `mobile/`.
- **Quando:** depois dos passos anteriores. Na primeira vez, o EAS pode perguntar
  se deve gerar um **keystore** de assinatura — aceite (responda `Y`); o Expo
  guarda e gerencia esse keystore para você.
- O build roda **na nuvem** e leva alguns minutos. Ao final, o terminal exibe um
  **link para baixar o .apk**.

> Para publicar na Google Play (arquivo `.aab`), use o perfil de produção:
> `eas build -p android --profile production`. Para gerar o APK instalável, fique
> no perfil `preview`.

## Passo 7 — Baixar o APK

Você tem duas formas de obter o arquivo:

1. **Pelo link do terminal:** ao terminar, o `eas build` imprime a URL do
   artefato. Abra-a para baixar o `.apk`.
2. **Pelo painel do Expo:** acesse [https://expo.dev](https://expo.dev), entre no
   seu projeto e abra a seção **Builds**. Clique no build concluído e use o botão
   de download do artefato.

## Passo 8 — Instalar o APK no celular

1. Transfira o arquivo `.apk` para o celular (por link, e-mail, cabo USB etc.).
2. No celular Android, habilite a instalação de **"fontes desconhecidas"**
   (ou "instalar apps desconhecidos") para o app usado para abrir o arquivo
   — normalmente o navegador ou o gerenciador de arquivos. A opção fica em
   **Configurações > Segurança** (ou **Apps > Acesso especial**), e varia conforme
   a versão do Android.
3. Toque no arquivo `.apk` e confirme a instalação.
4. Abra o aplicativo instalado.

## Nota sobre o back-end (servidor FastAPI)

O aplicativo é a parte **cliente** de um sistema distribuído: ele precisa de um
**servidor FastAPI** no ar para funcionar de ponta a ponta (regiões, medições,
relatórios e alertas vêm da API).

- **Sem um servidor remoto**, o app só consegue falar com o servidor **local**
  através do **emulador Android** (usando o padrão `http://10.0.2.2:8000` com o
  back-end rodando na sua máquina). Nesse caso, prefira rodar o app pelo emulador.
- **Para um APK em celular físico**, hospede o servidor em um endereço acessível
  (internet ou IP da LAN) e aponte `EXPO_PUBLIC_API_BASE_URL` para ele **antes**
  do build (Passo 5). As instruções para subir o servidor estão no `README.md` da
  raiz do repositório.

## Nota sobre o mapa (Google Maps no Android)

A tela de mapa usa `react-native-maps`, que no Android pode exigir uma **chave da
API do Google Maps** para renderizar o mapa. Essa chave **não é obrigatória** para
o APK **compilar**: sem ela, a tela de mapa cai automaticamente no **fallback de
lista** de regiões (já implementado), e a navegação continua funcionando.

Se, mais adiante, você quiser habilitar o mapa visual, a chave entraria no
`mobile/app.json`, dentro de `expo.android`, na seguinte estrutura (mostrada
apenas como referência — **não** comite nenhuma chave real no repositório):

```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "SUA_CHAVE_DO_GOOGLE_MAPS"
    }
  }
}
```
