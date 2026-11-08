/**
 * Tela de Termos de Uso: renderiza o resumo dos termos de uso do aplicativo em
 * texto legível, usando ScrollView + Text (SEM WebView), para abrir em qualquer
 * plataforma sem depender de módulo nativo.
 *
 * O conteúdo é mantido em sincronia com docs/13_termos_de_uso.md (documento
 * completo): objeto, uso aceitável, isenção de garantias sobre dados de
 * terceiros, limitação de responsabilidade, propriedade intelectual/atribuições
 * (OpenStreetMap, Leaflet, SPTrans, IBGE), foro e aviso acadêmico.
 *
 * Referências:
 *   - ScrollView: https://reactnative.dev/docs/scrollview
 *
 * Onde é aplicado: rota "TermosDeUso" em App.tsx (acessível pela tela de
 * Consentimento e, futuramente, por um menu de configurações).
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation';
import { VERSAO_TERMOS } from '../ui/consentimento';

type Props = NativeStackScreenProps<RootStackParamList, 'TermosDeUso'>;

/** Canal de contato para dúvidas sobre os Termos. */
const EMAIL_CONTATO = 'daviddeziderio07@gmail.com';

export default function TermosDeUsoScreen(_props: Props) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.conteudo}
    >
      <Text style={styles.titulo}>Termos de Uso</Text>
      <Text style={styles.meta}>
        Versão {VERSAO_TERMOS} · Contato: David Andrew ({EMAIL_CONTATO})
      </Text>

      <View style={styles.aviso}>
        <Text style={styles.avisoTexto}>
          Projeto ACADÊMICO (APS/UNIP), não é serviço oficial da SPTrans. Este
          documento não constitui aconselhamento jurídico.
        </Text>
      </View>

      <Text style={styles.secao}>1. Objeto</Text>
      <Text style={styles.paragrafo}>
        O aplicativo exibe informações de transporte público de São Paulo
        (posição de ônibus, previsões e regiões) com fins educacionais e de
        demonstração. Ao usá-lo, você concorda com estes Termos e com a Política
        de Privacidade.
      </Text>

      <Text style={styles.secao}>2. Uso aceitável</Text>
      <Text style={styles.paragrafo}>
        Use o aplicativo de forma lícita e de boa-fé, sem sobrecarregar ou
        explorar os serviços de terceiros (SPTrans, IBGE, OpenStreetMap) e sem
        redistribuir dados em desacordo com as licenças daquelas fontes.
      </Text>

      <Text style={styles.secao}>3. Isenção de garantias</Text>
      <Text style={styles.paragrafo}>
        Os dados de terceiros podem estar indisponíveis, atrasados ou incorretos.
        O serviço da SPTrans em tempo real pode falhar; sem token configurado no
        servidor, são exibidos dados de EXEMPLO, claramente sinalizados. O
        aplicativo é fornecido "no estado em que se encontra", sem garantias.
      </Text>

      <Text style={styles.secao}>4. Limitação de responsabilidade</Text>
      <Text style={styles.paragrafo}>
        Por ser trabalho acadêmico sem fins lucrativos, o autor não se
        responsabiliza por perdas ou danos decorrentes do uso ou da
        indisponibilidade do aplicativo ou dos dados de terceiros, na máxima
        extensão permitida pela lei.
      </Text>

      <Text style={styles.secao}>5. Propriedade intelectual e atribuições</Text>
      <Text style={styles.paragrafo}>
        • OpenStreetMap: tiles e dados do mapa (© colaboradores do OpenStreetMap;
        dados sob licença ODbL).
      </Text>
      <Text style={styles.paragrafo}>
        • Leaflet: biblioteca de mapas (licença BSD-2-Clause).
      </Text>
      <Text style={styles.paragrafo}>
        • SPTrans Olho Vivo e IBGE: dados públicos oficiais, usados conforme os
        termos de cada fonte.
      </Text>

      <Text style={styles.secao}>6. Foro</Text>
      <Text style={styles.paragrafo}>
        Fica eleito o foro da comarca de São Paulo/SP, observada a natureza
        acadêmica e não comercial do projeto.
      </Text>

      <Text style={styles.secao}>7. Contato</Text>
      <Text style={styles.paragrafo}>
        Dúvidas sobre estes Termos: {EMAIL_CONTATO} (David Andrew).
      </Text>

      <Text style={styles.rodape}>
        O texto completo está no documento docs/13_termos_de_uso.md do projeto.
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
