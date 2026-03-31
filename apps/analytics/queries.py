"""SQL queries to extract raw workout data for analytics pipelines."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import psycopg


@dataclass
class WorkoutRecord:
    user_id: str
    instance_id: str
    program_id: str
    workout_index: int
    slot_id: str
    weight: float
    result: str  # 'success' | 'fail'
    rpe: float | None
    amrap_reps: int | None
    recorded_at: str | None  # ISO timestamp


@dataclass
class UserRow:
    user_id: str


async def fetch_all_users(conn: psycopg.AsyncConnection) -> list[UserRow]:
    """Return all user IDs that have at least one workout result."""
    rows = await conn.execute(
        """
        SELECT DISTINCT user_id::text
        FROM program_instances
        WHERE status IN ('active', 'completed')
        ORDER BY user_id
        """
    )
    return [UserRow(user_id=r[0]) async for r in rows]


async def fetch_workout_records(
    conn: psycopg.AsyncConnection,
    user_id: str,
) -> list[WorkoutRecord]:
    """
    Return all workout slot results for a user, expanded from the JSONB
    results column of program_instances.

    The results column shape: {workout_index: {slot_id: {result, weight, rpe, amrapReps}}}
    result_timestamps: {workout_index: ISO timestamp}
    """
    rows = await conn.execute(
        """
        SELECT
            pi.user_id::text,
            pi.id::text AS instance_id,
            pi.program_id,
            workout_idx::int,
            slot_entry.key AS slot_id,
            (slot_entry.value->>'weight')::float AS weight,
            slot_entry.value->>'result' AS result,
            NULLIF(slot_entry.value->>'rpe', '')::float AS rpe,
            NULLIF(slot_entry.value->>'amrapReps', '')::int AS amrap_reps,
            pi.result_timestamps->>workout_idx AS recorded_at
        FROM program_instances pi,
             jsonb_each(pi.results) AS res(workout_idx, workout_data),
             jsonb_each(res.workout_data) AS slot_entry
        WHERE pi.user_id = $1::uuid
          AND slot_entry.value->>'result' IS NOT NULL
          AND slot_entry.value->>'weight' IS NOT NULL
        ORDER BY pi.created_at, workout_idx::int, slot_entry.key
        """,
        (user_id,),
    )
    records: list[WorkoutRecord] = []
    async for r in rows:
        records.append(
            WorkoutRecord(
                user_id=r[0],
                instance_id=r[1],
                program_id=r[2],
                workout_index=r[3],
                slot_id=r[4],
                weight=float(r[5]),
                result=r[6],
                rpe=r[7],
                amrap_reps=r[8],
                recorded_at=r[9],
            )
        )
    return records


async def upsert_insight(
    conn: psycopg.AsyncConnection,
    user_id: str,
    insight_type: str,
    exercise_id: str | None,
    payload: Any,
) -> None:
    """Upsert a single insight row."""
    import json

    await conn.execute(
        """
        INSERT INTO user_insights (user_id, insight_type, exercise_id, payload, computed_at)
        VALUES ($1::uuid, $2, $3, $4::jsonb, NOW())
        ON CONFLICT ON CONSTRAINT user_insights_unique
        DO UPDATE SET payload = EXCLUDED.payload, computed_at = NOW()
        """,
        (user_id, insight_type, exercise_id, json.dumps(payload)),
    )
