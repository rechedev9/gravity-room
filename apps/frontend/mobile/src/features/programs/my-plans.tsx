import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { ProgramSummary } from '../../lib/programs/program-repository';
import { colors, type } from '../../shell/design';
import { Screen } from '../../ui/screen';
import { Button } from '../../ui/button';
import { IconButton } from '../../ui/icon-button';
import { ProgramArtwork } from '../../ui/program-artwork';

type Props = {
  readonly programs: readonly ProgramSummary[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly syncNotice: string | null;
  readonly onRetry: () => void;
  readonly onOpen: ((id: string) => void) | undefined;
  readonly onExplore: (() => void) | undefined;
  readonly onDelete?: ((program: ProgramSummary) => void) | undefined;
};

export function MyPlans({
  programs,
  loading,
  error,
  syncNotice,
  onRetry,
  onOpen,
  onExplore,
  onDelete,
}: Props) {
  const { t, i18n } = useTranslation();
  // Repository ordering is most recently updated, not most recently trained.
  const [recent, ...others] = programs;
  const updated = (program: ProgramSummary) => {
    const date = new Date(program.updatedAt);
    return t('programs.card_updated', {
      date: Number.isNaN(date.getTime())
        ? program.updatedAt
        : date.toLocaleDateString(i18n.language, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
    });
  };
  const header = (
    <View style={styles.header}>
      <View style={styles.topLine}>
        <Text style={styles.eyebrow}>{t('plans.eyebrow')}</Text>
        {onExplore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('plans.explore')}
            onPress={onExplore}
            style={styles.add}
          >
            <Ionicons accessible={false} name="add" color={colors.textPrimary} size={23} />
          </Pressable>
        ) : null}
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {t('programs.title')}
      </Text>
      <Text style={styles.intro}>{t('plans.intro')}</Text>
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {error || syncNotice ? (
        <View style={styles.notice}>
          <Text style={styles.meta}>{error ?? syncNotice}</Text>
          <Button onPress={onRetry}>{t('common.retry')}</Button>
        </View>
      ) : null}
      {!loading && !error && recent ? (
        <>
          {/* The delete control is a sibling, not a child, of the card button so
              assistive tech can reach it (nested buttons are flattened away). */}
          <View style={styles.feature}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('plans.open', { name: recent.title })}
              onPress={() => onOpen?.(recent.id)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <ProgramArtwork programId={recent.programId} title={recent.title} />
              <View style={styles.featureBody}>
                <View style={styles.featureTop}>
                  <View style={styles.badge}>
                    <View style={styles.dot} />
                    <Text style={styles.badgeText}>{t('plans.recent')}</Text>
                  </View>
                  <Ionicons
                    accessible={false}
                    name="barbell-outline"
                    size={29}
                    color={colors.accent}
                  />
                </View>
                <Text style={styles.featureTitle}>{recent.title}</Text>
                <View style={styles.date}>
                  <Ionicons
                    accessible={false}
                    name="calendar-outline"
                    size={15}
                    color={colors.textMuted}
                  />
                  <Text style={styles.meta}>{updated(recent)}</Text>
                </View>
                <View style={styles.action}>
                  <Text style={styles.actionText}>{t('plans.open_plan')}</Text>
                  <Ionicons
                    accessible={false}
                    name="arrow-forward"
                    size={19}
                    color={colors.onAccent}
                  />
                </View>
              </View>
            </Pressable>
            {onDelete ? (
              <View style={styles.featureDelete}>
                <IconButton
                  name="trash-outline"
                  label={t('plans.delete', { name: recent.title })}
                  onPress={() => onDelete(recent)}
                />
              </View>
            ) : null}
          </View>
          {others.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('plans.other')}</Text>
              <Text style={styles.count}>{others.length}</Text>
            </View>
          ) : null}
        </>
      ) : null}
      {!loading && !error && !recent ? (
        <View style={styles.empty}>
          <Ionicons accessible={false} name="calendar-outline" size={38} color={colors.accent} />
          <Text style={styles.sectionTitle}>{t('programs.first_run.title')}</Text>
          <Text style={styles.intro}>{t('plans.empty')}</Text>
        </View>
      ) : null}
    </View>
  );
  return (
    <Screen padded={false}>
      <FlatList
        data={loading || error ? [] : others}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('plans.open', { name: item.title })}
              onPress={() => onOpen?.(item.id)}
              style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
            >
              <ProgramArtwork programId={item.programId} title={item.title} thumbnail />
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.meta}>{updated(item)}</Text>
              </View>
              {/* The trailing control is either the chevron or the delete
                  button, never both: two icons in a row read as two actions. */}
              {onDelete ? null : (
                <Ionicons
                  accessible={false}
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                />
              )}
            </Pressable>
            {onDelete ? (
              <IconButton
                name="trash-outline"
                label={t('plans.delete', { name: item.title })}
                onPress={() => onDelete(item)}
              />
            ) : null}
          </View>
        )}
        ListFooterComponent={
          onExplore ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('plans.explore')}
              onPress={onExplore}
              style={styles.explore}
            >
              <Ionicons accessible={false} name="compass-outline" size={24} color={colors.accent} />
              <View style={styles.copy}>
                <Text style={styles.exploreTitle}>{t('plans.explore')}</Text>
                <Text style={styles.meta}>{t('plans.explore_hint')}</Text>
              </View>
              <Ionicons
                accessible={false}
                name="arrow-forward"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 32 },
  header: { gap: 12 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { ...type.kicker, color: colors.accent, letterSpacing: 2 },
  add: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { ...type.display, fontSize: 34, lineHeight: 40 },
  intro: { ...type.body, fontSize: 14, lineHeight: 21 },
  feature: {
    marginTop: 12,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.card,
  },
  featureBody: { padding: 18, gap: 14 },
  featureTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  badge: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  badgeText: { ...type.kicker, color: colors.textSecondary, fontSize: 9 },
  featureTitle: { ...type.displaySm, fontSize: 28, lineHeight: 34 },
  date: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  meta: { ...type.body, fontSize: 12, lineHeight: 18 },
  action: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  actionText: { ...type.button, color: colors.onAccent },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 4,
  },
  sectionTitle: { ...type.title, fontSize: 18 },
  count: { ...type.meta },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    minHeight: 90,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  featureDelete: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(20, 20, 18, 0.7)',
  },
  copy: { flex: 1, gap: 5 },
  rowTitle: { ...type.title, fontSize: 17 },
  pressed: { opacity: 0.8 },
  explore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 22,
    paddingHorizontal: 8,
    marginTop: 12,
    borderTopWidth: 1,
    borderColor: colors.rule,
  },
  exploreTitle: { ...type.title, fontSize: 15 },
  notice: { gap: 8 },
  empty: { gap: 16, paddingVertical: 32, alignItems: 'center' },
});
