import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSyncStatus, type SyncStatusValue } from '../shell/sync-status-provider';
import { colors, fonts, spacing } from '../shell/design';
import { Button } from './button';

export function SyncStatusBanner() {
  const sync = useSyncStatus();
  return sync ? <SyncStatusBannerView sync={sync} /> : null;
}

/** The same view is used by connected screens and isolated responsive previews. */
export function SyncStatusBannerView({ sync }: { readonly sync: SyncStatusValue }) {
  const { t } = useTranslation();
  if (!sync.visible) return null;
  const attention = (sync.status?.needsAttention ?? 0) > 0;
  const pending = sync.status?.total ?? 0;
  const title = sync.readError
    ? t('sync.unavailable')
    : attention
      ? t('sync.attention', { count: sync.status?.needsAttention })
      : pending > 0
        ? t('sync.pending', { count: pending })
        : t('sync.offline');
  const description = sync.readError
    ? t('sync.unavailable_detail')
    : attention
      ? t('sync.attention_detail')
      : pending > 0
        ? t('sync.pending_detail')
        : t('sync.offline_detail');
  return (
    <View style={styles.banner}>
      <Ionicons
        accessible={false}
        name={
          attention || sync.readError
            ? 'alert-circle-outline'
            : sync.offline && pending === 0
              ? 'cloud-offline-outline'
              : 'cloud-upload-outline'
        }
        size={21}
        color={colors.accent}
      />
      <View style={styles.copy} accessibilityLiveRegion="polite">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Button variant="ghost" onPress={sync.retry} accessibilityLabel={t('sync.retry_label')}>
        {t('common.retry')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    marginHorizontal: spacing.screenX,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  copy: { flex: 1, gap: 3 },
  title: { color: colors.textPrimary, fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 18 },
  description: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
});
