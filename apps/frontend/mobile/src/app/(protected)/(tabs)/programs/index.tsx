import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

import { ProgramsScreen } from '../../../../features/programs/programs-screen';
import { createPresetSetupRoute, createProgramRoute } from '../../../../navigation/routes';
import { useAuth } from '../../../../providers/auth-provider';

export default function ProgramsRoute() {
  const router = useRouter();
  const { user } = useAuth();
  const [focusRevision, setFocusRevision] = useState(0);
  const hasFocusedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (hasFocusedRef.current) {
        setFocusRevision((current) => current + 1);
      } else {
        hasFocusedRef.current = true;
      }
    }, [])
  );

  if (user === null) {
    return null;
  }

  return (
    <ProgramsScreen
      onOpenPreset={(programId) => router.push(createPresetSetupRoute(programId))}
      onOpenProgram={(programInstanceId) => router.push(createProgramRoute(programInstanceId))}
      ownerUserId={user.id}
      refreshRevision={focusRevision}
    />
  );
}
