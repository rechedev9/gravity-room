export const USER_DATA_LIMITS = {
  programInstances: 100,
  workoutResults: 20_000,
  undoEntries: 5_000,
  customExercises: 250,
  jsonBytes: 25 * 1024 * 1024,
} as const;

/** A single import must remain comfortably below both DB bind and function limits. */
export const MAX_IMPORT_ROWS = 2_000;
export const MAX_IMPORT_UNDO_ENTRIES = 50;
export const MAX_IMPORT_JSON_BYTES = 750 * 1024;

/** Analytics deliberately uses a recent bounded window, even for legacy over-quota users. */
export const MAX_ANALYTICS_RECORDS_PER_USER = 10_000;
