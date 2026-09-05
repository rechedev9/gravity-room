import { router } from 'expo-router';
import { ProgramsScreen } from '../../../features/programs/programs-screen';

export default function TemplatesRoute() {
  return (
    <ProgramsScreen
      mode="catalog"
      onOpenProgram={(id) => router.navigate({ pathname: '/', params: { id } })}
    />
  );
}
