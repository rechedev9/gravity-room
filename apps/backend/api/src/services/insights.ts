import { getDb } from '../db';
import { userInsights } from '@gzclp/database/schema';
import { eq, and, inArray, asc, ne } from 'drizzle-orm';
import { META_INSIGHT_TYPE } from '../analytics/queries';

export type InsightRow = {
  insightType: string;
  exerciseId: string | null;
  payload: unknown;
  computedAt: Date;
  validUntil: Date | null;
};

export async function getInsights(userId: string, types: readonly string[]): Promise<InsightRow[]> {
  const db = getDb();

  // Exclude the internal `_meta` cursor marker (see META_INSIGHT_TYPE): it
  // carries no user-facing payload and exists only so the analytics cron can
  // advance a record-less user's computed_at.
  const conditions = [
    eq(userInsights.userId, userId),
    ne(userInsights.insightType, META_INSIGHT_TYPE),
  ];
  if (types.length > 0) {
    conditions.push(inArray(userInsights.insightType, types));
  }

  const rows = await db
    .select({
      insightType: userInsights.insightType,
      exerciseId: userInsights.exerciseId,
      payload: userInsights.payload,
      computedAt: userInsights.computedAt,
      validUntil: userInsights.validUntil,
    })
    .from(userInsights)
    .where(and(...conditions))
    .orderBy(asc(userInsights.insightType), asc(userInsights.exerciseId));

  return rows;
}
