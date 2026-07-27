import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { TrackerHomeScreen } from '../../../features/tracker/tracker-home-screen';

export default function TrackerRoute() {
  const [focusRevision, setFocusRevision] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setFocusRevision((current) => current + 1);
    }, [])
  );

  return <TrackerHomeScreen refreshRevision={focusRevision} />;
}
