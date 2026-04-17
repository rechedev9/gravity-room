"""Plateau detection via linear regression on weight progression.

For each exercise (slot_id), analyzes the last 8 weeks of successful sets
(min 8 data points). Fits linear regression on weekly-max weight.

Plateau: slope < 0.1 kg/week AND p-value > 0.1
Confidence: 1 - p_value, capped at 0.95
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

import numpy as np
from scipy.stats import linregress

from queries import WorkoutRecord

_MIN_POINTS = 8
_WEEKS_BACK = 8
_PLATEAU_SLOPE_THRESHOLD = 0.1  # kg/week
_PLATEAU_PVALUE_THRESHOLD = 0.1
_MAX_CONFIDENCE = 0.95


def compute_per_exercise(records: list[WorkoutRecord]) -> dict[str, dict]:
    """Return slot_id -> plateau_detection payload for slots with enough data."""
    now = datetime.now(tz=timezone.utc)
    cutoff = now - timedelta(weeks=_WEEKS_BACK)

    by_slot: dict[str, list[WorkoutRecord]] = defaultdict(list)
    for r in records:
        if r.result != "success" or not r.recorded_at:
            continue
        try:
            dt = datetime.fromisoformat(r.recorded_at.replace("Z", "+00:00"))
        except ValueError:
            continue
        if dt >= cutoff:
            by_slot[r.slot_id].append(r)

    result: dict[str, dict] = {}
    for slot_id, slot_records in by_slot.items():
        payload = _analyze_slot(slot_records)
        if payload is not None:
            result[slot_id] = payload
    return result


def _analyze_slot(records: list[WorkoutRecord]) -> dict | None:
    if len(records) < _MIN_POINTS:
        return None

    by_week: dict[str, list[float]] = defaultdict(list)
    for r in records:
        dt = datetime.fromisoformat(r.recorded_at.replace("Z", "+00:00"))  # type: ignore[arg-type]
        cal = dt.isocalendar()
        week_key = f"{cal.year}-W{cal.week:02d}"
        by_week[week_key].append(r.weight)

    if len(by_week) < 2:
        return None

    weeks = sorted(by_week.keys())
    weights = [max(by_week[w]) for w in weeks]

    xs = np.arange(len(weeks), dtype=float)
    ys = np.array(weights, dtype=float)

    reg = linregress(xs, ys)
    slope = float(reg.slope)
    raw_pvalue = reg.pvalue
    # nan p_value means zero y-variance — perfectly flat, definitively a plateau
    pvalue_is_nan = raw_pvalue != raw_pvalue
    p_value = 0.0 if pvalue_is_nan else float(raw_pvalue)
    r_squared = 0.0 if pvalue_is_nan else float(reg.rvalue ** 2)

    is_plateau = slope < _PLATEAU_SLOPE_THRESHOLD and (pvalue_is_nan or p_value > _PLATEAU_PVALUE_THRESHOLD)
    # For nan case: perfectly flat → max confidence; otherwise confidence = 1 - p_value
    if is_plateau:
        confidence = _MAX_CONFIDENCE if pvalue_is_nan else min(1.0 - p_value, _MAX_CONFIDENCE)
    else:
        confidence = 0.0

    return {
        "isPlateauing": bool(is_plateau),
        "confidence": round(confidence, 3),
        "slope": round(slope, 3),
        "pValue": round(p_value, 4),
        "rSquared": round(r_squared, 3),
        "weeksAnalyzed": len(weeks),
        "currentWeight": weights[-1],
    }
