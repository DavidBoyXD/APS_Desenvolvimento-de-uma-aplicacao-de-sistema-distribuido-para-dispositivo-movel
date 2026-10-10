# 2. Introducao

## 2.1 O problema

A cidade de Sao Paulo (SP) possui uma das maiores redes de transporte publico por
onibus do pais, operada pela SPTrans. Informacoes sobre a operacao da frota (linhas
monitoradas e veiculos em circulacao) existem e sao disponibilizadas oficialmente,
mas costumam exigir integracao tecnica e autenticacao, o que dificulta o acesso
rapido pelo cidadao comum, especialmente em mobilidade.

## 2.2 A proposta

Este trabalho propoe o **Monitor de Transporte Publico** com recorte em Sao Paulo,
um aplicativo movel que reune informacoes da frota de onibus por regiao, apoiado
por um servidor central que integra os dados da fonte oficial e organiza consultas,
relatorios e alertas. A ideia e oferecer, em uma unica tela inicial (um mapa
enquadrado na cidade de Sao Paulo), o ponto de partida para explorar cada regiao em
detalhe.

O fluxo basico de uso e:

1. O usuario abre o app e ve um **mapa** enquadrado em Sao Paulo com as regioes
   monitoradas (marcadores por latitude/longitude). Uma lista clicavel acompanha o
   mapa como alternativa.
2. Ao escolher uma regiao, ele ve as **medicoes** de transporte publico e pode
   acionar a atualizacao com dados da fonte (SPTrans Olho Vivo).
3. A partir da regiao, ele acessa um **relatorio** com agregacoes (media, minimo,
   maximo, contagem, ultima leitura) por parametro, resumidas em um grafico de
   barras.
4. Em uma tela dedicada, ele consulta e cria **regras de alerta** por limiar e
   avalia quais alertas disparam para uma regiao.

## 2.3 Por que e um sistema distribuido

Um sistema distribuido e um conjunto de componentes autonomos, em maquinas
distintas, que se coordenam por troca de mensagens em rede para o usuario ter a
impressao de um sistema unico (TANENBAUM; VAN STEEN, *Distributed Systems*).
Neste projeto:

- O **cliente movel** roda no dispositivo do usuario (emulador ou aparelho).
- O **servidor** (API REST) roda em outra maquina/processo e concentra a logica.
- O **banco de dados** persiste o estado do sistema.
- **Servicos externos** fornecem dados: SPTrans Olho Vivo (transporte publico) e
  IBGE (base geografica).

A comunicacao entre cliente e servidor usa **HTTP com payloads JSON** seguindo o
estilo **REST**. O servidor, por sua vez, autentica e consome o servico externo da
SPTrans, que exige **token**. Cada parte pode evoluir e escalar de forma
independente (por exemplo, trocar SQLite por PostgreSQL sem alterar o cliente). O
diagrama textual do fluxo esta em `04_plano_de_desenvolvimento.md`.

## 2.4 Fontes de dados e autoridades oficiais de Sao Paulo

O sistema usa fontes OFICIAIS do territorio nacional/paulistano, de onde os valores
sao efetivamente consumidos em runtime:

- **Transporte publico (fonte OFICIAL de SP, consumida):** SPTrans Olho Vivo
  ([https://www.sptrans.com.br/desenvolvedores/](https://www.sptrans.com.br/desenvolvedores/)).
  E a API oficial de monitoramento da frota de onibus da capital, operada pela
  SPTrans (Sao Paulo Transporte S/A, da Prefeitura de SP). Exige um **token
  gratuito** (ver `07_apresentacao_do_programa.md`). Com token, o servidor deriva
  metricas em tempo real (linhas monitoradas e veiculos em operacao); sem token,
  usa um fallback de exemplo (conjunto estatico de linhas de SP, no espirito dos
  dados GTFS da propria SPTrans), claramente rotulado como NAO tempo real.
- **Base geografica (fonte OFICIAL, consumida):** API de Localidades do **IBGE**
  ([https://servicodados.ibge.gov.br/api/v1/localidades](https://servicodados.ibge.gov.br/api/v1/localidades)),
  oficial, nacional e sem chave. O codigo da UF 35 identifica Sao Paulo; o
  endpoint lista os municipios de SP com `id` e `nome`, usados para validar o
  recorte geografico do sistema. As coordenadas dos distritos da capital vem de
  fontes oficiais da Prefeitura de Sao Paulo (GeoSampa/PMSP), nunca inventadas.
- Em todos os casos, o campo `fonte` de cada medicao registra explicitamente a
  origem do dado (ver `05_projeto_estrutura_e_modulos.md` e
  `06_relatorio_de_codigo.md`).

## 2.5 Organizacao do restante do documento

Os capitulos seguintes apresentam os fundamentos das tecnologias moveis
escolhidas (capitulo 3), o plano de desenvolvimento com ferramentas, versoes e o
diagrama do sistema distribuido (capitulo 4), o projeto com a estrutura de
diretorios e os modulos reais (capitulo 5), o relatorio comentando as linhas de
codigo mais relevantes e o mapeamento fonte -> arquivo/funcao (capitulo 6), o
roteiro de apresentacao do programa em funcionamento, incluindo o passo a passo do
token da SPTrans (capitulo 7), a bibliografia (capitulo 8) e a declaracao de uso de
IA (capitulo 9).
