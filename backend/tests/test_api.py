import pytest

from app import spherex_archive


@pytest.fixture
def archive_returns_barnard_star(monkeypatch, barnard_star_search_response):
    monkeypatch.setattr(
        spherex_archive,
        "download_search_response",
        lambda url, timeout_seconds: barnard_star_search_response,
    )


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_observations_returns_images_grouped_into_epochs(client, archive_returns_barnard_star):
    response = client.get("/api/observations", params={"ra": "269.4465", "dec": "4.7668"})
    assert response.status_code == 200
    body = response.json()
    assert body["image_count"] == 6
    assert len(body["epochs"]) == 2
    assert body["collection"] == "spherex_dr1"
    assert "Data Release 1" in body["citation"]
    assert body["search_url"].startswith("https://irsa.ipac.caltech.edu/SIA?")


def test_observations_lists_every_image_with_its_details(client, archive_returns_barnard_star):
    response = client.get("/api/observations", params={"ra": "269.4465", "dec": "4.7668"})
    images = response.json()["images"]
    assert len(images) == 6
    assert set(images[0]) == {
        "observation_id",
        "observation_start_modified_julian_date",
        "observation_date",
        "detector_band",
        "wavelength_min_micrometers",
        "wavelength_max_micrometers",
        "download_url",
    }


def test_quick_release_collection_is_accepted(client, archive_returns_barnard_star):
    response = client.get(
        "/api/observations", params={"ra": "269.4465", "dec": "4.7668", "collection": "spherex_qr3"}
    )
    assert response.status_code == 200
    assert response.json()["collection"] == "spherex_qr3"
    assert "Quick Release 3" in response.json()["citation"]


def test_observations_accepts_sexagesimal_coordinates(client, archive_returns_barnard_star):
    response = client.get(
        "/api/observations", params={"ra": "08h55m10.831s", "dec": "-07d14m42.53s"}
    )
    assert response.status_code == 200
    assert response.json()["target"]["right_ascension"] == pytest.approx(133.795, abs=1e-3)


@pytest.mark.parametrize(
    "parameters",
    [
        {"ra": "400", "dec": "0"},
        {"ra": "1", "dec": "-95"},
        {"ra": "not-a-number", "dec": "0"},
        {"ra": "1", "dec": "0", "collection": "unknown"},
        {"dec": "0"},
        {"ra": "1"},
        {"ra": "1", "dec": "0", "radius": "0"},
        {"ra": "1", "dec": "0", "radius": "-0.1"},
        {"ra": "1", "dec": "0", "radius": "1.5"},
    ],
)
def test_invalid_input_is_rejected(client, parameters):
    assert client.get("/api/observations", params=parameters).status_code == 422


@pytest.mark.parametrize("http_status", [502, 504])
def test_archive_failure_is_reported(client, monkeypatch, http_status):
    def fail(url, timeout_seconds):
        raise spherex_archive.ArchiveError(http_status, "archive unavailable")

    monkeypatch.setattr(spherex_archive, "download_search_response", fail)
    response = client.get("/api/observations", params={"ra": "1", "dec": "1"})
    assert response.status_code == http_status
    assert response.json() == {"error": "archive unavailable"}


@pytest.mark.network
def test_live_search_for_barnard_star(client):
    response = client.get("/api/observations", params={"ra": "269.4465", "dec": "4.7668"})
    assert response.status_code == 200
    body = response.json()
    assert body["image_count"] > 0
    assert len(body["epochs"]) >= 2
