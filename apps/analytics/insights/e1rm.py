"""Estimated 1RM progression insight (Epley formula).

Groups records by exercise/slot_id and computes the Epley e1RM over time.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from queries import WorkoutRecord

# Minimum successful records needed to emit a series
_MIN_POINTS = 4

# Default reps when amrapReps is absent (a single work set with no AMRAP info)
_DEFAULT_REPS = 5


def epley(weight: float, reps: int) -> float:
    """Epley formula: w * (1 + reps/30)."""
    if reps == 1:
        return weight
    return weight * (1 + reps / 30)


def compute_per_exercise(records: list[WorkoutRecord]) -> dict[str, dict]:
    """
    Returns a mapping of slot_id -> e1rm_progression payload.
    Only slots with enough data are included.
    """
    # Group by slot_id
    by_slot: dict[str, list[WorkoutRecord]] = defaultdict(list)
    for r in records:
        if r.result == "success":
            by_slot[r.slot_id].append(r)

    result: dict[str, dict] = {}
    for slot_id, slot_records in by_slot.items():
        payload = _build_series(slot_records)
        if payload:
            result[slot_id] = payload
    return result


def _build_series(records: list[WorkoutRecord]) -> dict | None:
    if len(records) < _MIN_POINTS:
        return None

    # Sort by recorded_at (fall back to workout_index)
    records = sorted(
        records,
        key=lambda r: (r.recorded_at or "", r.workout_index),
    )

    dates: list[str] = []
    e1rms: list[float] = []

    for r in records:
        reps = r.amrap_reps if r.amrap_reps and r.amrap_reps > 0 else _DEFAULT_REPS
        e1rm = epley(r.weight, reps)
        date = _format_date(r.recorded_at, r.workout_index)
        dates.append(date)
        e1rms.append(round(e1rm, 1))

    current_max = max(e1rms)
    return {
        "dates": dates,
        "e1rms": e1rms,
        "currentMax": current_max,
    }


def _format_date(timestamp: str | None, workout_index: int) -> str:
    if timestamp:
        try:
            dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            return dt.date().isoformat()
        except ValueError:
            pass
    return f"#{workout_index + 1}"
