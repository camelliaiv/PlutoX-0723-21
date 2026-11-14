import time

import pytest

from app import spherex_archive
from app.errors import ArchiveError
from app.spherex_archive import Collection
from tests.synthetic_cutouts import install_synthetic_cutouts, synthetic_image


@pytest.fixture
def synthetic_two_epoch_search(monkeypatch):
    images = [
        synthetic_image("epoch_one_a", 61000.0),
        synthetic_image("epoch_one_b", 61000.1),
        synthetic_image("epoch_two_a", 61100.0),
    ]
    search = spherex_archive.ReleaseSearch(
        images=images,
        release_by_mirror_url={image.mirror_url: Collection.DATA_RELEASE_1 for image in images},
        unavailable_releases={Collection.QUICK_RELEASE_3: "IRSA returned HTTP 502"},
    )
    monkeypatch.setattr(spherex_archive, "search_releases", lambda *arguments: search)
    install_synthetic_cutouts(
        monkeypatch, images, outside_observation_ids=frozenset({"epoch_one_b"})
    )


def test_frames_returns_one_frame_per_epoch(client, synthetic_two_epoch_search):
    response = client.get(
        "/api/frames", params={"detector": 5, "size": 9, "ra": "120", "dec": "30"}
    )
    assert response.status_code == 200
    body = response.json()
    assert [frame["epoch_number"] for frame in body["frames"]] == [1, 2]
    assert body["grid"]["size_pixels"] == 9
    assert body["grid"]["pixel_scale_arcseconds"] == 6.15
    assert "row 0" in body["grid"]["orientation"]
    assert body["reference_position"] == {"right_ascension": 120.0, "declination": 30.0}
    first = body["frames"][0]
    assert len(first["image"]) == 9
    assert len(first["image"][0]) == 9
    assert first["image"][4][4] == pytest.approx(100.0, rel=1e-3)
    assert first["exposure_count"] == 1
    assert first["skipped_exposure_count"] == 1
    assert first["data_releases"] == ["spherex_dr1"]
    assert body["display_range"]["minimum"] < body["display_range"]["maximum"]
    assert any("Quick Release 3 was unavailable" in note for note in body["notes"])
    assert any("1 exposures were skipped" in note for note in body["notes"])


def test_frames_accepts_a_challenge_target(client, synthetic_two_epoch_search):
    response = client.get(
        "/api/frames", params={"detector": 5, "size": 9, "target": "barnards_star"}
    )
    assert response.status_code == 200
    assert len(response.json()["frames"]) == 2


def test_detector_without_exposures_is_explained(client, synthetic_two_epoch_search):
    response = client.get("/api/frames", params={"detector": 2, "ra": "120", "dec": "30"})
    body = response.json()
    assert body["frames"] == []
    assert body["display_range"] is None
    assert any("detector 2" in note for note in body["notes"])


@pytest.mark.parametrize(
    "parameters",
    [
        {"ra": "1", "dec": "1"},
        {"detector": "5"},
        {"detector": "5", "target": "barnards_star", "ra": "1", "dec": "1"},
        {"detector": "5", "target": "barnards_star", "ra": "1"},
        {"detector": "5", "target": "unknown_object"},
        {"detector": "5", "ra": "1"},
        {"detector": "5", "ra": "400", "dec": "1"},
        {"detector": "0", "ra": "1", "dec": "1"},
        {"detector": "7", "ra": "1", "dec": "1"},
        {"detector": "5", "ra": "1", "dec": "1", "size": "7"},
        {"detector": "5", "ra": "1", "dec": "1", "size": "97"},
    ],
)
def test_invalid_input_is_rejected(client, parameters):
    assert client.get("/api/frames", params=parameters).status_code == 422


def test_archive_failure_is_reported(client, monkeypatch):
    def fail(url, timeout_seconds):
        raise ArchiveError(504, "archive unavailable")

    monkeypatch.setattr(spherex_archive, "download_search_response", fail)
    response = client.get("/api/frames", params={"detector": 5, "ra": "1", "dec": "1"})
    assert response.status_code == 504


@pytest.mark.network
def test_live_frames_for_barnards_star(client):
    started = time.perf_counter()
    response = client.get(
        "/api/frames", params={"detector": 5, "size": 16, "target": "barnards_star"}
    )
    seconds = time.perf_counter() - started
    assert response.status_code == 200
    body = response.json()
    exposure_total = sum(frame["exposure_count"] for frame in body["frames"])
    print(f"\nlive frames request: {seconds:.1f} s, {exposure_total} exposures, {body['notes']}")
    assert len(body["frames"]) >= 3
    for frame in body["frames"]:
        center_pixels = [frame["image"][row][column] for row in (7, 8) for column in (7, 8)]
        assert all(value is not None for value in center_pixels)
        _, brightest_row, brightest_column = max(
            (value, row, column)
            for row, values in enumerate(frame["image"])
            for column, value in enumerate(values)
            if value is not None
        )
        assert abs(brightest_row - 7.5) <= 2
        assert abs(brightest_column - 7.5) <= 2
