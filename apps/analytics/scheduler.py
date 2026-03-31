"""APScheduler cron job: runs compute pipelines every N hours."""

from __future__ import annotations

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from compute import run_all
from config import settings

log = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
        _scheduler.add_job(
            _run_job,
            "interval",
            hours=settings.compute_interval_hours,
            id="compute_insights",
            replace_existing=True,
        )
    return _scheduler


async def _run_job() -> None:
    log.info("Scheduled compute starting")
    try:
        result = await run_all()
        log.info("Scheduled compute finished: %s", result)
    except Exception:
        log.exception("Scheduled compute failed")
