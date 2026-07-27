import { useRouter } from 'expo-router';

import { ProgramsScreen } from '../../../features/programs/programs-screen';
import { createProgramRoute } from '../../../navigation/routes';

export default function ProgramsRoute() {
  const router = useRouter();

  return (
    <ProgramsScreen
      onOpenProgram={(programInstanceId) => router.push(createProgramRoute(programInstanceId))}
    />
  );
}
