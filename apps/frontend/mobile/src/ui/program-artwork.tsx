import { Image, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getProgramArtwork } from '../lib/programs/program-artwork';
import { colors } from '../shell/design';

type Props = {
  readonly programId: string | undefined;
  readonly thumbnail?: boolean;
};

export function ProgramArtwork({ programId, thumbnail = false }: Props) {
  const artwork = getProgramArtwork(programId);
  const style = thumbnail ? styles.thumbnail : styles.cover;
  return artwork ? (
    <View style={style}>
      <Image
        accessible={false}
        source={thumbnail ? artwork.thumbnail : artwork.cover}
        resizeMode="cover"
        style={styles.image}
      />
    </View>
  ) : (
    <View accessible={false} style={[style, styles.fallback]}>
      <Ionicons name="barbell-outline" size={thumbnail ? 26 : 48} color={colors.accentDeep} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  cover: { width: '100%', aspectRatio: 1.8, backgroundColor: colors.surface2, overflow: 'hidden' },
  thumbnail: {
    width: 72,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
