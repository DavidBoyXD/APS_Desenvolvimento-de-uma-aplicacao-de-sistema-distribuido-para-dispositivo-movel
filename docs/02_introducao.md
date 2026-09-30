# 2. Introducao

## 2.1 O problema

As grandes cidades brasileiras convivem com problemas ambientais urbanos que se
sobrepoem: a **poluicao do ar** (material particulado como PM2.5 e PM10, alem de
gases como monoxido de carbono, dioxido de nitrogenio e ozonio), os
**congestionamentos de transito** e os **alagamentos** em periodos de chuva. Essas
informacoes existem, mas costumam estar dispersas em diferentes portais, formatos
e escalas, o que dificulta o acesso rapido pelo cidadao comum, especialmente em
mobilidade.

## 2.2 A proposta

Este trabalho propoe o **Monitor Ambiental Urbano**, um aplicativo movel que reune
essas informacoes por regiao, apoiado por um servidor central que integra dados
reais e organiza consultas, relatorios e alertas. A ideia e oferecer, em uma unica
tela inicial (um mapa com as regioes), o ponto de partida para explorar cada
regiao em detalhe.

O fluxo basico de uso e:

1. O usuario abre o app e ve um **mapa** com as regioes monitoradas (marcadores
   por latitude/longitude). Uma lista clicavel acompanha o mapa como alternativa.
2. Ao escolher uma regiao, ele ve as **medicoes** agrupadas por tipo (qualidade
   do ar, transito, alagamento) e pode acionar a **atualizacao da qualidade do ar**
   com dados reais da Open-Meteo.
3. A partir da regiao, ele acessa um **relatorio** com agregacoes (media, minimo,
   maximo, contagem, ultima leitura) por parametro.
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
- **Servicos externos** fornecem dados reais: Open-Meteo Air Quality API
  (qualidade do ar), Overpass API do OpenStreetMap (transito) e Open-Meteo Flood
  API / GloFAS (alagamento).

A comunicacao entre cliente e servidor usa **HTTP com payloads JSON** seguindo o
estilo **REST**. Cada parte pode evoluir e escalar de forma independente (por
exemplo, trocar SQLite por PostgreSQL sem alterar o cliente). O diagrama textual
do fluxo esta em `04_plano_de_desenvolvimento.md`.

## 2.4 Fontes de dados

- **Qualidade do ar (dados reais):** Open-Meteo Air Quality API
  ([https://open-meteo.com/en/docs/air-quality-api](https://open-meteo.com/en/docs/air-quality-api)),
  publica, gratuita e sem chave de API, baseada em modelos de qualidade do ar do
  programa Copernicus/CAMS. Foi escolhida por ser comprovavel e de facil acesso.
- **Alternativa considerada (OpenAQ):**
  ([https://openaq.org](https://openaq.org)) agrega dados de estacoes oficiais,
  porem a versao atual da API exige chave de acesso (X-API-Key). Por isso NAO foi
  usada como fonte primaria, mas fica registrada como fonte relevante.
- **Transito (dados reais):** Overpass API do OpenStreetMap
  ([https://wiki.openstreetmap.org/wiki/Overpass_API](https://wiki.openstreetmap.org/wiki/Overpass_API)),
  gratuita e sem chave, de onde o servidor deriva metricas reais de
  infraestrutura viaria (numero de vias principais, media de faixas e media de
  velocidade maxima). Os dados do OpenStreetMap sao publicados sob a licenca ODbL
  ([https://www.openstreetmap.org/copyright](https://www.openstreetmap.org/copyright)).
- **Alagamento (dados reais):** Open-Meteo Flood API
  ([https://open-meteo.com/en/docs/flood-api](https://open-meteo.com/en/docs/flood-api)),
  gratuita e sem chave, com base cientifica no GloFAS (Global Flood Awareness
  System, do programa Copernicus). O servidor obtem a descarga fluvial
  (`river_discharge`, em m3/s) da regiao e dela deriva metricas reais (descarga
  atual, media e maxima do periodo), indicador reconhecido de risco de cheia.
- Em todos os casos, o campo `fonte` de cada medicao registra explicitamente a
  origem real do dado. As medicoes criadas pelo seed sao apenas valores iniciais
  de exemplo, substituiveis pelas fontes reais por meio dos endpoints de
  atualizacao (ver `05_projeto_estrutura_e_modulos.md` e `06_relatorio_de_codigo.md`).

## 2.5 Organizacao do restante do documento

Os capitulos seguintes apresentam os fundamentos das tecnologias moveis
escolhidas (capitulo 3), o plano de desenvolvimento com ferramentas, versoes e o
diagrama do sistema distribuido (capitulo 4), o projeto com a estrutura de
diretorios e os modulos reais (capitulo 5), o relatorio comentando as linhas de
codigo mais relevantes (capitulo 6), o roteiro de apresentacao do programa em
funcionamento (capitulo 7), a bibliografia (capitulo 8) e a declaracao de uso de
IA (capitulo 9).
