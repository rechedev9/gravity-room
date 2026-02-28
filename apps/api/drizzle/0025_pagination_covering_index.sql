-- Migration 0025: Covering index for deterministic cursor pagination on program_instances.
-- Uses regular CREATE INDEX (not CONCURRENTLY) because Drizzle's migrator wraps
-- statements in transactions and CONCURRENTLY cannot run inside a transaction.
-- Tables are tiny in production, so the brief lock is acceptable.

CREATE INDEX IF NOT EXISTS program_instances_user_created_id_idx
  ON program_instances (user_id, created_at DESC, id);
