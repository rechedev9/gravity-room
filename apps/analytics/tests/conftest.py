"""Stub psycopg and psycopg_pool so analytics tests run without a real database install."""

from __future__ import annotations

import sys
from types import ModuleType
from unittest.mock import MagicMock

# Stub psycopg before any analytics module is imported
if "psycopg" not in sys.modules:
    psycopg_stub = ModuleType("psycopg")
    psycopg_stub.AsyncConnection = MagicMock()  # type: ignore[attr-defined]
    sys.modules["psycopg"] = psycopg_stub

# Stub psycopg_pool before any analytics module is imported
if "psycopg_pool" not in sys.modules:
    psycopg_pool_stub = ModuleType("psycopg_pool")
    psycopg_pool_stub.AsyncConnectionPool = MagicMock()  # type: ignore[attr-defined]
    sys.modules["psycopg_pool"] = psycopg_pool_stub
