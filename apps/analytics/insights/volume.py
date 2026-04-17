"""Weekly volume trend insight.

Aggregates total volume (weight × reps_equivalent) per week and computes
linear slope and direction.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from queries import WorkoutRecord

# Assume each set contributes a fixed rep count when actual reps are absent.
_DEFAULT_REPS = 5


def compute(records: list[WorkoutRecord]) -> dict | None:
    """Return a volume_trend payload or None if insufficient data."""
    weekly: dict[str, float] = defaultdict(float)

    for r in records:
        if r.result != "success":
            continue
        reps = r.amrap_reps if r.amrap_reps and r.amrap_reps > 0 else _DEFAULT_REPS
        volume = r.weight * reps

        week_key = _week_key(r.recorded_at)
        if week_key:
            weekly[week_key] += volume

    if len(weekly) < 3:
        return None

    weeks = sorted(weekly.keys())
    volumes = [weekly[w] for w in weeks]

    slope = _linear_slope(volumes)
    direction = "up" if slope > 0.5 else ("down" if slope < -0.5 else "flat")

    return {
        "weeks": weeks,
        "volumes": volumes,
        "slope": round(slope, 2),
        "direction": direction,
    }


def _week_key(timestamp: str | None) -> str | None:
    if not timestamp:
        return None
    try:
        dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        # ISO week: YYYY-Www
        return f"{dt.isocalendar().year}-W{dt.isocalendar().week:02d}"
    except ValueError:
        return None


def _linear_slope(values: list[float]) -> float:
    n = len(values)
    if n < 2:
        return 0.0
    xs = list(range(n))
    x_mean = sum(xs) / n
    y_mean = sum(values) / n
    num = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, values))
    den = sum((x - x_mean) ** 2 for x in xs)
    return num / den if den else 0.0
