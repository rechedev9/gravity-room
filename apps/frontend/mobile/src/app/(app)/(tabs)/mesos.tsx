import { router } from 'expo-router';
import { ProgramsScreen } from '../../../features/programs/programs-screen';

export default function MesosRoute() {
  return (
    <ProgramsScreen
      mode="instances"
      onExplorePrograms={() => router.navigate('/templates')}
      onOpenProgram={(id) => router.navigate({ pathname: '/', params: { id } })}
    />
  );
}
