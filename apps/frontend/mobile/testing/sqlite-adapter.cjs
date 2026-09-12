/**
 * Adapt a caller-owned Node SQLite connection to the mobile async interface.
 * Tests own opening/closing the connection, migration history, and owner setup.
 * This executes real SQL; it is not an emulator for Expo's native scheduling.
 */
function createSqliteTestAdapter(sqlite) {
  const database = {
    execAsync: async (sql) => sqlite.exec(sql),
    runAsync: async (sql, ...params) => sqlite.prepare(sql).run(...params),
    getAllAsync: async (sql, ...params) => sqlite.prepare(sql).all(...params),
    withExclusiveTransactionAsync: async (task) => {
      // If BEGIN fails, we do not own a transaction to roll back.
      sqlite.exec('BEGIN EXCLUSIVE');
      try {
        await task(database);
        sqlite.exec('COMMIT');
      } catch (error) {
        try {
          sqlite.exec('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            'SQLite transaction and rollback failed',
            { cause: error }
          );
        }
        throw error;
      }
    },
  };
  return database;
}

module.exports = { createSqliteTestAdapter };
