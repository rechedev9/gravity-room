"""Orchestrator: run all pipelines for every user and upsert results."""

from __future__ import annotations

import logging

from db import get_conn
from insights import e1rm, frequency, summary, volume
from ml import forecast, plateau, recommendation
from queries import fetch_all_users, fetch_workout_records, upsert_insight

log = logging.getLogger(__name__)


async def run_all() -> dict:
    """Run all compute pipelines. Returns a summary dict."""
    async with get_conn() as conn:
        users = await fetch_all_users(conn)

    log.info("Starting compute for %d users", len(users))
    processed = 0
    errors = 0

    for user in users:
        try:
            await _compute_user(user.user_id)
            processed += 1
        except Exception:
            log.exception("Compute failed for user %s", user.user_id)
            errors += 1

    log.info("Compute done: %d processed, %d errors", processed, errors)
    return {"processed": processed, "errors": errors}


async def _compute_user(user_id: str) -> None:
    async with get_conn() as conn:
        records = await fetch_workout_records(conn, user_id)

    if not records:
        return

    async with get_conn() as conn:
        # Volume trend (aggregate, no exercise_id)
        vol_payload = volume.compute(records)
        if vol_payload:
            await upsert_insight(conn, user_id, "volume_trend", None, vol_payload)

        # Frequency (aggregate)
        freq_payload = frequency.compute(records)
        if freq_payload:
            await upsert_insight(conn, user_id, "frequency", None, freq_payload)

        # e1RM per exercise
        e1rm_map = e1rm.compute_per_exercise(records)
        for exercise_id, payload in e1rm_map.items():
            await upsert_insight(conn, user_id, "e1rm_progression", exercise_id, payload)

        # Exercise summary per slot
        summary_map = summary.compute_per_exercise(records)
        for exercise_id, payload in summary_map.items():
            await upsert_insight(conn, user_id, "exercise_summary", exercise_id, payload)

        for exercise_id, payload in plateau.compute_per_exercise(records).items():
            await upsert_insight(conn, user_id, "plateau_detection", exercise_id, payload)

        for exercise_id, payload in forecast.compute_per_exercise(records).items():
            await upsert_insight(conn, user_id, "e1rm_forecast", exercise_id, payload)

        for exercise_id, payload in recommendation.compute_per_exercise(records).items():
            await upsert_insight(conn, user_id, "load_recommendation", exercise_id, payload)

        await conn.commit()
