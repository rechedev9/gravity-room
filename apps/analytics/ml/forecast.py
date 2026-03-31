"""1RM forecasting via linear regression on weekly Epley-1RM series.

Requires min 6 weeks of data per exercise.
Predicts 2 and 4 weeks ahead with 95% prediction interval bands.
R² < 0.5 suppresses the forecast (insufficient linearity).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime

import numpy as np
from scipy.stats import linregress, t as t_dist

from insights.e1rm import epley
from queries import WorkoutRecord

_MIN_WEEKS = 6
_R2_THRESHOLD = 0.5
_DEFAULT_REPS = 5


def compute_per_exercise(records: list[WorkoutRecord]) -> dict[str, dict]:
    """Return slot_id -> e1rm_forecast payload for qualifying exercises."""
    by_slot: dict[str, list[WorkoutRecord]] = defaultdict(list)
    for r in records:
        if r.result == "success":
            by_slot[r.slot_id].append(r)

    result: dict[str, dict] = {}
    for slot_id, slot_records in by_slot.items():
        payload = _forecast_slot(slot_records)
        if payload is not None:
            result[slot_id] = payload
    return result


def _forecast_slot(records: list[WorkoutRecord]) -> dict | None:
    by_week: dict[str, list[float]] = defaultdict(list)
    for r in records:
        if not r.recorded_at:
            continue
        try:
            dt = datetime.fromisoformat(r.recorded_at.replace("Z", "+00:00"))
        except ValueError:
            continue
        reps = r.amrap_reps if r.amrap_reps and r.amrap_reps > 0 else _DEFAULT_REPS
        e1rm_val = epley(r.weight, reps)
        cal = dt.isocalendar()
        week_key = f"{cal.year}-W{cal.week:02d}"
        by_week[week_key].append(e1rm_val)

    if len(by_week) < _MIN_WEEKS:
        return None

    weeks = sorted(by_week.keys())[-16:]
    e1rms = [max(by_week[w]) for w in weeks]

    n = len(weeks)
    xs = np.arange(n, dtype=float)
    ys = np.array(e1rms, dtype=float)

    reg = linregress(xs, ys)
    raw_rvalue = reg.rvalue
    # nan rvalue means zero y-variance (flat e1rm) — no meaningful trend to forecast
    if raw_rvalue != raw_rvalue:
        return None
    r_squared = float(raw_rvalue ** 2)

    if r_squared < _R2_THRESHOLD:
        return None

    slope = float(reg.slope)
    intercept = float(reg.intercept)

    forecast_2w = intercept + slope * (n + 1)
    forecast_4w = intercept + slope * (n + 3)

    # 95% prediction interval half-width
    x_mean = float(xs.mean())
    ss_xx = float(((xs - x_mean) ** 2).sum())
    residuals = ys - (intercept + slope * xs)
    mse = float((residuals ** 2).sum()) / (n - 2) if n > 2 else 0.0
    t_crit = float(t_dist.ppf(0.975, df=n - 2)) if n > 2 else 1.96

    def _band(x_new: float) -> float:
        if ss_xx == 0 or mse == 0:
            return 0.0
        se_pred = (mse * (1 + 1 / n + (x_new - x_mean) ** 2 / ss_xx)) ** 0.5
        return t_crit * se_pred

    return {
        "weeks": weeks,
        "e1rms": [round(v, 1) for v in e1rms],
        "slope": round(slope, 3),
        "rSquared": round(r_squared, 3),
        "forecast2w": round(max(forecast_2w, 0.0), 1),
        "forecast4w": round(max(forecast_4w, 0.0), 1),
        "band2w": round(_band(n + 1), 1),
        "band4w": round(_band(n + 3), 1),
    }
