import { Pressable, RefreshControl, Switch, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useAuth } from '../../lib/auth';
import { useProgress, useTaxonomy } from '../../lib/queries';
import { useTheme, spacing } from '../../theme';
import { subjectLabel } from '../../components/ArticleCard';
import SignInPrompt from '../../components/SignInPrompt';
import VerifyEmailBanner from '../../components/VerifyEmailBanner';
import LanguageSwitch from '../../components/LanguageSwitch';
import { formatDate, shortName } from '../../lib/format';
import { useMySubjects } from '../../lib/subjects-pref';
import { useT } from '../../lib/i18n';
import { Button, Card, Divider, ErrorView, Loading, ProgressBar, Screen, SectionTitle, T } from '../../components/ui';

function AccountRow({ icon, label, onPress, danger }) {
  const c = useTheme();
  const color = danger ? c.incorrect : c.text;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={20} color={color} />
      <T style={{ flex: 1, color }}>{label}</T>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </Pressable>
  );
}

function LinkCard({ icon, title, sub, onPress, label }) {
  const c = useTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={label || title} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md }}>
      <Ionicons name={icon} size={22} color={c.text} />
      <View style={{ flex: 1 }}>
        <T variant="heading">{title}</T>
        <T variant="small" color="textSecondary" numberOfLines={1}>{sub}</T>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </Card>
  );
}

function LanguageCard() {
  const c = useTheme();
  const { t } = useT();
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md }}>
      <Ionicons name="language-outline" size={22} color={c.text} />
      <View style={{ flex: 1 }}>
        <T variant="heading">{t('profile.language')}</T>
        <T variant="small" color="textSecondary">{t('profile.languageSub')}</T>
      </View>
      <LanguageSwitch compact />
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <View style={{ flex: 1 }}>
      <T variant="title">{value}</T>
      <T variant="small" color="textSecondary">{label}</T>
    </View>
  );
}

export default function Profile() {
  const c = useTheme();
  const { t, lang } = useT();
  const { user, signedIn, signOut, updateProfile } = useAuth();
  const { data: taxonomy } = useTaxonomy();
  const { subjects: mySubjects } = useMySubjects();
  const { data, isLoading, error, refetch, isRefetching } = useProgress();
  const version = Constants.expoConfig?.version;

  if (!signedIn) {
    return (
      <Screen>
        <T variant="display">{t('profile.title')}</T>
        <LanguageCard />
        <SignInPrompt title={t('profile.trackTitle')} message={t('profile.trackMessage')} />
      </Screen>
    );
  }
  const p = data?.progress;
  const subjects = [...(p?.bySubject || [])].sort((a, b) => b.seen - a.seen);
  const prem = user.premium || {};

  return (
    <Screen refreshControl={<RefreshControl tintColor={c.accent} refreshing={isRefetching} onRefresh={refetch} />}>
      <T variant="display">{user.name || t('profile.title')}</T>
      {user.email ? <T color="textSecondary" style={{ marginBottom: spacing.md }}>{user.email}</T> : null}
      <VerifyEmailBanner />

      <Card onPress={() => router.push('/premium')} accessibilityLabel={t('profile.premium')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: c.accent }}>
        <Ionicons name="sparkles" size={22} color={c.accent} />
        <View style={{ flex: 1 }}>
          <T variant="heading">{prem.active && prem.source ? t('profile.premium') : prem.active ? t('profile.allUnlocked') : t('profile.upgrade')}</T>
          <T variant="small" color="textSecondary">
            {prem.active && prem.until
              ? t(prem.status === 'cancelled' ? 'profile.ends' : 'profile.renews', { date: formatDate(prem.until) })
              : prem.active ? t('profile.freeNow') : t('profile.premiumPitch')}
          </T>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </Card>

      <SectionTitle>{t('profile.progress')}</SectionTitle>
      {isLoading ? <Loading /> : error ? <ErrorView error={error} onRetry={refetch} /> : (
        <>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, backgroundColor: c.inverse, borderColor: c.inverse }}>
            <Ionicons name="flame" size={32} color={c.accent} />
            <View style={{ flex: 1 }}>
              <T variant="title" color={c.onInverse}>{t('streak.days', { n: p.streak?.current || 0 })}</T>
              <T variant="small" color={c.onInverse} style={{ opacity: 0.8 }}>
                {p.streak?.current ? t('streak.keepGoing') : t('streak.start')} {t('streak.bestDays', { n: p.streak?.best || 0 })}
              </T>
            </View>
          </Card>
          <Card style={{ flexDirection: 'row' }}>
            <Stat label={t('profile.quizzes')} value={p.quizzesTaken} />
            <Stat label={t('profile.questions')} value={p.questionsSeen} />
            <Stat label={t('profile.accuracy')} value={p.accuracy == null ? '–' : `${p.accuracy}%`} />
          </Card>
          {p.practice?.answered ? (
            <T variant="small" color="textSecondary" style={{ marginTop: spacing.sm }}>
              {t('profile.practicePlus', { n: p.practice.answered, c: p.practice.correct })}
            </T>
          ) : null}
          {subjects.length ? (
            <>
              <SectionTitle>{t('profile.bySubject')}</SectionTitle>
              <Card>
                {subjects.map((s, i) => (
                  <View key={s.subject} style={{ marginTop: i ? spacing.lg : 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                      <T variant="small" style={{ fontWeight: '600', flex: 1 }}>{subjectLabel(taxonomy, s.subject, lang)}</T>
                      <T variant="small" color="textSecondary">{s.correct}/{s.seen} · {s.accuracy}%</T>
                    </View>
                    <ProgressBar value={s.accuracy || 0} />
                  </View>
                ))}
              </Card>
            </>
          ) : <T variant="small" color="textSecondary" style={{ marginTop: spacing.md }}>{t('profile.firstQuiz')}</T>}
        </>
      )}

      <LinkCard icon="analytics-outline" title={t('profile.insights')} sub={t('profile.insightsSub')} onPress={() => router.push('/insights')} />
      <LinkCard icon="options-outline" title={t('profile.subjects')}
        sub={mySubjects.length ? mySubjects.map((k) => subjectLabel(taxonomy, k, lang)).join(', ') : t('profile.subjectsEmpty')}
        onPress={() => router.push('/account/subjects')} />
      <LanguageCard />
      <LinkCard icon="notifications-outline" title={t('profile.notifications')} sub={t('profile.notificationsSub')} onPress={() => router.push('/account/notifications')} />

      <SectionTitle>{t('profile.account')}</SectionTitle>
      <Card style={{ paddingVertical: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
          <Ionicons name="trophy-outline" size={20} color={c.text} />
          <View style={{ flex: 1 }}>
            <T>{t('profile.showOnBoard')}</T>
            <T variant="small" color="textSecondary">{t('profile.shownAs', { name: shortName(user.name) })}</T>
          </View>
          <Switch
            accessibilityLabel={t('profile.showOnBoard')}
            value={user.showOnLeaderboard !== false}
            onValueChange={(v) => updateProfile({ showOnLeaderboard: v }).catch(() => {})}
            trackColor={{ true: c.accent, false: c.border }}
            thumbColor={c.background}
            activeThumbColor={c.background}
          />
        </View>
        <View style={{ height: 1, backgroundColor: c.border }} />
        <AccountRow icon="key-outline" label={user.hasPassword === false ? t('profile.setPassword') : t('profile.changePassword')} onPress={() => router.push('/account/password')} />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <AccountRow icon="trash-outline" label={t('profile.delete')} danger onPress={() => router.push('/account/delete')} />
      </Card>
      <Divider />
      <Button title={t('profile.signOut')} variant="outline" icon="log-out-outline" onPress={signOut} />
      <T variant="caption" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.lg }}>{t('common.version', { v: version })}</T>
    </Screen>
  );
}
