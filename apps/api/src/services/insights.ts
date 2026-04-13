import { getDb } from '../db';
import { userInsights } from '../db/schema';
import { eq, and, inArray, asc } from 'drizzle-orm';

export type InsightRow = {
  insightType: string;
  exerciseId: string | null;
  payload: unknown;
  computedAt: Date;
  validUntil: Date | null;
};

export async function getInsights(userId: string, types: string[]): Promise<InsightRow[]> {
  const db = getDb();

  const conditions = [eq(userInsights.userId, userId)];
  if (types.length > 0) {
    conditions.push(inArray(userInsights.insightType, types));
  }

  const rows = await db
    .select({
      insightType: userInsights.insightType,
      exerciseId: userInsights.exerciseId,
      payload: userInsights.insightData,
      computedAt: userInsights.computedAt,
      validUntil: userInsights.validUntil,
    })
    .from(userInsights)
    .where(and(...conditions))
    .orderBy(asc(userInsights.insightType), asc(userInsights.exerciseId));

  return rows;
}
