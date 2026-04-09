import { useState, useDeferredValue, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchExercises, type ExerciseEntry } from '@/lib/api-functions';
import { Button } from '@/components/button';
import type { ExercisePickerProps } from './types';

export function ExercisePicker({ onSelect, onClose }: ExercisePickerProps): React.ReactNode {
  const [search, setSearch] = useState('');
  // useDeferredValue defers the filter computation to low-priority rendering,
  // giving the input immediate response while filtering runs asynchronously.
  const deferredSearch = useDeferredValue(search);

  const exercisesQuery = useQuery({
    queryKey: queryKeys.catalog.exercises({ limit: 1000 }),
    queryFn: () => fetchExercises({ limit: 1000 }),
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo((): readonly ExerciseEntry[] => {
    if (!exercisesQuery.data) return [];
    const q = deferredSearch.toLowerCase().trim();
    if (q.length === 0) return exercisesQuery.data.data;
    return exercisesQuery.data.data.filter((e) => e.name.toLowerCase().includes(q));
  }, [exercisesQuery.data, deferredSearch]);

  const handleSelect = (exercise: ExerciseEntry): void => {
    onSelect({ id: exercise.id, name: exercise.name });
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/95 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-zinc-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-zinc-100">Seleccionar ejercicio</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ejercicio..."
            autoFocus
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {exercisesQuery.isLoading && (
            <p className="text-xs text-zinc-500 text-center py-8">Cargando ejercicios...</p>
          )}
          {exercisesQuery.isError && (
            <p className="text-xs text-red-400 text-center py-8">Error al cargar los ejercicios</p>
          )}
          {filtered.length === 0 && !exercisesQuery.isLoading && (
            <p className="text-xs text-zinc-500 text-center py-8">No se encontraron ejercicios</p>
          )}
          {filtered.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              onClick={() => handleSelect(exercise)}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <span className="block font-medium">{exercise.name}</span>
              {exercise.muscleGroupId && (
                <span className="block text-2xs text-zinc-500 mt-0.5">
                  {exercise.muscleGroupId}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
