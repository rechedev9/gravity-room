const { DatabaseSync } = require('node:sqlite');
const client = require('../db/client');
const { MIGRATIONS } = require('../db/migrations');
const { listProgramSummaries, upsertProgramSummaries } = require('./program-repository');

describe('program artwork identity in SQLite', () => {
  let sqlite;
  let database;

  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    database = {
      execAsync: async (sql) => {
        sqlite.exec(sql);
      },
      runAsync: async (sql, ...params) => sqlite.prepare(sql).run(...params),
      getAllAsync: async (sql, ...params) => sqlite.prepare(sql).all(...params),
      withExclusiveTransactionAsync: async (task) => {
        sqlite.exec('BEGIN EXCLUSIVE');
        try {
          await task(database);
          sqlite.exec('COMMIT');
        } catch (error) {
          sqlite.exec('ROLLBACK');
          throw error;
        }
      },
    };
    jest.spyOn(client, 'getDatabase').mockReturnValue(database);
    await client.bootstrapDatabase(
      database,
      MIGRATIONS.filter((step) => step.version <= 4)
    );
    sqlite.exec(
      "INSERT INTO program_summaries (owner_user_id,id,title,updated_at) VALUES ('athlete-a','legacy','Old plan','2026-09-01')"
    );
    sqlite.exec(
      "INSERT INTO program_details (owner_user_id,id,program_id,detail_json,updated_at) VALUES ('athlete-a','legacy','gzclp','{}','2026-09-01')"
    );
    await client.activateLocalDataOwner('athlete-a', database);
  });

  afterEach(() => {
    client.deactivateLocalDataOwner();
    jest.restoreAllMocks();
    sqlite.close();
  });

  it('upgrades a version 4 cache without losing plans and preserves artwork identity after rename', async () => {
    expect(await listProgramSummaries()).toEqual([
      { id: 'legacy', title: 'Old plan', programId: 'gzclp', updatedAt: '2026-09-01' },
    ]);
    const plan = {
      id: 'legacy',
      programId: 'gzclp',
      title: 'My renamed training plan',
      updatedAt: '2026-09-04',
    };
    await upsertProgramSummaries([plan]);
    expect(await listProgramSummaries()).toEqual([plan]);
    await upsertProgramSummaries([{ id: plan.id, title: plan.title, updatedAt: plan.updatedAt }]);
    expect(await listProgramSummaries()).toEqual([plan]);
    await client.activateLocalDataOwner('athlete-b', database);
    expect(await listProgramSummaries()).toEqual([]);
    await client.activateLocalDataOwner('athlete-a', database);
    expect(await listProgramSummaries()).toEqual([plan]);
    expect(sqlite.prepare('PRAGMA user_version').get().user_version).toBe(5);
  });
});
