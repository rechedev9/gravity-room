"""Tests for the analytics service HTTP endpoints."""

from __future__ import annotations

import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tests.conftest import _stub_module


def _install_heavy_stubs() -> None:
    """Inject sys.modules stubs for packages not available in test env."""
    stubs: dict[str, ModuleType] = {}

    if "pydantic_settings" not in sys.modules:
        ps = _stub_module("pydantic_settings", BaseSettings=MagicMock)
        stubs["pydantic_settings"] = ps

    if "apscheduler" not in sys.modules:
        stubs["apscheduler"] = _stub_module("apscheduler")
        stubs["apscheduler.schedulers"] = _stub_module("apscheduler.schedulers")
        stubs["apscheduler.schedulers.asyncio"] = _stub_module(
            "apscheduler.schedulers.asyncio",
            AsyncIOScheduler=MagicMock,
        )

    for name, mod in stubs.items():
        sys.modules[name] = mod


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Test client with mocked lifespan and INTERNAL_SECRET set."""
    # Install stubs for packages not installed in the test environment.
    # conftest already stubs psycopg and psycopg_pool.
    _install_heavy_stubs()

    # config.Settings() runs at module level — stub it out before main is imported.
    config_stub = _stub_module(
        "config",
        settings=MagicMock(database_url="postgresql://x", internal_secret="test-secret-xyz"),
    )
    sys.modules["config"] = config_stub

    # Stub the heavy application modules that main.py imports at the top level.
    sys.modules.setdefault("compute", _stub_module("compute", run_all=AsyncMock()))
    sys.modules.setdefault("db", _stub_module("db", init_pool=AsyncMock(), close_pool=AsyncMock(), get_conn=MagicMock()))
    sys.modules.setdefault("scheduler", _stub_module("scheduler", get_scheduler=MagicMock()))

    with (
        patch("main.init_pool", new_callable=AsyncMock),
        patch("main.close_pool", new_callable=AsyncMock),
        patch("main.get_scheduler") as mock_scheduler,
    ):
        mock_scheduler.return_value.start = lambda: None
        mock_scheduler.return_value.shutdown = lambda wait: None

        import importlib
        import main as main_module
        importlib.reload(main_module)

        yield TestClient(main_module.app, raise_server_exceptions=False)


def test_compute_returns_403_without_secret(client: TestClient) -> None:
    res = client.post("/compute")
    assert res.status_code == 403


def test_compute_returns_403_with_wrong_secret(client: TestClient) -> None:
    res = client.post("/compute", headers={"X-Internal-Secret": "wrong"})
    assert res.status_code == 403


def test_compute_accepts_correct_secret(client: TestClient) -> None:
    with patch("main.run_all", new_callable=AsyncMock, return_value={"processed": 0, "errors": 0}):
        res = client.post("/compute", headers={"X-Internal-Secret": "test-secret-xyz"})
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_health_is_always_accessible(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
