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
