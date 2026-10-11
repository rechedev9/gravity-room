import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  fetchExercisePage,
  fetchMuscleGroups,
  type ExerciseFilters,
  type ExercisePage,
} from './exercise-service';

/** The previous list stays on screen while a new search or filter loads, so typing never blanks it. */
export function useExercisePages(filters: ExerciseFilters) {
  return useInfiniteQuery<ExercisePage, Error, readonly ExercisePage[], readonly unknown[], number>(
    {
      queryKey: ['exercises', filters.search.trim(), filters.muscleGroupId],
      initialPageParam: 0,
      queryFn: ({ pageParam, signal }) => fetchExercisePage({ filters, offset: pageParam, signal }),
      // Advance by rows received so a dropped row cannot loop the same offset.
      getNextPageParam: (last) =>
        last.offset + last.received < last.total && last.received > 0
          ? last.offset + last.received
          : undefined,
      select: (data) => data.pages,
      placeholderData: keepPreviousData,
    }
  );
}

export function useMuscleGroups() {
  return useQuery({
    queryKey: ['muscle-groups'],
    queryFn: ({ signal }) => fetchMuscleGroups(signal),
    staleTime: 10 * 60_000,
  });
}
