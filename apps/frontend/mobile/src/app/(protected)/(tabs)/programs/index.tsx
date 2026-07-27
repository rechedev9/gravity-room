import { useRouter } from 'expo-router';

import { ProgramsScreen } from '../../../../features/programs/programs-screen';
import { writeTrackerProgramId } from '../../../../lib/tracker/tracker-selection-storage';
import { createProgramRoute } from '../../../../navigation/routes';

export default function ProgramsRoute() {
  const router = useRouter();

  return (
    <ProgramsScreen
      onOpenProgram={(programInstanceId) => {
        void writeTrackerProgramId(programInstanceId)
          .catch(() => undefined)
          .finally(() => router.push(createProgramRoute(programInstanceId)));
      }}
    />
  );
}
