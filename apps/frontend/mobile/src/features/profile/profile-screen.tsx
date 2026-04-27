import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AuthUser } from '../../lib/auth/session';

interface ProfileScreenProps {
  readonly user: AuthUser;
}

export function ProfileScreen({ user }: ProfileScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.name}>{user.name ?? 'Gravity Room athlete'}</Text>
        <Text style={styles.body}>{user.email}</Text>
        <Text style={styles.caption}>Profile details will land in a later task.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050816',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '700',
  },
  name: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '600',
  },
  body: {
    color: '#CBD5E1',
    fontSize: 16,
  },
  caption: {
    color: '#CBD5E1',
    fontSize: 16,
    lineHeight: 24,
  },
});
