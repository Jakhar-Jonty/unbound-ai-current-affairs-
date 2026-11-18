import { Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useTheme, spacing } from '../theme';
import { useT } from '../lib/i18n';
import { T } from './ui';

const LEGAL = Constants.expoConfig?.extra?.legal || {};

/** Opens a legal page (in Hindi when the app is in Hindi). */
export function openLegal(key, lang) {
  const url = LEGAL[key];
  if (url) WebBrowser.openBrowserAsync(lang === 'hi' ? `${url}?lang=hi` : url);
}

function Link({ k, children }) {
  const c = useTheme();
  const { lang } = useT();
  return (
    <Text accessibilityRole="link" onPress={() => openLegal(k, lang)} style={{ color: c.text, textDecorationLine: 'underline' }}>{children}</Text>
  );
}

/** "Privacy Policy · Terms of Use" row, or the sign-up consent sentence with `consent`. */
export default function LegalLinks({ consent, style }) {
  const { t } = useT();
  if (consent) {
    return (
      <T variant="caption" color="textSecondary" style={[{ textAlign: 'center', marginTop: spacing.md }, style]}>
        {t('legal.consentA')}<Link k="terms">{t('legal.terms')}</Link>{t('legal.consentB')}<Link k="privacy">{t('legal.privacy')}</Link>{t('legal.consentC')}
      </T>
    );
  }
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.md }, style]}>
      <T variant="caption" color="textSecondary"><Link k="privacy">{t('legal.privacy')}</Link></T>
      <T variant="caption" color="textSecondary"><Link k="terms">{t('legal.terms')}</Link></T>
    </View>
  );
}
