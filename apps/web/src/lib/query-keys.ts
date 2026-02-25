export const queryKeys = {
  programs: {
    all: ['programs'] as const,
    detail: (id: string): readonly ['programs', string] => ['programs', id] as const,
  },
  catalog: {
    list: (): readonly ['catalog', 'list'] => ['catalog', 'list'] as const,
    detail: (programId: string): readonly ['catalog', 'detail', string] =>
      ['catalog', 'detail', programId] as const,
    exercises: (
      filter?: Record<string, unknown>
    ): readonly ['catalog', 'exercises', ...(Record<string, unknown> | undefined)[]] =>
      filter ? (['catalog', 'exercises', filter] as const) : (['catalog', 'exercises'] as const),
    muscleGroups: (): readonly ['catalog', 'muscleGroups'] => ['catalog', 'muscleGroups'] as const,
  },
} as const;
