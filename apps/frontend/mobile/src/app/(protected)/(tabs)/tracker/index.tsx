import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { TrackerHomeScreen } from '../../../../features/tracker/tracker-home-screen';
import { useAuth } from '../../../../providers/auth-provider';

export default function TrackerRoute() {
  const { user } = useAuth();
  const [focusRevision, setFocusRevision] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setFocusRevision((current) => current + 1);
    }, [])
  );

  if (user === null) {
    return null;
  }

  return <TrackerHomeScreen ownerUserId={user.id} refreshRevision={focusRevision} />;
}
