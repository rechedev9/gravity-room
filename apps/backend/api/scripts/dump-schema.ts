#!/usr/bin/env bun
/**
 * Emits Drizzle table metadata as JSON on stdout.
 * Consumed by scripts/refresh-claude-context.ts in the repo root.
 */
import { is, getTableColumns, getTableName, Table } from 'drizzle-orm';
import * as schema from '../src/db/schema';

type ColInfo = {
  name: string;
  type: string;
  notNull: boolean;
  primary: boolean;
  unique: boolean;
};

type TableInfo = {
  exportName: string;
  tableName: string;
  columns: ColInfo[];
};

const tables: TableInfo[] = [];

for (const [exportName, value] of Object.entries(schema)) {
  if (!value || typeof value !== 'object') continue;
  if (!is(value, Table)) continue;

  const cols = getTableColumns(value);
  const tableName = getTableName(value);

  const columns: ColInfo[] = Object.values(cols).map((col) => {
    const c = col as unknown as {
      name: string;
      columnType?: string;
      notNull?: boolean;
      primary?: boolean;
      isUnique?: boolean;
    };
    return {
      name: c.name,
      type: stripPgPrefix(c.columnType ?? 'unknown'),
      notNull: !!c.notNull,
      primary: !!c.primary,
      unique: !!c.isUnique,
    };
  });

  tables.push({ exportName, tableName, columns });
}

function stripPgPrefix(t: string): string {
  let s = t.startsWith('Pg') ? t.slice(2) : t;
  // Drizzle encodes JS-number mode in the type name (e.g., BigSerial53).
  s = s.replace(/(53|64)$/, '');
  // PgEnumColumn → enum (the wrapping "Column" suffix is internal noise).
  s = s.replace(/Column$/, '');
  return s.toLowerCase();
}

process.stdout.write(JSON.stringify(tables, null, 2));
