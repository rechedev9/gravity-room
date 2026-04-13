"""Load recommendation via logistic regression on success probability.

Features: weight, success_rate_at_weight, avg_rpe, volume_last_week,
days_since_last_session.

Requires min 10 sessions with RPE data for ML path.
Fallback (insufficient RPE data): 3 consecutive successes → increment.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

import numpy as np
from sklearn.linear_model import LogisticRegression

from queries import WorkoutRecord

_MIN_RPE_SESSIONS = 10
_SUCCESS_PROB_THRESHOLD = 0.70
_INCREMENT_KG = 2.5


def compute_per_exercise(records: list[WorkoutRecord]) -> dict[str, dict]:
    """Return slot_id -> load_recommendation payload."""
    by_slot: dict[str, list[WorkoutRecord]] = defaultdict(list)
    for r in records:
        by_slot[r.slot_id].append(r)

    result: dict[str, dict] = {}
    for slot_id, slot_records in by_slot.items():
        payload = _recommend_slot(slot_records)
        if payload is not None:
            result[slot_id] = payload
    return result


def _recommend_slot(records: list[WorkoutRecord]) -> dict | None:
    if not records:
        return None

    records = sorted(records, key=lambda r: (r.recorded_at or "", r.workout_index))
    current_weight = records[-1].weight
    current_date = records[-1].recorded_at

    rpe_records = [r for r in records if r.rpe is not None]
    if len(rpe_records) >= _MIN_RPE_SESSIONS:
        return _ml_recommendation(records, rpe_records, current_weight, current_date)
    return _fallback_recommendation(records, current_weight)


def _ml_recommendation(
    all_records: list[WorkoutRecord],
    rpe_records: list[WorkoutRecord],
    current_weight: float,
    current_date: str | None,
) -> dict | None:
    weight_outcomes: dict[float, list[int]] = defaultdict(list)
    for r in all_records:
        weight_outcomes[r.weight].append(1 if r.result == "success" else 0)

    def success_rate(w: float) -> float:
        outcomes = weight_outcomes.get(w, [])
        return sum(outcomes) / len(outcomes) if outcomes else 0.5

    volume_last_week = _volume_for_date(all_records, current_date)
    days_since = _days_since_last(all_records, current_date)

    features: list[list[float]] = []
    labels: list[int] = []
    for r in rpe_records:
        sr = success_rate(r.weight)
        vlw = _volume_for_date(all_records, r.recorded_at)
        dsl = _days_since_for(all_records, r.recorded_at)
        features.append([r.weight, sr, r.rpe or 0.0, vlw, dsl])
        labels.append(1 if r.result == "success" else 0)

    if len(set(labels)) < 2:
        return _fallback_recommendation(all_records, current_weight)

    X = np.array(features)
    y = np.array(labels)

    col_mean = X.mean(axis=0)
    col_std = X.std(axis=0)
    col_std[col_std == 0] = 1.0
    X_scaled = (X - col_mean) / col_std

    clf = LogisticRegression(max_iter=200, random_state=42)
    clf.fit(X_scaled, y)

    sr_current = success_rate(current_weight)
    sr_next = success_rate(current_weight + _INCREMENT_KG)

    x_current = np.array([[current_weight, sr_current, 5.0, volume_last_week, days_since]])
    x_next = np.array(
        [[current_weight + _INCREMENT_KG, sr_next, 5.0, volume_last_week, days_since]]
    )

    x_current_s = (x_current - col_mean) / col_std
    x_next_s = (x_next - col_mean) / col_std

    prob_current = float(clf.predict_proba(x_current_s)[0][1])
    prob_next = float(clf.predict_proba(x_next_s)[0][1])

    recommend_increment = prob_next >= _SUCCESS_PROB_THRESHOLD
    recommended_weight = current_weight + _INCREMENT_KG if recommend_increment else current_weight
    confidence = prob_next if recommend_increment else prob_current

    return {
        "currentWeight": current_weight,
        "recommendedWeight": recommended_weight,
        "shouldIncrement": recommend_increment,
        "confidence": round(min(confidence, 0.99), 3),
        "method": "logistic_regression",
    }


def _fallback_recommendation(
    records: list[WorkoutRecord],
    current_weight: float,
) -> dict:
    last_three = records[-3:]
    all_success = len(last_three) >= 3 and all(r.result == "success" for r in last_three)
    recommended_weight = current_weight + _INCREMENT_KG if all_success else current_weight
    return {
        "currentWeight": current_weight,
        "recommendedWeight": recommended_weight,
        "shouldIncrement": all_success,
        "confidence": 0.7 if all_success else 0.5,
        "method": "consecutive_success",
    }


def _volume_for_date(records: list[WorkoutRecord], ref_date: str | None) -> float:
    if not ref_date:
        return 0.0
    try:
        ref = datetime.fromisoformat(ref_date.replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    return _volume_in_window(records, ref - timedelta(weeks=1), ref)


def _volume_in_window(records: list[WorkoutRecord], start: datetime, end: datetime) -> float:
    total = 0.0
    for r in records:
        if not r.recorded_at:
            continue
        try:
            dt = datetime.fromisoformat(r.recorded_at.replace("Z", "+00:00"))
        except ValueError:
            continue
        if start <= dt < end and r.result == "success":
            total += r.weight * (r.amrap_reps or 5)
    return total


def _days_since_last(records: list[WorkoutRecord], current_date: str | None) -> float:
    if not current_date:
        return 7.0
    try:
        now = datetime.fromisoformat(current_date.replace("Z", "+00:00"))
    except ValueError:
        return 7.0
    for r in reversed(records[:-1]):
        if not r.recorded_at:
            continue
        try:
            dt = datetime.fromisoformat(r.recorded_at.replace("Z", "+00:00"))
            return max(0.0, float((now - dt).days))
        except ValueError:
            continue
    return 7.0


def _days_since_for(records: list[WorkoutRecord], ref_date: str | None) -> float:
    if not ref_date:
        return 7.0
    try:
        ref = datetime.fromisoformat(ref_date.replace("Z", "+00:00"))
    except ValueError:
        return 7.0
    for r in reversed(records):
        if not r.recorded_at or r.recorded_at >= ref_date:
            continue
        try:
            dt = datetime.fromisoformat(r.recorded_at.replace("Z", "+00:00"))
            return max(0.0, float((ref - dt).days))
        except ValueError:
            continue
    return 7.0
