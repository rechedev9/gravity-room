const { DatabaseSync } = require('node:sqlite');
const { createSqliteTestAdapter } = require('../../../testing/sqlite-adapter.cjs');
const client = require('../db/client');
const {
  upsertProgramDetail,
  getProgramDetail,
  purgeProgramLocalData,
} = require('./program-detail-repository');
const { saveSetDrafts, getSetDrafts } = require('./set-draft-repository');
const { enqueueMutation } = require('../sync/mutation-queue-repository');

const detail = (id) => ({
  id,
  programId: 'gzclp',
  name: 'GZCLP',
  config: { squat: 60 },
  metadata: null,
  results: {},
  undoHistory: [],
  resultTimestamps: {},
  completedDates: {},
  definitionId: null,
  customDefinition: null,
  status: 'active',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
});

const mutation = (entityId, dedupeKey) => ({
  entityType: 'program',
  entityId,
  operation: 'result.upsert',
  payload: { slotId: 'squat-t1' },
  dedupeKey,
});

describe('purgeProgramLocalData', () => {
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

  async function queuedFor(entityId) {
    const rows = await database.getAllAsync(
      'SELECT entity_id FROM queued_mutations WHERE owner_user_id = ? AND entity_id = ?',
      'owner-a',
      entityId
    );
    return rows.length;
  }

  it('removes the detail, drafts and queued mutations of one plan only', async () => {
    await upsertProgramDetail(detail('plan-a'));
    await upsertProgramDetail(detail('plan-b'));
    await saveSetDrafts('plan-a', { '0:squat-t1': [{ reps: 3, weight: 60 }] });
    await saveSetDrafts('plan-b', { '0:squat-t1': [{ reps: 3, weight: 60 }] });
    await enqueueMutation(mutation('plan-a', 'a-1'));
    await enqueueMutation(mutation('plan-b', 'b-1'));

    await purgeProgramLocalData('plan-a');

    expect(await getProgramDetail('plan-a')).toBeNull();
    expect(await getSetDrafts('plan-a')).toEqual({});
    expect(await queuedFor('plan-a')).toBe(0);
    expect((await getProgramDetail('plan-b'))?.id).toBe('plan-b');
    expect(Object.keys(await getSetDrafts('plan-b'))).toHaveLength(1);
    expect(await queuedFor('plan-b')).toBe(1);
  });

  it("leaves another owner's rows for the same plan id untouched", async () => {
    await upsertProgramDetail(detail('shared'));
    await client.activateLocalDataOwner('owner-b', database);
    await upsertProgramDetail(detail('shared'));
    await purgeProgramLocalData('shared');
    expect(await getProgramDetail('shared')).toBeNull();
    await client.activateLocalDataOwner('owner-a', database);
    expect((await getProgramDetail('shared'))?.id).toBe('shared');
  });

  it('is a no-op for an unknown plan', async () => {
    await expect(purgeProgramLocalData('missing')).resolves.toBeUndefined();
  });
});
