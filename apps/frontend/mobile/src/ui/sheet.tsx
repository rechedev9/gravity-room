import type { PropsWithChildren, ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { type } from '../shell/design';
import { colors } from '@gzclp/design-tokens';
import { Button } from './button';

type Props = PropsWithChildren<{
  readonly visible: boolean;
  readonly title: string;
  readonly onClose: () => void;
  /** Pinned under the scrolling content, so a primary action stays reachable with the keyboard open. */
  readonly footer?: ReactNode;
}>;

export function Sheet({ visible, title, onClose, footer, children }: Props) {
  const { t } = useTranslation();
  // SafeAreaView cannot measure insets inside a Modal on Android, so pad the content instead.
  const insets = useSafeAreaInsets();
  // Android delivers the IME's "hide keyboard" back press to the modal too.
  // A lifter filling a form must not lose it just by hiding the keyboard.
  const handleRequestClose = () => {
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      return;
    }
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleRequestClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.header}>
            <Text
              accessibilityRole="header"
              accessibilityLabel={title}
              numberOfLines={2}
              ellipsizeMode="tail"
              style={styles.title}
            >
              {title}
            </Text>
            <Button onPress={onClose}>{t('ui.close')}</Button>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              { paddingBottom: footer ? 16 : 16 + insets.bottom },
            ]}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>{footer}</View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderColor: colors.ruleStrong,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  title: { ...type.title, flex: 1, minWidth: 0, flexShrink: 1 },
  footer: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ruleStrong,
    backgroundColor: colors.card,
  },
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },
});
