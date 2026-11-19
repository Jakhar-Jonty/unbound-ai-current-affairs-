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
import LegalLinks from '../../components/LegalLinks';
import ThemeSwitch from '../../components/ThemeSwitch';
import { usePrefs } from '../../lib/prefs';
import { formatDate, shortName } from '../../lib/format';
import { useMyExams, useMySubjects } from '../../lib/subjects-pref';
import { examLabel } from '../../lib/subjects';
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

/** One row inside a grouped settings card. */
function GroupRow({ icon, title, sub, onPress, right, first }) {
  const c = useTheme();
  const body = (
    <>
      <Ionicons name={icon} size={20} color={c.text} />
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: '600' }}>{title}</T>
        {sub ? <T variant="small" color="textSecondary" numberOfLines={1}>{sub}</T> : null}
      </View>
      {right || <Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
    </>
  );
  const style = { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: first ? 0 : 1, borderTopColor: c.border };
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? 0.7 : 1 }]}>{body}</Pressable>
  );
}

function ThemeRow({ first }) {
  const { t } = useT();
  const { prefs } = usePrefs();
  return <GroupRow first={first} icon="contrast-outline" title={t('theme.title')} sub={t(`theme.${prefs.theme || 'system'}`)} right={<ThemeSwitch />} />;
}

function Avatar({ name }) {
  const c = useTheme();
  const initials = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return (
    <View accessibilityElementsHidden importantForAccessibility="no" style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
      <T variant="title" color={c.onAccent}>{initials}</T>
    </View>
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
  const { exams: myExams } = useMyExams();
  const { data, isLoading, error, refetch, isRefetching } = useProgress();
  const version = Constants.expoConfig?.version;

  if (!signedIn) {
    return (
      <Screen>
        <T variant="display">{t('profile.title')}</T>
        <Card style={{ paddingVertical: spacing.xs }}>
          <GroupRow first icon="school-outline" title={t('profile.exams')}
            sub={myExams.length ? myExams.map((k) => examLabel(k, lang)).join(', ') : t('profile.examsEmpty')}
            onPress={() => router.push('/account/exams')} />
          <GroupRow icon="language-outline" title={t('profile.language')} sub={t('profile.languageSub')} right={<LanguageSwitch compact />} />
          <ThemeRow />
        </Card>
        <SignInPrompt title={t('profile.trackTitle')} message={t('profile.trackMessage')} />
        <LegalLinks style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }
  const p = data?.progress;
  const subjects = [...(p?.bySubject || [])].sort((a, b) => b.seen - a.seen);
  const prem = user.premium || {};

  return (
    <Screen refreshControl={<RefreshControl tintColor={c.accent} refreshing={isRefetching} onRefresh={refetch} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
        <Avatar name={user.name} />
        <View style={{ flex: 1 }}>
          <T variant="title" numberOfLines={1}>{user.name || t('profile.title')}</T>
          {user.email ? <T variant="small" color="textSecondary" numberOfLines={1}>{user.email}</T> : null}
        </View>
      </View>
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
              <T variant="title" color={c.onInverse}>{p.streak?.current ? t('streak.days', { n: p.streak.current }) : t('streak.startTitle')}</T>
              <T variant="small" color={c.onInverse} style={{ opacity: 0.8 }}>
                {p.streak?.current ? t('streak.keepGoing') : t('streak.start')}{p.streak?.best ? ` ${t('streak.bestDays', { n: p.streak.best })}` : ''}
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

      <SectionTitle>{t('profile.preferences')}</SectionTitle>
      <Card style={{ paddingVertical: spacing.xs }}>
        <GroupRow first icon="school-outline" title={t('profile.exams')}
          sub={myExams.length ? myExams.map((k) => examLabel(k, lang)).join(', ') : t('profile.examsEmpty')}
          onPress={() => router.push('/account/exams')} />
        <GroupRow icon="options-outline" title={t('profile.subjects')}
          sub={mySubjects.length ? mySubjects.map((k) => subjectLabel(taxonomy, k, lang)).join(', ') : t('profile.subjectsEmpty')}
          onPress={() => router.push('/account/subjects')} />
        <GroupRow icon="language-outline" title={t('profile.language')} right={<LanguageSwitch compact />} />
        <ThemeRow />
        <GroupRow icon="notifications-outline" title={t('profile.notifications')} sub={t('profile.notificationsSub')} onPress={() => router.push('/account/notifications')} />
      </Card>

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
      <LegalLinks style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}
