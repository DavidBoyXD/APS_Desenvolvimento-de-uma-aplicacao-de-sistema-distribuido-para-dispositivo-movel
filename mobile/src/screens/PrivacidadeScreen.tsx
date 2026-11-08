/**
 * Tela de PRIVACIDADE / Direitos do titular (LGPD).
 *
 * Objetivo: permitir que a pessoa EXERÇA, no próprio aparelho, os direitos de
 * ACESSO, EXCLUSÃO e REVOGAÇÃO sobre os dados que o app guarda LOCALMENTE.
 * O app não tem conta/login e não guarda dados pessoais no servidor; por isso
 * o acesso e a exclusão operam sobre o AsyncStorage do dispositivo.
 *
 * A tela oferece:
 *   1. ACESSO — lista de forma legível o que está guardado no aparelho:
 *      favoritos de linhas (carregarFavoritosLinhas) e o registro de
 *      consentimento (carregarConsentimento: versão aceita, data/hora e as
 *      escolhas). Indica o e-mail do encarregado e dá acesso à Política e aos
 *      Termos.
 *   2. EXCLUSÃO — botão "Excluir meus dados" com confirmação via Alert.alert;
 *      ao confirmar, chama a limpeza REAL do AsyncStorage (limparFavoritosLinhas
 *      + limparConsentimento) e atualiza a UI (contagens zeradas).
 *   3. REVOGAÇÃO — revoga o consentimento de localização (salvarConsentimento
 *      com consentiuLocalizacao=false, mantendo o aceite dos Termos); o
 *      "Você está aqui" deixa de ser oferecido.
 *
 * Referências:
 *   - Alert: https://reactnative.dev/docs/alert
 *   - ScrollView: https://reactnative.dev/docs/scrollview
 *
 * Onde é aplicado: rota "Privacidade" em App.tsx, acessível a partir da tela
 * inicial (botão no cabeçalho de src/screens/MapaScreen.tsx).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation';
import {
  LinhaFavorita,
  carregarFavoritosLinhas,
  limparFavoritosLinhas,
} from '../ui/favoritos';
import {
  RegistroConsentimento,
  carregarConsentimento,
  limparConsentimento,
  salvarConsentimento,
} from '../ui/consentimento';

type Props = NativeStackScreenProps<RootStackParamList, 'Privacidade'>;

/** E-mail do encarregado (DPO) / canal de contato de privacidade. */
const EMAIL_ENCARREGADO = 'daviddeziderio07@gmail.com';

/** Formata um timestamp ISO em texto legível (fallback para o próprio valor). */
function formatarData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return iso;
  }
  return data.toLocaleString('pt-BR');
}

export default function PrivacidadeScreen({ navigation }: Props) {
  const [favoritos, setFavoritos] = useState<LinhaFavorita[]>([]);
  const [consentimento, setConsentimento] =
    useState<RegistroConsentimento | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const [listaFavoritos, registro] = await Promise.all([
      carregarFavoritosLinhas(),
      carregarConsentimento(),
    ]);
    setFavoritos(listaFavoritos);
    setConsentimento(registro);
    setCarregando(false);
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // EXCLUSÃO: confirma e, ao aceitar, limpa DE FATO o AsyncStorage.
  const excluirDados = useCallback(() => {
    Alert.alert(
      'Excluir meus dados',
      'Isto apaga do aparelho os seus favoritos e o registro de consentimento. ' +
        'Na próxima abertura, o aviso de consentimento será exibido novamente. ' +
        'Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await Promise.all([
              limparFavoritosLinhas(),
              limparConsentimento(),
            ]);
            await recarregar();
            Alert.alert(
              'Dados excluídos',
              'Seus dados locais foram apagados deste aparelho.',
            );
          },
        },
      ],
    );
  }, [recarregar]);

  // REVOGAÇÃO: desliga o consentimento de localização, mantendo o aceite dos
  // Termos. Só faz sentido se já houver um registro de consentimento.
  const revogarLocalizacao = useCallback(() => {
    if (!consentimento) {
      return;
    }
    Alert.alert(
      'Revogar localização',
      'O "Você está aqui" deixará de ser oferecido no mapa. Seu aceite dos ' +
        'Termos e da Política continua válido.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revogar',
          onPress: async () => {
            const atualizado: RegistroConsentimento = {
              ...consentimento,
              consentiuLocalizacao: false,
              timestamp: new Date().toISOString(),
            };
            await salvarConsentimento(atualizado);
            await recarregar();
            Alert.alert(
              'Localização revogada',
              'O "Você está aqui" não será mais oferecido.',
            );
          },
        },
      ],
    );
  }, [consentimento, recarregar]);

  const temFavoritos = favoritos.length > 0;
  const podeRevogar =
    !!consentimento && consentimento.consentiuLocalizacao === true;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.conteudo}
    >
      <Text style={styles.titulo}>Seus dados e sua privacidade</Text>
      <Text style={styles.paragrafo}>
        Este aplicativo acadêmico não tem conta nem login e não guarda dados
        pessoais em servidor. Os dados abaixo ficam somente NESTE APARELHO, e o
        acesso e a exclusão operam sobre o armazenamento local do dispositivo.
      </Text>

      {/* ACESSO: favoritos guardados no aparelho. */}
      <View style={styles.cartao}>
        <Text style={styles.cartaoTitulo}>Favoritos de linhas</Text>
        {carregando ? (
          <Text style={styles.paragrafo}>Carregando...</Text>
        ) : temFavoritos ? (
          <>
            <Text style={styles.paragrafo}>
              {favoritos.length}{' '}
              {favoritos.length === 1
                ? 'linha favoritada'
                : 'linhas favoritadas'}
              :
            </Text>
            {favoritos.map((item) => (
              <Text key={item.letreiro} style={styles.itemLista}>
                • {item.letreiro} ({item.terminal_principal} ↔{' '}
                {item.terminal_secundario})
              </Text>
            ))}
          </>
        ) : (
          <Text style={styles.paragrafo}>
            Nenhuma linha favoritada neste aparelho.
          </Text>
        )}
      </View>

      {/* ACESSO: registro de consentimento guardado no aparelho. */}
      <View style={styles.cartao}>
        <Text style={styles.cartaoTitulo}>Registro de consentimento</Text>
        {carregando ? (
          <Text style={styles.paragrafo}>Carregando...</Text>
        ) : consentimento ? (
          <>
            <Text style={styles.itemLista}>
              • Versão dos Termos/Política aceita: {consentimento.versaoTermos}
            </Text>
            <Text style={styles.itemLista}>
              • Termos e Política:{' '}
              {consentimento.aceitouTermos ? 'aceitos' : 'recusados'}
            </Text>
            <Text style={styles.itemLista}>
              • Localização (GPS):{' '}
              {consentimento.consentiuLocalizacao
                ? 'permitida'
                : 'não permitida'}
            </Text>
            <Text style={styles.itemLista}>
              • Data/hora do registro: {formatarData(consentimento.timestamp)}
            </Text>
          </>
        ) : (
          <Text style={styles.paragrafo}>
            Nenhum registro de consentimento guardado neste aparelho.
          </Text>
        )}
      </View>

      {/* REVOGAÇÃO do consentimento de localização. */}
      <View style={styles.cartao}>
        <Text style={styles.cartaoTitulo}>Revogar localização</Text>
        <Text style={styles.paragrafo}>
          Você pode revogar o consentimento de localização sem apagar os demais
          dados. Ao revogar, o "Você está aqui" deixa de ser oferecido no mapa;
          seu aceite dos Termos continua válido.
        </Text>
        <Pressable
          style={[styles.botaoSecundario, !podeRevogar && styles.botaoDesabilitado]}
          onPress={revogarLocalizacao}
          disabled={!podeRevogar}
          accessibilityRole="button"
          accessibilityState={{ disabled: !podeRevogar }}
        >
          <Text style={styles.botaoSecundarioTexto}>
            {podeRevogar
              ? 'Revogar consentimento de localização'
              : 'Localização não está permitida'}
          </Text>
        </Pressable>
      </View>

      {/* EXCLUSÃO de todos os dados locais. */}
      <View style={styles.cartao}>
        <Text style={styles.cartaoTitulo}>Excluir meus dados</Text>
        <Text style={styles.paragrafo}>
          Apaga do aparelho os seus favoritos e o registro de consentimento. Na
          próxima abertura, o aviso de consentimento será exibido novamente.
        </Text>
        <Pressable
          style={styles.botaoExcluir}
          onPress={excluirDados}
          accessibilityRole="button"
        >
          <Text style={styles.botaoExcluirTexto}>Excluir meus dados</Text>
        </Pressable>
      </View>

      {/* Links para os documentos e contato do encarregado. */}
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

      <Text style={styles.rodape}>
        Para solicitações adicionais sobre seus dados ou dúvidas de privacidade,
        fale com o encarregado: {EMAIL_ENCARREGADO}.
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
  cartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  cartaoTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  itemLista: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  botaoSecundario: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0B6E4F',
    backgroundColor: '#FFFFFF',
    marginTop: 4,
  },
  botaoSecundarioTexto: {
    color: '#0B6E4F',
    fontWeight: '700',
    fontSize: 14,
  },
  botaoDesabilitado: {
    borderColor: '#A7C7BA',
    opacity: 0.6,
  },
  botaoExcluir: {
    backgroundColor: '#B91C1C',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  botaoExcluirTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
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
  rodape: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    lineHeight: 18,
  },
});
