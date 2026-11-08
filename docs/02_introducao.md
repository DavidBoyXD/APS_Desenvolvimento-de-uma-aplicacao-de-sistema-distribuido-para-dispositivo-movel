# 2. Introdução

## 2.1 O problema

A cidade de São Paulo (SP) possui uma das maiores redes de transporte público por
ônibus do país, operada pela SPTrans. Informações sobre a operação da frota (linhas
monitoradas e veículos em circulação) existem e são disponibilizadas oficialmente,
mas costumam exigir integração técnica e autenticação, o que dificulta o acesso
rápido pelo cidadão comum, especialmente em mobilidade.

## 2.2 A proposta

Este trabalho propõe o **Monitoramento de transporte público em SP**, um
aplicativo móvel que reúne informações da frota de ônibus por região, apoiado por
um servidor central que integra os dados da fonte oficial e organiza consultas,
relatórios e alertas. A ideia é oferecer, em uma única tela inicial (uma lista das
regiões monitoradas em São Paulo), o ponto de partida para explorar cada região em
detalhe.

Além do núcleo, o aplicativo incorpora funções extras que valorizam o refinamento
pedido pela APS: um mapa visual (WebView + Leaflet + OpenStreetMap) com busca
integrada, busca livre de linhas e paradas com correspondência aproximada (fuzzy),
favoritos de linhas salvos localmente, atualização automática da posição dos
veículos (10/15/30s) e o recurso "Você está aqui" (GPS) condicionado ao
consentimento. O tratamento de dados pessoais segue a LGPD (Lei nº 13.709/2018),
com consentimento explícito, Política de Privacidade, Termos de Uso e uma tela de
Privacidade para acesso e exclusão dos dados guardados no aparelho.

O fluxo básico de uso é:

1. O usuário abre o app e vê a **lista** das regiões monitoradas em São Paulo. Cada
   item traz nome, cidade/UF e as coordenadas (latitude/longitude) da região.
2. Ao escolher uma região, ele vê as **medições** de transporte público e pode
   acionar a atualização com dados da fonte (SPTrans Olho Vivo).
3. A partir da região, ele acessa um **relatório** com agregações (média, mínimo,
   máximo, contagem, última leitura) por parâmetro, resumidas em um gráfico de
   barras.
4. Em uma tela dedicada, ele consulta e cria **regras de alerta** por limiar e
   avalia quais alertas disparam para uma região.

## 2.3 Por que é um sistema distribuído

Um sistema distribuído é um conjunto de componentes autônomos, em máquinas
distintas, que se coordenam por troca de mensagens em rede para o usuário ter a
impressão de um sistema único (TANENBAUM; VAN STEEN, *Distributed Systems*).
Neste projeto:

- O **cliente móvel** roda no dispositivo do usuário (emulador ou aparelho).
- O **servidor** (API REST) roda em outra máquina/processo e concentra a lógica.
- O **banco de dados** persiste o estado do sistema.
- **Serviços externos** fornecem dados: SPTrans Olho Vivo (transporte público) e
  IBGE (base geográfica).

A comunicação entre cliente e servidor usa **HTTP com payloads JSON** seguindo o
estilo **REST**. O servidor, por sua vez, autentica e consome o serviço externo da
SPTrans, que exige **token**. Cada parte pode evoluir e escalar de forma
independente (por exemplo, trocar SQLite por PostgreSQL sem alterar o cliente). O
diagrama textual do fluxo está em `04_plano_de_desenvolvimento.md`.

## 2.4 Fontes de dados e autoridades oficiais de São Paulo

O sistema usa fontes OFICIAIS do território nacional/paulistano, de onde os valores
são efetivamente consumidos em runtime:

- **Transporte público (fonte OFICIAL de SP, consumida):** SPTrans Olho Vivo
  ([https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/)).
  É a API oficial de monitoramento da frota de ônibus da capital, operada pela
  SPTrans (São Paulo Transporte S/A, da Prefeitura de SP). Exige um **token
  gratuito** (ver `07_apresentacao_do_programa.md`). Com token, o servidor deriva
  métricas em tempo real (linhas monitoradas e veículos em operação); sem token,
  usa um fallback de exemplo (conjunto estático de linhas de SP, no espírito dos
  dados GTFS da própria SPTrans), claramente rotulado como NÃO tempo real.
- **Base geográfica (fonte OFICIAL, consumida):** API de Localidades do **IBGE**
  ([https://servicodados.ibge.gov.br/api/v1/localidades](https://servicodados.ibge.gov.br/api/v1/localidades)),
  oficial, nacional e sem chave. O código da UF 35 identifica São Paulo; o
  endpoint lista os municípios de SP com `id` e `nome`, usados para validar o
  recorte geográfico do sistema. As coordenadas dos distritos da capital vêm de
  fontes oficiais da Prefeitura de São Paulo (GeoSampa/PMSP), nunca inventadas.
- Em todos os casos, o campo `fonte` de cada medição registra explicitamente a
  origem do dado (ver `05_projeto_estrutura_e_modulos.md` e
  `06_relatorio_de_codigo.md`).

## 2.5 Organização do restante do documento

Os capítulos seguintes apresentam os fundamentos das tecnologias móveis
escolhidas (capítulo 3), o plano de desenvolvimento com ferramentas, versões e o
diagrama do sistema distribuído (capítulo 4), o projeto com a estrutura de
diretórios e os módulos reais (capítulo 5), o relatório comentando as linhas de
código mais relevantes e o mapeamento fonte -> arquivo/função (capítulo 6), o
roteiro de apresentação do programa em funcionamento, incluindo o passo a passo do
token da SPTrans (capítulo 7), a bibliografia (capítulo 8) e a declaração de uso de
IA (capítulo 9). Completam o conjunto a capa e a ficha de APS (documento 10) e os
documentos complementares de licenças e atribuições (11), Política de Privacidade
(12) e Termos de Uso (13), que sustentam a conformidade com a LGPD.
