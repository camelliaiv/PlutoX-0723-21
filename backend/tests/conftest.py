from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main

BARNARD_STAR_SEARCH_RESPONSE = Path(__file__).parent / "fixtures" / "barnard_star_dr1_search.xml"


@pytest.fixture
def barnard_star_search_response() -> bytes:
    return BARNARD_STAR_SEARCH_RESPONSE.read_bytes()


@pytest.fixture
def client() -> TestClient:
    return TestClient(main.app)


@pytest.fixture(autouse=True)
def isolated_frame_cache(tmp_path, monkeypatch) -> Path:
    cache_directory = tmp_path / "frame_cache"
    monkeypatch.setenv("FRAME_CACHE_DIRECTORY", str(cache_directory))
    return cache_directory
