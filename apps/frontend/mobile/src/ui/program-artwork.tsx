import { StyleSheet, View } from 'react-native';

import { programCoverSpec } from '@gzclp/domain/program-cover';
import { colors } from '@gzclp/design-tokens';
import { ProgramCover } from './program-cover';

type Props = {
  readonly programId: string | undefined;
  readonly title?: string | undefined;
  readonly category?: string | undefined;
  readonly level?: string | undefined;
  readonly workoutsPerWeek?: number | undefined;
  readonly thumbnail?: boolean;
};

/** Program artwork keyed by the stable program id; custom plans derive from their title. */
export function ProgramArtwork({
  programId,
  title,
  category,
  level,
  workoutsPerWeek,
  thumbnail = false,
}: Props) {
  const spec = programCoverSpec({ programId, title, category, level, workoutsPerWeek });
  return (
    <View accessible={false} style={thumbnail ? styles.thumbnail : styles.cover}>
      <ProgramCover spec={spec} variant={thumbnail ? 'thumbnail' : 'cover'} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', aspectRatio: 2.5, backgroundColor: colors.surface2, overflow: 'hidden' },
  thumbnail: {
    width: 72,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
});
