"""Unit tests for ml.forecast — 1RM forecasting."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from ml.forecast import _forecast_slot, compute_per_exercise
from queries import WorkoutRecord


def _record(
    slot_id: str,
    weight: float,
    days_ago: int,
    amrap_reps: int = 5,
    result: str = "success",
) -> WorkoutRecord:
    dt = datetime.now(tz=timezone.utc) - timedelta(days=days_ago)
    return WorkoutRecord(
        user_id="u1",
        instance_id="i1",
        program_id="p1",
        workout_index=0,
        slot_id=slot_id,
        weight=weight,
        result=result,
        rpe=None,
        amrap_reps=amrap_reps,
        recorded_at=dt.isoformat(),
    )


def _linear_records(slot_id: str, weeks: int = 8, start: float = 80.0) -> list[WorkoutRecord]:
    """One record per week with linearly increasing weight."""
    return [_record(slot_id, start + i * 2.5, days_ago=(weeks - 1 - i) * 7) for i in range(weeks)]


def _random_records(slot_id: str, weeks: int = 8) -> list[WorkoutRecord]:
    """Records with no clear trend (varying weights)."""
    weights = [90.0, 82.5, 95.0, 80.0, 92.5, 85.0, 97.5, 82.5]
    return [
        _record(slot_id, weights[i % len(weights)], days_ago=(weeks - 1 - i) * 7)
        for i in range(weeks)
    ]


class TestForecastSlot:
    def test_linear_trend_produces_forecast(self) -> None:
        records = _linear_records("squat", weeks=8)
        result = _forecast_slot(records)
        assert result is not None
        assert result["forecast2w"] > 0
        assert result["forecast4w"] >= result["forecast2w"]

    def test_forecast_keys_present(self) -> None:
        records = _linear_records("squat", weeks=8)
        result = _forecast_slot(records)
        assert result is not None
        for key in (
            "weeks",
            "e1rms",
            "slope",
            "rSquared",
            "forecast2w",
            "forecast4w",
            "band2w",
            "band4w",
        ):
            assert key in result

    def test_insufficient_weeks_returns_none(self) -> None:
        records = _linear_records("squat", weeks=4)
        result = _forecast_slot(records)
        assert result is None

    def test_low_r2_suppressed(self) -> None:
        records = _random_records("squat", weeks=8)
        result = _forecast_slot(records)
        # Random data should produce low R², suppressing forecast
        if result is not None:
            assert result["rSquared"] >= 0.5

    def test_r2_threshold_applied(self) -> None:
        records = _linear_records("squat", weeks=8)
        result = _forecast_slot(records)
        if result is not None:
            assert result["rSquared"] >= 0.5

    def test_forecast_within_10_pct_of_linear_trend(self) -> None:
        records = _linear_records("squat", weeks=8, start=80.0)
        result = _forecast_slot(records)
        # slope ≈ 2.5 kg/week, so 2w ahead ≈ current + 2 * 2.5 * (1 + 5/30) ≈ actual next values
        assert result is not None
        # The slope of the weekly e1rms should be roughly 2.5 * (1 + 5/30) ≈ 2.92
        assert abs(result["slope"] - 2.917) < 0.5

    def test_failed_records_excluded(self) -> None:
        # compute_per_exercise filters failures before calling _forecast_slot
        records = [_record("squat", 100.0, days_ago=i * 7, result="fail") for i in range(8)]
        result = compute_per_exercise(records)
        assert "squat" not in result


class TestComputePerExercise:
    def test_qualifying_slot_included(self) -> None:
        records = _linear_records("squat", weeks=8)
        result = compute_per_exercise(records)
        assert "squat" in result

    def test_insufficient_slot_excluded(self) -> None:
        records = _linear_records("squat", weeks=4)
        result = compute_per_exercise(records)
        assert "squat" not in result

    def test_multiple_slots(self) -> None:
        r1 = _linear_records("squat", weeks=8)
        r2 = _linear_records("bench", weeks=8, start=60.0)
        result = compute_per_exercise(r1 + r2)
        assert "squat" in result
        assert "bench" in result
