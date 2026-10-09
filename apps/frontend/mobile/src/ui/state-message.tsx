import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../shell/design';
import { Button } from './button';

type Props = {
  readonly icon: ComponentProps<typeof Ionicons>['name'];
  readonly title: string;
  readonly body: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly actionLoading?: boolean;
};

/** Empty, offline and error states share one calm, centred layout. */
export function StateMessage({ icon, title, body, actionLabel, onAction, actionLoading }: Props) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.wrap}>
      <View style={styles.iconWell}>
        <Ionicons accessible={false} name={icon} size={26} color={colors.accent} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button isLoading={actionLoading === true} onPress={onAction}>
            {actionLabel}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 12 },
  iconWell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: { ...type.title, textAlign: 'center' },
  body: { ...type.body, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 300 },
  action: { alignSelf: 'stretch', marginTop: 12 },
});
