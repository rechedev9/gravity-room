"""Per-exercise summary insight.

Aggregates sets, reps, total volume, success rate, and average RPE per slot.
"""

from __future__ import annotations

from collections import defaultdict

from queries import WorkoutRecord

_DEFAULT_REPS = 5


def compute_per_exercise(records: list[WorkoutRecord]) -> dict[str, dict]:
    """Returns slot_id -> exercise_summary payload for all slots."""
    by_slot: dict[str, list[WorkoutRecord]] = defaultdict(list)
    for r in records:
        by_slot[r.slot_id].append(r)

    result: dict[str, dict] = {}
    for slot_id, slot_records in by_slot.items():
        result[slot_id] = _summarise(slot_records)
    return result


def _summarise(records: list[WorkoutRecord]) -> dict:
    total_sets = len(records)
    success_sets = sum(1 for r in records if r.result == "success")

    total_volume = 0.0
    rpe_values: list[float] = []

    for r in records:
        if r.result == "success":
            reps = r.amrap_reps if r.amrap_reps and r.amrap_reps > 0 else _DEFAULT_REPS
            total_volume += r.weight * reps
        if r.rpe is not None:
            rpe_values.append(r.rpe)

    success_rate = round(success_sets / total_sets * 100, 1) if total_sets else 0.0
    avg_rpe = round(sum(rpe_values) / len(rpe_values), 1) if rpe_values else None

    return {
        "totalSets": total_sets,
        "successSets": success_sets,
        "successRate": success_rate,
        "totalVolume": round(total_volume, 1),
        "avgRpe": avg_rpe,
    }
