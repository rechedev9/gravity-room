import { useCallback, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, type } from '../shell/design';
import { Button } from './button';

export type ConfirmOptions = {
  readonly title: string;
  readonly message: string;
  readonly cancel: string;
  readonly confirm: string;
  readonly destructive?: boolean;
};

type Pending = { readonly options: ConfirmOptions; readonly resolve: (answer: boolean) => void };

/**
 * A themed replacement for the stock Android alert, which renders light on a dark app.
 * `confirm` resolves true on the confirm button and false on cancel, back or a tap outside.
 */
export function useConfirmDialog(): {
  readonly confirm: (options: ConfirmOptions) => Promise<boolean>;
  readonly dialog: ReactNode;
} {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ options, resolve });
      }),
    []
  );
  const settle = (answer: boolean): void => {
    pending?.resolve(answer);
    setPending(null);
  };
  const options = pending?.options;
  const dialog = (
    <Modal
      visible={pending !== null}
      transparent
      animationType="fade"
      onRequestClose={() => settle(false)}
    >
      <View style={styles.overlay}>
        <Pressable
          accessible={false}
          style={StyleSheet.absoluteFill}
          onPress={() => settle(false)}
        />
        {options ? (
          <View accessibilityViewIsModal style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>
              {options.title}
            </Text>
            <Text style={styles.message}>{options.message}</Text>
            <View style={styles.actions}>
              <View style={styles.action}>
                <Button onPress={() => settle(false)}>{options.cancel}</Button>
              </View>
              <View style={styles.action}>
                <Button
                  variant={options.destructive ? 'danger' : 'primary'}
                  onPress={() => settle(true)}
                >
                  {options.confirm}
                </Button>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
  return { confirm, dialog };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  card: {
    gap: 12,
    padding: 20,
    borderRadius: radii.card + 4,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    backgroundColor: colors.card,
  },
  title: { ...type.title },
  message: { ...type.body, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  action: { flex: 1 },
});
