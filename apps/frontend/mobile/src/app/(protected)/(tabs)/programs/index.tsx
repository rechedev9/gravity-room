import { useRouter } from 'expo-router';

import { ProgramsScreen } from '../../../../features/programs/programs-screen';
import { createPresetSetupRoute, createProgramRoute } from '../../../../navigation/routes';
import { useAuth } from '../../../../providers/auth-provider';

export default function ProgramsRoute() {
  const router = useRouter();
  const { user } = useAuth();

  if (user === null) {
    return null;
  }

  return (
    <ProgramsScreen
      onOpenPreset={(programId) => router.push(createPresetSetupRoute(programId))}
      onOpenProgram={(programInstanceId) => router.push(createProgramRoute(programInstanceId))}
      ownerUserId={user.id}
    />
  );
}
