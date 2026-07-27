import { StyleSheet, Text } from 'react-native';

import { Button } from './button';
import { Card } from './card';
import { Screen } from './screen';
import { colors } from './tokens';

interface MessageStateProps {
  readonly actionAccessibilityLabel?: string;
  readonly actionLabel?: string;
  readonly body: string;
  readonly onAction?: () => void;
  readonly title: string;
}

export function MessageState({
  actionAccessibilityLabel,
  actionLabel,
  body,
  onAction,
  title,
}: MessageStateProps) {
  const hasAction =
    actionAccessibilityLabel !== undefined && actionLabel !== undefined && onAction !== undefined;

  return (
    <Screen centered>
      <Card>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.body}>{body}</Text>
        {hasAction ? (
          <Button
            accessibilityLabel={actionAccessibilityLabel}
            label={actionLabel}
            onPress={onAction}
          />
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
});
