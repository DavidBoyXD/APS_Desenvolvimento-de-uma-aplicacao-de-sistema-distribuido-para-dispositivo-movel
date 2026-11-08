/**
 * Tela de CONSENTIMENTO (LGPD) exibida na primeira abertura do app (ou quando a
 * versão dos Termos muda). Apresenta um resumo honesto, dá acesso à Política de
 * Privacidade e aos Termos de Uso, e oferece:
 *   - um CHECKBOX obrigatório de aceite dos Termos e da Política;
 *   - um CHECKBOX OPCIONAL e separado de consentimento de localização (GPS)
 *     para o "Você está aqui" no mapa (recusar não impede o uso do app);
 *   - botões ACEITAR (habilitado só com o aceite marcado) e RECUSAR.
 *
 * RN não tem checkbox nativo: o checkbox é implementado com Pressable + estado.
 * NENHUMA permissão/coleta de localização é acionada aqui — o consentimento é
 * apenas registrado localmente. ACEITAR grava o RegistroConsentimento; RECUSAR
 * registra o não-aceite e NÃO trava o app (o usuário segue sem o "Você está
 * aqui"). Ao concluir, chama `route.params.aoConcluir` para o gate em App.tsx
 * liberar a navegação principal.
 *
 * Referências:
 *   - Pressable: https://reactnative.dev/docs/pressable
 *   - ScrollView: https://reactnative.dev/docs/scrollview
 *
 * Onde é aplicado: rota "Consentimento" (gate) em App.tsx.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation';
import {
  RegistroConsentimento,
  VERSAO_TERMOS,
  salvarConsentimento,
} from '../ui/consentimento';

type Props = NativeStackScreenProps<RootStackParamList, 'Consentimento'>;

/** E-mail do encarregado (DPO) / canal de contato de privacidade. */
const EMAIL_ENCARREGADO = 'daviddeziderio07@gmail.com';

/**
 * Caixa de seleção simples (RN não tem checkbox nativo): Pressable com um
 * indicador visual marcado/desmarcado e um rótulo ao lado.
 */
function Caixa({
  marcada,
  aoAlternar,
  rotulo,
}: {
  marcada: boolean;
  aoAlternar: () => void;
  rotulo: string;
}) {
  return (
    <Pressable
      style={styles.caixaLinha}
      onPress={aoAlternar}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
    >
      <View style={[styles.caixa, marcada && styles.caixaMarcada]}>
        {marcada ? <Text style={styles.caixaCheck}>✓</Text> : null}
      </View>
      <Text style={styles.caixaRotulo}>{rotulo}</Text>
    </Pressable>
  );
}

export default function ConsentimentoScreen({ navigation, route }: Props) {
  const aoConcluir = route.params?.aoConcluir;
  const [aceitouTermos, setAceitouTermos] = useState<boolean>(false);
  const [consentiuLocalizacao, setConsentiuLocalizacao] =
    useState<boolean>(false);

  const concluir = async (aceitou: boolean) => {
    const registro: RegistroConsentimento = {
      versaoTermos: VERSAO_TERMOS,
      aceitouTermos: aceitou,
      // Só faz sentido registrar consentimento de localização junto do aceite.
      consentiuLocalizacao: aceitou ? consentiuLocalizacao : false,
      timestamp: new Date().toISOString(),
    };
    await salvarConsentimento(registro);
    if (aoConcluir) {
      aoConcluir();
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.conteudo}
    >
      <Text style={styles.titulo}>Antes de começar</Text>
      <Text style={styles.paragrafo}>
        Este aplicativo acadêmico mostra informações de transporte público de São
        Paulo. Ele não tem conta nem login, não usa rastreadores ou cookies de
        terceiros e não coleta dados em servidor.
      </Text>
      <Text style={styles.paragrafo}>
        O único dado pessoal possível é a sua localização (GPS), usada apenas no
        seu aparelho para o "Você está aqui" no mapa, nunca enviada a servidores.
        Você decide se quer ativá-la — e pode usar o app sem ela.
      </Text>

      <View style={styles.links}>
        <Pressable
          style={styles.linkBotao}
          onPress={() => navigation.navigate('PoliticaPrivacidade')}
          accessibilityRole="button"
        >
          <Text style={styles.linkTexto}>Ler a Política de Privacidade</Text>
        </Pressable>
        <Pressable
          style={styles.linkBotao}
          onPress={() => navigation.navigate('TermosDeUso')}
          accessibilityRole="button"
        >
          <Text style={styles.linkTexto}>Ler os Termos de Uso</Text>
        </Pressable>
      </View>

      <Caixa
        marcada={aceitouTermos}
        aoAlternar={() => setAceitouTermos((v) => !v)}
        rotulo="Li e aceito os Termos de Uso e a Política de Privacidade."
      />
      <Caixa
        marcada={consentiuLocalizacao}
        aoAlternar={() => setConsentiuLocalizacao((v) => !v)}
        rotulo={
          'Permitir usar minha localização para o "Você está aqui" (opcional; ' +
          'recusar não impede o uso do app).'
        }
      />

      <Pressable
        style={[styles.botaoAceitar, !aceitouTermos && styles.botaoDesabilitado]}
        onPress={() => concluir(true)}
        disabled={!aceitouTermos}
        accessibilityRole="button"
        accessibilityState={{ disabled: !aceitouTermos }}
      >
        <Text style={styles.botaoAceitarTexto}>ACEITAR</Text>
      </Pressable>
      <Pressable
        style={styles.botaoRecusar}
        onPress={() => concluir(false)}
        accessibilityRole="button"
      >
        <Text style={styles.botaoRecusarTexto}>RECUSAR</Text>
      </Pressable>

      <Text style={styles.rodape}>
        Ao recusar, você continua usando a lista de linhas, a busca e o mapa, sem
        o "Você está aqui". Dúvidas: {EMAIL_ENCARREGADO}.
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
    gap: 12,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0B6E4F',
  },
  paragrafo: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  links: {
    gap: 8,
    marginVertical: 4,
  },
  linkBotao: {
    backgroundColor: '#E8F3EE',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  linkTexto: {
    color: '#0B6E4F',
    fontWeight: '600',
    fontSize: 14,
  },
  caixaLinha: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  caixa: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#0B6E4F',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  caixaMarcada: {
    backgroundColor: '#0B6E4F',
  },
  caixaCheck: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 18,
  },
  caixaRotulo: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  botaoAceitar: {
    backgroundColor: '#0B6E4F',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  botaoDesabilitado: {
    backgroundColor: '#A7C7BA',
  },
  botaoAceitarTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  botaoRecusar: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0B6E4F',
    backgroundColor: '#FFFFFF',
  },
  botaoRecusarTexto: {
    color: '#0B6E4F',
    fontWeight: '700',
    fontSize: 16,
  },
  rodape: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    lineHeight: 18,
  },
});
