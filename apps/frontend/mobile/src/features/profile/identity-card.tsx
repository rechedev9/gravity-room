import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, type } from '../../shell/design';
import { Card } from '../../ui/card';

type Props = {
  readonly name: string;
  readonly email: string;
  /** Without a profile name the avatar uses the email, not the placeholder title. */
  readonly initialsFrom: string;
  readonly note: string;
};

/** First letters of up to two words, so "Test Athlete" reads as "TA". */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '');
  return letters.join('').toLocaleUpperCase();
}

export function IdentityCard({ name, email, initialsFrom, note }: Props) {
  const initials = initialsOf(initialsFrom);
  return (
    <Card>
      <View style={styles.identity}>
        <View accessible={false} style={styles.avatar}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          <Text numberOfLines={1} style={styles.email}>
            {email}
          </Text>
        </View>
      </View>
      <View style={styles.note}>
        <Ionicons
          accessible={false}
          name="lock-closed-outline"
          size={16}
          color={colors.textMuted}
        />
        <Text style={styles.caption}>{note}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 18, letterSpacing: 0.5 },
  copy: { flex: 1, gap: 2 },
  name: { ...type.title },
  email: { ...type.body, fontSize: 14, lineHeight: 20 },
  note: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    paddingTop: 14,
    marginTop: 8,
  },
  caption: { ...type.body, fontSize: 13, lineHeight: 19, flex: 1 },
});
