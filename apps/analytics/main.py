"""FastAPI analytics microservice entry point."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException

from compute import run_all
from db import close_pool, init_pool
from scheduler import get_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger(__name__)

_INTERNAL_SECRET = os.environ.get("INTERNAL_SECRET", "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    scheduler = get_scheduler()
    scheduler.start()
    log.info("Analytics service started")
    yield
    scheduler.shutdown(wait=False)
    await close_pool()
    log.info("Analytics service stopped")


app = FastAPI(title="Gravity Room Analytics", lifespan=lifespan)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/compute")
async def trigger_compute(
    x_internal_secret: str | None = Header(default=None),
) -> dict:
    """Manually trigger a full compute run. Requires X-Internal-Secret header."""
    if not _INTERNAL_SECRET or x_internal_secret != _INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    result = await run_all()
    return {"ok": True, **result}
