import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { PROGRAM_SUMMARIES_KEY } from '../../../lib/programs/program-queries';
import { ProgramsScreen } from '../../../features/programs/programs-screen';

export default function MesosRoute() {
  const queryClient = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries(
        { queryKey: PROGRAM_SUMMARIES_KEY, exact: true, type: 'active' },
        { cancelRefetch: false }
      );
    }, [queryClient])
  );
  return (
    <ProgramsScreen
      mode="instances"
      onExplorePrograms={() => router.navigate('/templates')}
      onOpenProgram={(id) => router.navigate({ pathname: '/', params: { id } })}
    />
  );
}
