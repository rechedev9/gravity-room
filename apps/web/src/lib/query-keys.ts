export const queryKeys = {
  auth: {
    session: ['auth', 'session'] as const,
  },
  stats: {
    online: ['stats', 'online'] as const,
  },
  programs: {
    all: ['programs'] as const,
    detail: (id: string): readonly ['programs', string] => ['programs', id] as const,
  },
  definitions: {
    all: ['definitions'] as const,
    list: (): readonly ['definitions', 'list'] => ['definitions', 'list'] as const,
    detail: (id: string): readonly ['definitions', string] => ['definitions', id] as const,
  },
  insights: {
    all: ['insights'] as const,
    list: (types?: readonly string[]): readonly unknown[] =>
      types?.length ? (['insights', ...types] as const) : (['insights'] as const),
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
    preview: (definitionId: string): readonly ['catalog', 'preview', string] =>
      ['catalog', 'preview', definitionId] as const,
  },
} as const;
