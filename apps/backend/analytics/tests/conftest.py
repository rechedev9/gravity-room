"""Stub psycopg and psycopg_pool so analytics tests run without a real database install."""

from __future__ import annotations

import sys
from types import ModuleType
from unittest.mock import MagicMock


def _stub_module(name: str, **attrs: object) -> ModuleType:
    mod = ModuleType(name)
    for k, v in attrs.items():
        setattr(mod, k, v)
    return mod


# Stub psycopg before any analytics module is imported
if "psycopg" not in sys.modules:
    sys.modules["psycopg"] = _stub_module("psycopg", AsyncConnection=MagicMock())

# Stub psycopg_pool before any analytics module is imported
if "psycopg_pool" not in sys.modules:
    sys.modules["psycopg_pool"] = _stub_module("psycopg_pool", AsyncConnectionPool=MagicMock())
