/**
 * Tela de Política de Privacidade (LGPD): renderiza o resumo da política de
 * privacidade do aplicativo em texto legível, usando ScrollView + Text (SEM
 * WebView), para abrir em qualquer plataforma sem depender de módulo nativo.
 *
 * O conteúdo é mantido em sincronia com docs/12_politica_de_privacidade.md
 * (documento completo). Esta tela traz um resumo honesto: o app não tem conta,
 * não usa rastreadores/cookies de terceiros; o único dado pessoal é a
 * localização (GPS), usada só no dispositivo e nunca enviada a servidores.
 *
 * Referências:
 *   - ScrollView: https://reactnative.dev/docs/scrollview
 *
 * Onde é aplicado: rota "PoliticaPrivacidade" em App.tsx (acessível pela tela
 * de Consentimento e, futuramente, por um menu de configurações).
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation';
import { VERSAO_TERMOS } from '../ui/consentimento';

type Props = NativeStackScreenProps<RootStackParamList, 'PoliticaPrivacidade'>;

/** E-mail do encarregado (DPO) / canal de contato de privacidade. */
const EMAIL_ENCARREGADO = 'daviddeziderio07@gmail.com';

export default function PoliticaPrivacidadeScreen(_props: Props) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.conteudo}
    >
      <Text style={styles.titulo}>Política de Privacidade</Text>
      <Text style={styles.meta}>
        Versão {VERSAO_TERMOS} · Encarregado: David Andrew ({EMAIL_ENCARREGADO})
      </Text>

      <View style={styles.aviso}>
        <Text style={styles.avisoTexto}>
          Projeto ACADÊMICO (APS/UNIP), não é serviço oficial da SPTrans. Este
          documento não constitui aconselhamento jurídico.
        </Text>
      </View>

      <Text style={styles.secao}>Resumo honesto</Text>
      <Text style={styles.paragrafo}>
        O aplicativo não tem conta, login ou cadastro. Não há analytics,
        rastreadores de terceiros nem cookies de rastreamento. O único dado
        pessoal que pode ser tratado é a sua localização (GPS), e somente se você
        consentir.
      </Text>

      <Text style={styles.secao}>Como tratamos a localização (GPS)</Text>
      <Text style={styles.paragrafo}>
        A localização é usada em tempo real, apenas no seu aparelho, para mostrar
        o "Você está aqui" no mapa. Ela não é transmitida nem armazenada em
        nenhum servidor e é descartada ao sair da tela do mapa. Base legal:
        consentimento (art. 7º, I, da LGPD). Nenhuma permissão de localização é
        solicitada antes do seu aceite.
      </Text>

      <Text style={styles.secao}>Dados guardados no seu aparelho</Text>
      <Text style={styles.paragrafo}>
        Suas linhas favoritas, preferências de interface e o registro de
        consentimento (versão e data/hora do aceite) ficam somente no
        armazenamento local do dispositivo, até você excluí-los ou revogar o
        consentimento.
      </Text>

      <Text style={styles.secao}>Tabela de retenção</Text>
      <Text style={styles.paragrafo}>
        • Localização (GPS): memória volátil no dispositivo, durante o uso do
        mapa; não persistida — base legal: consentimento.
      </Text>
      <Text style={styles.paragrafo}>
        • Linhas favoritas e preferências: armazenamento local; até a exclusão
        pelo usuário — base legal: execução a pedido / legítimo interesse.
      </Text>
      <Text style={styles.paragrafo}>
        • Registro de consentimento: armazenamento local; até a revogação ou
        exclusão — base legal: consentimento / responsabilização.
      </Text>

      <Text style={styles.secao}>Serviços de terceiros</Text>
      <Text style={styles.paragrafo}>
        O mapa usa tiles do OpenStreetMap (© colaboradores do OpenStreetMap). Os
        dados de transporte vêm da SPTrans Olho Vivo e do IBGE, e não são seus
        dados pessoais.
      </Text>

      <Text style={styles.secao}>Seus direitos (art. 18 da LGPD)</Text>
      <Text style={styles.paragrafo}>
        Você pode acessar, corrigir, excluir e portar seus dados, além de revogar
        o consentimento a qualquer momento. Como os dados são locais, a maior
        parte é exercida no próprio aparelho (removendo favoritos, limpando os
        dados do app ou reinstalando). Para solicitações adicionais, use o
        e-mail do encarregado.
      </Text>

      <Text style={styles.secao}>Contato do encarregado</Text>
      <Text style={styles.paragrafo}>
        David Andrew — {EMAIL_ENCARREGADO}
      </Text>

      <Text style={styles.rodape}>
        O texto completo está no documento docs/12_politica_de_privacidade.md do
        projeto.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6',
  },
  conteudo: {
    padding: 20,
    gap: 10,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0B6E4F',
  },
  meta: {
    fontSize: 12,
    color: '#64748B',
  },
  aviso: {
    backgroundColor: '#E8F3EE',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  avisoTexto: {
    fontSize: 13,
    color: '#0B6E4F',
  },
  secao: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
  },
  paragrafo: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  rodape: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
