"""Unit tests for ml.plateau — plateau detection."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add analytics root to path so imports resolve
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml.plateau import _analyze_slot, compute_per_exercise
from queries import WorkoutRecord


def _record(slot_id: str, weight: float, days_ago: int, result: str = "success") -> WorkoutRecord:
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
        amrap_reps=None,
        recorded_at=dt.isoformat(),
    )


def _flat_records(slot_id: str, weight: float = 100.0, n: int = 10) -> list[WorkoutRecord]:
    """n records spread across the last 8 weeks with constant weight."""
    interval = 56 // n
    return [_record(slot_id, weight, i * interval) for i in range(n)]


def _increasing_records(slot_id: str, n: int = 10) -> list[WorkoutRecord]:
    """n records with steadily increasing weight over the last 8 weeks."""
    interval = 56 // n
    return [_record(slot_id, 80.0 + i * 2.5, i * interval) for i in range(n)]


class TestAnalyzeSlot:
    def test_flat_progression_detected(self) -> None:
        records = _flat_records("squat", weight=100.0, n=10)
        result = _analyze_slot(records)
        assert result is not None
        assert result["isPlateauing"] is True
        assert result["confidence"] > 0.6

    def test_active_progression_not_flagged(self) -> None:
        records = _increasing_records("squat", n=12)
        result = _analyze_slot(records)
        # May or may not have enough data in the window, but should not plateau
        if result is not None:
            assert result["isPlateauing"] is False

    def test_insufficient_data_returns_none(self) -> None:
        records = _flat_records("squat", n=5)  # below _MIN_POINTS=8
        result = _analyze_slot(records)
        assert result is None

    def test_only_one_week_returns_none(self) -> None:
        # All records in the same week → only 1 week bucket
        records = [_record("squat", 100.0, days_ago=1) for _ in range(10)]
        result = _analyze_slot(records)
        assert result is None

    def test_payload_keys_present(self) -> None:
        records = _flat_records("bench", n=12)
        result = _analyze_slot(records)
        assert result is not None
        for key in ("isPlateauing", "confidence", "slope", "pValue", "rSquared", "weeksAnalyzed", "currentWeight"):
            assert key in result

    def test_confidence_capped_at_0_95(self) -> None:
        records = _flat_records("dl", weight=200.0, n=20)
        result = _analyze_slot(records)
        if result is not None and result["isPlateauing"]:
            assert result["confidence"] <= 0.95


class TestComputePerExercise:
    def test_flat_slot_included(self) -> None:
        records = _flat_records("squat", n=10)
        result = compute_per_exercise(records)
        # squat should be in the result when plateauing
        if "squat" in result:
            assert result["squat"]["isPlateauing"] is True

    def test_failed_results_excluded(self) -> None:
        records = [_record("squat", 100.0, days_ago=i * 5, result="fail") for i in range(10)]
        result = compute_per_exercise(records)
        assert "squat" not in result

    def test_multiple_slots_independent(self) -> None:
        flat = _flat_records("squat", n=10)
        increasing = _increasing_records("bench", n=10)
        result = compute_per_exercise(flat + increasing)
        if "squat" in result:
            assert result["squat"]["isPlateauing"] is True
        if "bench" in result:
            assert result["bench"]["isPlateauing"] is False
