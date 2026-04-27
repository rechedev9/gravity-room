"""Unit tests for ml.recommendation — load recommendation."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from ml.recommendation import (
    _fallback_recommendation,
    _ml_recommendation,
    compute_per_exercise,
)
from queries import WorkoutRecord


def _record(
    slot_id: str,
    weight: float,
    days_ago: int,
    result: str = "success",
    rpe: float | None = None,
    amrap_reps: int | None = None,
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
        rpe=rpe,
        amrap_reps=amrap_reps,
        recorded_at=dt.isoformat(),
    )


def _rpe_records(slot_id: str, n: int = 15, mostly_success: bool = True) -> list[WorkoutRecord]:
    records = []
    for i in range(n):
        result = "success" if (mostly_success and i % 5 != 0) or (not mostly_success and i % 5 == 0) else "fail"
        records.append(_record(slot_id, 100.0 + (i // 3) * 2.5, days_ago=(n - i) * 3, result=result, rpe=7.0 + (i % 3) * 0.5))
    return records


class TestFallbackRecommendation:
    def test_three_consecutive_successes_increment(self) -> None:
        records = [
            _record("squat", 100.0, days_ago=9, result="success"),
            _record("squat", 100.0, days_ago=6, result="success"),
            _record("squat", 100.0, days_ago=3, result="success"),
        ]
        result = _fallback_recommendation(records, 100.0)
        assert result["shouldIncrement"] is True
        assert result["recommendedWeight"] == 102.5
        assert result["method"] == "consecutive_success"

    def test_recent_failure_no_increment(self) -> None:
        records = [
            _record("squat", 100.0, days_ago=9, result="success"),
            _record("squat", 100.0, days_ago=6, result="success"),
            _record("squat", 100.0, days_ago=3, result="fail"),
        ]
        result = _fallback_recommendation(records, 100.0)
        assert result["shouldIncrement"] is False
        assert result["recommendedWeight"] == 100.0

    def test_fewer_than_three_records_no_increment(self) -> None:
        records = [_record("squat", 100.0, days_ago=3, result="success")]
        result = _fallback_recommendation(records, 100.0)
        assert result["shouldIncrement"] is False

    def test_payload_keys_present(self) -> None:
        records = [_record("squat", 100.0, days_ago=i * 3, result="success") for i in range(3)]
        result = _fallback_recommendation(records, 100.0)
        for key in ("currentWeight", "recommendedWeight", "shouldIncrement", "confidence", "method"):
            assert key in result


class TestMlRecommendation:
    def test_sufficient_rpe_data_returns_result(self) -> None:
        records = _rpe_records("squat", n=15, mostly_success=True)
        result = _ml_recommendation(records, records, 100.0, records[-1].recorded_at)
        assert result is not None
        assert result["method"] == "logistic_regression"

    def test_returns_current_or_incremented_weight(self) -> None:
        records = _rpe_records("squat", n=15, mostly_success=True)
        result = _ml_recommendation(records, records, 100.0, records[-1].recorded_at)
        assert result is not None
        assert result["currentWeight"] == 100.0
        assert result["recommendedWeight"] in (100.0, 102.5)

    def test_confidence_in_valid_range(self) -> None:
        records = _rpe_records("squat", n=15, mostly_success=True)
        result = _ml_recommendation(records, records, 100.0, records[-1].recorded_at)
        if result is not None:
            assert 0.0 <= result["confidence"] <= 0.99

    def test_single_class_falls_back(self) -> None:
        records = [_record("squat", 100.0, days_ago=i * 3, result="success", rpe=7.0) for i in range(15)]
        result = _ml_recommendation(records, records, 100.0, records[-1].recorded_at)
        # Single class → falls back to consecutive_success
        assert result is not None
        assert result["method"] == "consecutive_success"


class TestComputePerExercise:
    def test_empty_records_empty_result(self) -> None:
        result = compute_per_exercise([])
        assert result == {}

    def test_slot_with_records_returns_payload(self) -> None:
        records = [_record("squat", 100.0, days_ago=i * 3, result="success") for i in range(5)]
        result = compute_per_exercise(records)
        assert "squat" in result
        assert result["squat"]["currentWeight"] == 100.0

    def test_defaults_hold_when_insufficient_data(self) -> None:
        records = [_record("squat", 100.0, days_ago=3, result="success")]
        result = compute_per_exercise(records)
        assert result["squat"]["shouldIncrement"] is False
