import type { PropsWithChildren } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Barlow_400Regular, Barlow_600SemiBold, Barlow_700Bold } from '@expo-google-fonts/barlow';
import {
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import { colors } from './design';

export function FontProvider({ children }: PropsWithChildren) {
  const [loaded, error] = useFonts({
    'Bebas Neue': BebasNeue_400Regular,
    Barlow: Barlow_400Regular,
    'Barlow SemiBold': Barlow_600SemiBold,
    'Barlow Bold': Barlow_700Bold,
    'JetBrains Mono': JetBrainsMono_600SemiBold,
    'JetBrains Mono Bold': JetBrainsMono_700Bold,
  });

  if (!loaded && !error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.canvas,
        }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return children;
}
