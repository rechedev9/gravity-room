const DEFINITION = {
  id: 'test-prog',
  name: 'Test Program',
  description: 'Minimal fixture for tracker cache tests.',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 2,
  totalWorkouts: 4,
  workoutsPerWeek: 2,
  exercises: {
    squat: { name: 'Squat' },
    bench: { name: 'Bench' },
  },
  configFields: [
    { key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 },
    { key: 'bench', label: 'Bench', type: 'weight', min: 20, step: 2.5 },
  ],
  weightIncrements: { squat: 5, bench: 2.5 },
  days: [
    {
      name: 'Day A',
      slots: [
        {
          id: 'squat-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 5, reps: 3, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'squat',
        },
      ],
    },
    {
      name: 'Day B',
      slots: [
        {
          id: 'bench-t1',
          exerciseId: 'bench',
          tier: 't1',
          stages: [{ sets: 5, reps: 3, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'bench',
        },
      ],
    },
  ],
};
const DETAIL = {
  id: 'instance-1',
  programId: 'test-prog',
  name: 'Test Program Instance',
  config: {
    squat: 60,
    bench: 40,
  },
  metadata: null,
  results: {},
  undoHistory: [],
  resultTimestamps: {},
  completedDates: {},
  definitionId: null,
  customDefinition: null,
  status: 'active',
  createdAt: '2026-04-20T10:00:00.000Z',
  updatedAt: '2026-04-20T10:00:00.000Z',
};
const { DatabaseSync } = require('node:sqlite');
const { createSqliteTestAdapter } = require('../../../testing/sqlite-adapter.cjs');
const client = require('../db/client');
const { listProgramSummaries, upsertProgramSummaries } = require('./program-repository');
const {
  getProgramDetail,
  getProgramDefinition,
  upsertProgramDefinition,
} = require('../tracker/program-detail-repository');

describe('cache ownership regression', () => {
  let sqlite;
  let database;
  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    database = createSqliteTestAdapter(sqlite);
    jest.spyOn(client, 'getDatabase').mockReturnValue(database);
    await client.activateLocalDataOwner('owner-a', database);
  });
  afterEach(() => {
    client.deactivateLocalDataOwner();
    jest.restoreAllMocks();
    sqlite.close();
  });

  it.each([
    listProgramSummaries,
    () => getProgramDetail('missing'),
    () => getProgramDefinition('missing'),
  ])('rejects stale reads', async (read) => {
    const getAll = database.getAllAsync;
    jest.spyOn(database, 'getAllAsync').mockImplementation(async (...args) => {
      const rows = await getAll(...args);
      client.deactivateLocalDataOwner();
      return rows;
    });
    await expect(read()).rejects.toThrow();
  });

  it('rolls back a summary delete after deactivation', async () => {
    await upsertProgramSummaries([{ id: 'old', title: 'Old', updatedAt: '2026-09-01' }]);
    const run = database.runAsync;
    jest.spyOn(database, 'runAsync').mockImplementation(async (...args) => {
      const result = await run(...args);
      client.deactivateLocalDataOwner();
      return result;
    });
    await expect(upsertProgramSummaries([])).rejects.toThrow();
    expect(sqlite.prepare('SELECT id FROM program_summaries').all()).toEqual([{ id: 'old' }]);
  });

  it('captures the summary snapshot before database bootstrap yields', async () => {
    const input = [{ id: 'original', title: 'Original', updatedAt: '2026-09-01' }];
    const pending = upsertProgramSummaries(input);
    input[0].title = 'Mutated';
    input.push({ id: 'late', title: 'Late', updatedAt: '2026-09-01' });
    await pending;
    expect(await listProgramSummaries()).toEqual([
      { id: 'original', title: 'Original', updatedAt: '2026-09-01' },
    ]);
  });

  it('rolls back definition writes after deactivation', async () => {
    const run = database.runAsync;
    jest.spyOn(database, 'runAsync').mockImplementation(async (...args) => {
      const result = await run(...args);
      client.deactivateLocalDataOwner();
      return result;
    });
    await expect(upsertProgramDefinition(DEFINITION)).rejects.toThrow();
    expect(sqlite.prepare('SELECT id FROM program_definitions').all()).toEqual([]);
  });

  it.each([
    [
      'summary',
      () => upsertProgramSummaries([{ id: 'next', title: 'Next', updatedAt: '2026-09-01' }]),
    ],
    ['empty summary', () => upsertProgramSummaries([])],
    ['definition', () => upsertProgramDefinition(DEFINITION)],
  ])('rejects %s writes when ownership changes before the transaction', async (_name, write) => {
    jest.spyOn(client, 'bootstrapDatabase').mockImplementationOnce(async () => {
      client.deactivateLocalDataOwner();
    });
    const run = jest.spyOn(database, 'runAsync');
    await expect(write()).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });

  it('rolls back both pruning and replacement after a summary insert loses its owner', async () => {
    await upsertProgramSummaries([{ id: 'old', title: 'Old', updatedAt: '2026-09-01' }]);
    const run = database.runAsync;
    jest.spyOn(database, 'runAsync').mockImplementation(async (sql, ...params) => {
      const result = await run(sql, ...params);
      if (sql.includes('INSERT')) client.deactivateLocalDataOwner();
      return result;
    });
    await expect(
      upsertProgramSummaries([{ id: 'new', title: 'New', updatedAt: '2026-09-02' }])
    ).rejects.toThrow();
    expect(sqlite.prepare('SELECT id,title FROM program_summaries').all()).toEqual([
      { id: 'old', title: 'Old' },
    ]);
  });

  it('captures definition identity and nested fields before the first await', async () => {
    const input = JSON.parse(JSON.stringify(DEFINITION));
    const pending = upsertProgramDefinition(input);
    input.id = 'mutated';
    input.days[0].name = 'Mutated';
    await pending;
    expect(await getProgramDefinition(DEFINITION.id)).toEqual(DEFINITION);
    expect(await getProgramDefinition('mutated')).toBeNull();
  });

  it.each([
    ['summaries', () => listProgramSummaries()],
    ['detail', () => getProgramDetail(DETAIL.id)],
    ['definition', () => getProgramDefinition(DEFINITION.id)],
  ])('does not return populated %s rows to a different live owner', async (_name, read) => {
    await upsertProgramSummaries([
      { id: DETAIL.id, title: DETAIL.name, updatedAt: DETAIL.updatedAt },
    ]);
    await upsertProgramDefinition(DEFINITION);
    sqlite
      .prepare(
        'INSERT INTO program_details (owner_user_id,id,program_id,detail_json,updated_at) VALUES (?,?,?,?,?)'
      )
      .run('owner-a', DETAIL.id, DETAIL.programId, JSON.stringify(DETAIL), DETAIL.updatedAt);
    const getAll = database.getAllAsync;
    jest.spyOn(database, 'getAllAsync').mockImplementation(async (...args) => {
      const rows = await getAll(...args);
      await client.activateLocalDataOwner('owner-b', database);
      return rows;
    });
    await expect(read()).rejects.toThrow(/owner changed during read/);
  });
});
