"""Generate golden reference values from the live scipy / sklearn / numpy stack.

HISTORICAL: the Python analytics service this script imports
(apps/backend/analytics) has been DELETED now that the TypeScript port under
apps/backend/api/src/analytics is the single source of truth. golden.json next to
this file is the frozen oracle the TS parity tests load and is checked in, so this
generator is NOT needed for normal builds. To re-run it you must restore the
removed apps/backend/analytics service from git history first; it will not import
against the current tree.

This script imports the LIVE Python analytics service at apps/backend/analytics
(insights/, ml/, queries.py) and runs its pipeline functions on fixed-timestamp
fixtures, emitting golden.json next to this file. golden.json is the source of
truth the TypeScript parity tests load, so the oracle is always computed against
the CURRENT V2 Python implementation (including V2-specific changes such as the
finite-guard in ml/forecast.py).

The DB drivers queries.py imports (psycopg / psycopg_pool) are stubbed before
import, mirroring apps/backend/analytics/tests/conftest.py, so no real database
is required.

These are the SAME library functions the Python analytics service uses
(scipy.stats.linregress, scipy.stats.t.cdf / t.ppf, sklearn LogisticRegression,
and the Epley formula), so the emitted JSON is an exact parity oracle for the
TypeScript port under apps/backend/api/src/analytics.

Run command:  python generate_golden.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import ModuleType
from unittest.mock import MagicMock

import numpy as np
from scipy.stats import linregress
from scipy.stats import t as t_dist
from sklearn.linear_model import LogisticRegression

OUT = Path(__file__).parent / "golden.json"

# --- import the live Python analytics pipelines ----------------------------
# These are the modules the TypeScript port under
# apps/backend/api/src/analytics/pipelines mirrors. Importing and running them
# on fixed-timestamp fixtures yields exact per-pipeline payload oracles. The
# Python service deletes in W13; until then this is the parity source of truth.
ANALYTICS_ROOT = Path(__file__).resolve().parents[4] / "analytics"
sys.path.insert(0, str(ANALYTICS_ROOT))

# Stub the DB drivers queries.py imports (mirrors analytics/tests/conftest.py).
for _name, _attr in (("psycopg", "AsyncConnection"), ("psycopg_pool", "AsyncConnectionPool")):
    if _name not in sys.modules:
        _mod = ModuleType(_name)
        setattr(_mod, _attr, MagicMock())
        sys.modules[_name] = _mod

from insights import e1rm as e1rm_mod  # noqa: E402
from insights import frequency as frequency_mod  # noqa: E402
from insights import summary as summary_mod  # noqa: E402
from insights import volume as volume_mod  # noqa: E402
from ml import forecast as forecast_mod  # noqa: E402
from ml import plateau as plateau_mod  # noqa: E402
from ml import recommendation as recommendation_mod  # noqa: E402
from queries import WorkoutRecord  # noqa: E402


# --- Epley (mirrors insights/e1rm.py:epley) -------------------------------
def epley(weight: float, reps: int) -> float:
    if reps == 1:
        return weight
    return weight * (1 + reps / 30)


# --- linregress datasets ---------------------------------------------------
def _linregress_case(name: str, x: list[float], y: list[float]) -> dict:
    reg = linregress(np.array(x, dtype=float), np.array(y, dtype=float))
    rval = float(reg.rvalue)
    return {
        "name": name,
        "x": x,
        "y": y,
        "slope": float(reg.slope),
        "intercept": float(reg.intercept),
        "rvalue": rval if rval == rval else None,  # NaN -> null
        "rSquared": float(rval**2) if rval == rval else None,
        "pvalue": float(reg.pvalue) if float(reg.pvalue) == float(reg.pvalue) else None,
        "stderr": float(reg.stderr),
    }


# e1rm series produced by forecast._linear_records("squat", weeks=8): one
# record per week, weight 80 + 2.5*i, reps default 5 -> epley = w * (1 + 5/30).
_e1rm_linear = [round(epley(80.0 + i * 2.5, 5), 10) for i in range(8)]

linregress_cases = [
    _linregress_case("perfect_line", [0, 1, 2, 3, 4], [1, 3, 5, 7, 9]),
    _linregress_case("small_noisy", [0, 1, 2, 3], [1, 2, 3, 5]),
    _linregress_case("flat", [0, 1, 2, 3, 4, 5], [100, 100, 100, 100, 100, 100]),
    _linregress_case("e1rm_linear_8w", list(range(8)), _e1rm_linear),
    _linregress_case(
        "decreasing", [0, 1, 2, 3, 4, 5, 6, 7], [100, 99, 101, 97, 96, 98, 94, 93]
    ),
    _linregress_case(
        "weak_trend", [0, 1, 2, 3, 4, 5, 6, 7], [90, 82.5, 95, 80, 92.5, 85, 97.5, 82.5]
    ),
]


# --- Student-t cdf / ppf ---------------------------------------------------
t_cdf_cases = []
for x, df in [
    (0.0, 5),
    (1.0, 10),
    (2.0, 8),
    (-1.5, 4),
    (2.570582, 5),
    (2.228139, 10),
    (3.5, 2),
    (-2.0, 1),
    (1.96, 1000),
    (0.5, 30),
]:
    t_cdf_cases.append({"x": x, "df": df, "cdf": float(t_dist.cdf(x, df))})

t_ppf_cases = []
for p, df in [
    (0.975, 1),
    (0.975, 2),
    (0.95, 5),
    (0.975, 5),
    (0.975, 6),
    (0.95, 10),
    (0.975, 10),
    (0.975, 30),
    (0.975, 100),
    (0.025, 6),
    (0.5, 7),
    (0.9, 4),
]:
    t_ppf_cases.append({"p": p, "df": df, "ppf": float(t_dist.ppf(p, df))})


# --- Epley cases -----------------------------------------------------------
epley_cases = []
for w, reps in [(100.0, 5), (100.0, 1), (140.0, 8), (60.0, 3), (80.0, 5), (0.0, 5)]:
    epley_cases.append({"weight": w, "reps": reps, "e1rm": epley(w, reps)})


# --- ISO week --------------------------------------------------------------
iso_week_cases = []
for ds in [
    "2021-01-01",
    "2020-12-31",
    "2024-12-30",
    "2025-01-01",
    "2023-01-01",
    "2016-01-01",
    "2026-06-26",
    "2019-12-29",
    "2019-12-30",
    "2018-01-01",
    "2015-12-31",
]:
    cal = datetime.fromisoformat(ds).isocalendar()
    iso_week_cases.append(
        {
            "date": ds,
            "isoYear": cal.year,
            "isoWeek": cal.week,
            "key": f"{cal.year}-W{cal.week:02d}",
        }
    )

# Offset-aware timestamps: Python isocalendar uses the wall-clock date in the
# timestamp's own offset (NOT the UTC instant). These exercise that semantic.
iso_week_ts_cases = []
for ts in [
    "2021-01-01T00:30:00+00:00",
    "2021-01-01T00:30:00+02:00",
    "2020-12-31T23:30:00-05:00",
    "2024-12-30T12:00:00Z",
    "2026-06-26T08:00:00+00:00",
]:
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    cal = dt.isocalendar()
    iso_week_ts_cases.append(
        {"ts": ts, "isoYear": cal.year, "isoWeek": cal.week, "key": f"{cal.year}-W{cal.week:02d}"}
    )


# --- Logistic regression (mirrors ml/recommendation._ml_recommendation) ----
def _logistic_case(name: str, X: list[list[float]], y: list[int], queries: list[list[float]]) -> dict:
    Xa = np.array(X, dtype=float)
    ya = np.array(y, dtype=int)

    col_mean = Xa.mean(axis=0)
    col_std = Xa.std(axis=0)
    col_std[col_std == 0] = 1.0
    X_scaled = (Xa - col_mean) / col_std

    clf = LogisticRegression(max_iter=200, random_state=42)
    clf.fit(X_scaled, ya)

    q = np.array(queries, dtype=float)
    q_scaled = (q - col_mean) / col_std
    probs = [float(clf.predict_proba(q_scaled[i : i + 1])[0][1]) for i in range(len(queries))]

    return {
        "name": name,
        "X": X,
        "y": y,
        "queries": queries,
        "colMean": col_mean.tolist(),
        "colStd": col_std.tolist(),
        "coef": clf.coef_[0].tolist(),
        "intercept": float(clf.intercept_[0]),
        "probs": probs,
    }


# Features: [weight, success_rate, rpe, volume_last_week, days_since]
# Fixture 1: reconstructs the structure of test_recommendation._rpe_records(n=15).
_X1: list[list[float]] = []
_y1: list[int] = []
for i in range(15):
    weight = 100.0 + (i // 3) * 2.5
    result_success = (i % 5) != 0
    rpe = 7.0 + (i % 3) * 0.5
    # success_rate at this weight and a plausible volume / recency signal
    sr = 0.8 if result_success else 0.4
    vol = 500.0 + (i % 4) * 50.0
    dsl = 3.0 + (i % 2) * 2.0
    _X1.append([weight, sr, rpe, vol, dsl])
    _y1.append(1 if result_success else 0)

logistic_cases = [
    _logistic_case(
        "rpe_records_like",
        _X1,
        _y1,
        [
            [105.0, 0.8, 5.0, 600.0, 3.0],
            [107.5, 0.5, 5.0, 600.0, 3.0],
        ],
    ),
    _logistic_case(
        "separable",
        [
            [60.0, 0.2, 9.0, 200.0, 10.0],
            [62.5, 0.3, 8.5, 220.0, 8.0],
            [65.0, 0.4, 8.0, 240.0, 7.0],
            [100.0, 0.9, 6.0, 600.0, 3.0],
            [102.5, 0.85, 6.5, 620.0, 3.0],
            [105.0, 0.95, 5.5, 640.0, 2.0],
            [70.0, 0.5, 7.5, 300.0, 6.0],
            [95.0, 0.8, 6.5, 580.0, 4.0],
            [80.0, 0.6, 7.0, 400.0, 5.0],
            [110.0, 0.95, 5.0, 700.0, 2.0],
        ],
        [0, 0, 0, 1, 1, 1, 0, 1, 0, 1],
        [
            [90.0, 0.7, 6.0, 500.0, 4.0],
            [92.5, 0.7, 6.0, 500.0, 4.0],
        ],
    ),
]


# --- pipeline payload oracles ----------------------------------------------
# Fixed-timestamp fixtures driven through the live Python pipeline functions.
# Records are emitted in the camelCase WorkoutRecord shape the TS port consumes.

_TS = "T12:00:00+00:00"
# Eight consecutive ISO-week Mondays (W10..W17 of 2025).
_MONDAYS = [
    "2025-03-03",
    "2025-03-10",
    "2025-03-17",
    "2025-03-24",
    "2025-03-31",
    "2025-04-07",
    "2025-04-14",
    "2025-04-21",
]


def _rec(
    slot: str,
    weight: float,
    recorded_at: str | None,
    result: str = "success",
    rpe: float | None = None,
    amrap: int | None = None,
    idx: int = 0,
) -> WorkoutRecord:
    return WorkoutRecord(
        user_id="u1",
        instance_id="i1",
        program_id="p1",
        workout_index=idx,
        slot_id=slot,
        weight=float(weight),
        result=result,
        rpe=(float(rpe) if rpe is not None else None),
        amrap_reps=amrap,
        recorded_at=recorded_at,
    )


def _rec_json(r: WorkoutRecord) -> dict:
    return {
        "userId": r.user_id,
        "instanceId": r.instance_id,
        "programId": r.program_id,
        "workoutIndex": r.workout_index,
        "slotId": r.slot_id,
        "weight": r.weight,
        "result": r.result,
        "rpe": r.rpe,
        "amrapReps": r.amrap_reps,
        "recordedAt": r.recorded_at,
    }


def _case(records: list[WorkoutRecord], payload: object) -> dict:
    return {"records": [_rec_json(r) for r in records], "payload": payload}


# volume: successful sets across four ISO weeks (aggregate).
_volume_records = [
    _rec("squat", 100.0, _MONDAYS[0] + _TS, amrap=5),
    _rec("squat", 100.0, _MONDAYS[0] + _TS, amrap=8, idx=1),
    _rec("bench", 60.0, _MONDAYS[1] + _TS, amrap=5),
    _rec("squat", 102.5, _MONDAYS[2] + _TS, amrap=5),
    _rec("squat", 105.0, _MONDAYS[3] + _TS, amrap=3),
    _rec("squat", 95.0, _MONDAYS[3] + _TS, result="fail", amrap=5, idx=1),
]

# frequency: four distinct dates, three of them consecutive (streak = 3).
_frequency_records = [
    _rec("squat", 100.0, "2025-03-20" + _TS),
    _rec("squat", 100.0, "2025-04-01" + _TS),
    _rec("bench", 60.0, "2025-04-02" + _TS),
    _rec("squat", 100.0, "2025-04-03" + _TS),
    _rec("squat", 100.0, "2025-04-03" + _TS, idx=1),
]

# e1rm: one slot, five successful sets across distinct dates.
_e1rm_records = [
    _rec("squat", 100.0, _MONDAYS[0] + _TS, amrap=5),
    _rec("squat", 102.5, _MONDAYS[1] + _TS, amrap=5),
    _rec("squat", 105.0, _MONDAYS[2] + _TS, amrap=3),
    _rec("squat", 107.5, _MONDAYS[3] + _TS, amrap=8),
    _rec("squat", 110.0, _MONDAYS[4] + _TS, amrap=5),
]

# summary: one slot, mixed success/fail with RPE.
_summary_records = [
    _rec("squat", 100.0, _MONDAYS[0] + _TS, amrap=5, rpe=7.0),
    _rec("squat", 100.0, _MONDAYS[1] + _TS, amrap=8, rpe=8.0),
    _rec("squat", 105.0, _MONDAYS[2] + _TS, result="fail", rpe=9.5),
    _rec("squat", 105.0, _MONDAYS[3] + _TS, amrap=5),
]

# plateau: one record per week across eight weeks (drives _analyze_slot).
_plateau_flat = [_rec("squat", 100.0, m + _TS) for m in _MONDAYS]
_plateau_increasing = [_rec("squat", 80.0 + 2.5 * i, _MONDAYS[i] + _TS) for i in range(8)]
# Flat-with-noise: slope below 0.1 kg/wk and p > 0.1 -> non-degenerate plateau
# with confidence = min(1 - p, 0.95) strictly inside (0, 0.95).
_plateau_mild_weights = [100.0, 101.0, 99.0, 100.0, 101.0, 99.0, 100.0, 100.0]
_plateau_mild = [_rec("squat", _plateau_mild_weights[i], _MONDAYS[i] + _TS) for i in range(8)]

# forecast: linear (strong) and weak-trend (suppressed) weekly series.
_forecast_linear = [_rec("squat", 80.0 + 2.5 * i, _MONDAYS[i] + _TS, amrap=5) for i in range(8)]
_forecast_weak_weights = [90.0, 82.5, 95.0, 80.0, 92.5, 85.0, 97.5, 82.5]
_forecast_weak = [_rec("squat", _forecast_weak_weights[i], _MONDAYS[i] + _TS, amrap=5) for i in range(8)]
# Noisy but linear (r-squared ~0.985): non-zero prediction-interval bands that
# exercise the Student-t critical value t.ppf(0.975, n-2).
_forecast_noisy_weights = [80.0, 83.0, 84.0, 88.0, 89.0, 93.0, 94.0, 98.0]
_forecast_noisy = [_rec("squat", _forecast_noisy_weights[i], _MONDAYS[i] + _TS, amrap=5) for i in range(8)]

# recommendation ML: 15 RPE-logged sessions, two outcome classes, fixed dates.
_rec_base = datetime(2025, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
_recommendation_ml = []
for i in range(15):
    _weight = 100.0 + (i // 3) * 2.5
    _result = "success" if (i % 5) != 0 else "fail"
    _rpe = 7.0 + (i % 3) * 0.5
    _dt = (_rec_base - timedelta(days=(15 - i) * 3)).isoformat()
    _recommendation_ml.append(_rec("squat", _weight, _dt, result=_result, rpe=_rpe, idx=i))

# recommendation fallback: <10 RPE sessions -> consecutive-success heuristic.
_recommendation_increment = [
    _rec("squat", 100.0, _MONDAYS[0] + _TS, idx=0),
    _rec("squat", 100.0, _MONDAYS[1] + _TS, idx=1),
    _rec("squat", 100.0, _MONDAYS[2] + _TS, idx=2),
]
_recommendation_hold = [
    _rec("squat", 100.0, _MONDAYS[0] + _TS, idx=0),
    _rec("squat", 100.0, _MONDAYS[1] + _TS, idx=1),
    _rec("squat", 100.0, _MONDAYS[2] + _TS, result="fail", idx=2),
]

pipeline_cases = {
    "volume": _case(_volume_records, volume_mod.compute(_volume_records)),
    "frequency": _case(_frequency_records, frequency_mod.compute(_frequency_records)),
    "e1rm": _case(_e1rm_records, e1rm_mod.compute_per_exercise(_e1rm_records)),
    "summary": _case(_summary_records, summary_mod.compute_per_exercise(_summary_records)),
    "plateauFlat": _case(_plateau_flat, plateau_mod._analyze_slot(_plateau_flat)),
    "plateauIncreasing": _case(
        _plateau_increasing, plateau_mod._analyze_slot(_plateau_increasing)
    ),
    "plateauMild": _case(_plateau_mild, plateau_mod._analyze_slot(_plateau_mild)),
    "forecastLinear": _case(_forecast_linear, forecast_mod._forecast_slot(_forecast_linear)),
    "forecastLowR2": _case(_forecast_weak, forecast_mod._forecast_slot(_forecast_weak)),
    "forecastNoisy": _case(_forecast_noisy, forecast_mod._forecast_slot(_forecast_noisy)),
    "recommendationMl": _case(
        _recommendation_ml, recommendation_mod._recommend_slot(_recommendation_ml)
    ),
    "recommendationFallbackIncrement": _case(
        _recommendation_increment,
        recommendation_mod._recommend_slot(_recommendation_increment),
    ),
    "recommendationFallbackHold": _case(
        _recommendation_hold, recommendation_mod._recommend_slot(_recommendation_hold)
    ),
}


golden = {
    "linregress": linregress_cases,
    "tCdf": t_cdf_cases,
    "tPpf": t_ppf_cases,
    "epley": epley_cases,
    "isoWeek": iso_week_cases,
    "isoWeekTs": iso_week_ts_cases,
    "logistic": logistic_cases,
    "pipelines": pipeline_cases,
    "meta": {
        "scipy": __import__("scipy").__version__,
        "sklearn": __import__("sklearn").__version__,
        "numpy": np.__version__,
    },
}

OUT.write_text(json.dumps(golden, indent=2))
print(f"wrote {OUT} ({len(json.dumps(golden))} bytes)")
print("meta:", golden["meta"])
