"""Session frequency insight.

Computes sessions/week, current streak, and consistency percentage.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from queries import WorkoutRecord


def compute(records: list[WorkoutRecord]) -> dict | None:
    """Return a frequency payload or None if insufficient data."""
    # Collect unique workout dates (one session per calendar date max)
    dates: set[str] = set()
    for r in records:
        if r.recorded_at:
            try:
                dt = datetime.fromisoformat(r.recorded_at.replace("Z", "+00:00"))
                dates.add(dt.date().isoformat())
            except ValueError:
                pass

    if len(dates) < 3:
        return None

    sorted_dates = sorted(dates)
    first = datetime.fromisoformat(sorted_dates[0]).date()
    last = datetime.fromisoformat(sorted_dates[-1]).date()
    total_weeks = max(1, (last - first).days / 7)

    sessions_per_week = round(len(sorted_dates) / total_weeks, 2)

    streak = _current_streak(sorted_dates)
    consistency_pct = _consistency_pct(sorted_dates, first, last)

    return {
        "sessionsPerWeek": sessions_per_week,
        "currentStreak": streak,
        "consistencyPct": consistency_pct,
        "totalSessions": len(sorted_dates),
    }


def _current_streak(sorted_date_strs: list[str]) -> int:
    """Count consecutive days from the most recent session backwards."""
    if not sorted_date_strs:
        return 0
    dates = [datetime.fromisoformat(d).date() for d in sorted_date_strs]
    dates_set = set(dates)
    streak = 0
    cursor = dates[-1]
    while cursor in dates_set:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _consistency_pct(sorted_date_strs: list[str], first, last) -> float:
    total_weeks = max(1, ((last - first).days + 1) // 7)
    if total_weeks < 1:
        return 100.0

    weeks_with_session: set[str] = set()
    for d in sorted_date_strs:
        dt = datetime.fromisoformat(d).date()
        iso = dt.isocalendar()
        weeks_with_session.add(f"{iso.year}-W{iso.week:02d}")

    return round(min(100.0, len(weeks_with_session) / total_weeks * 100), 1)
