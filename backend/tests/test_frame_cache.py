import json

import pytest

from app import frame_cache, frame_computation, mirror_cutout, spherex_archive
from app.frame_cache import FrameCacheKey
from app.frames_models import (
    DisplayRange,
    FrameResponse,
    FramesResponse,
    GridDescription,
    SkyPosition,
)
from app.spherex_archive import Collection
from tests.synthetic_cutouts import install_synthetic_cutouts, synthetic_image

SYNTHETIC_COMPUTED_AT = "2026-01-02T03:04:05+00:00"


def synthetic_frames_response() -> FramesResponse:
    position = SkyPosition(right_ascension=120.0, declination=30.0)
    frame = FrameResponse(
        epoch_number=1,
        start_date="2025-08-15",
        end_date="2025-10-01",
        detector=5,
        exposure_count=2,
        skipped_exposure_count=0,
        wavelength_min_micrometers=1.0,
        wavelength_max_micrometers=1.1,
        observation_ids=["synthetic_observation"],
        data_releases=[Collection.DATA_RELEASE_1],
        image=[[1.5, None], [2.5, 3.5]],
        variance=[[0.1, None], [0.2, 0.3]],
        coverage=[[2, 0], [2, 2]],
        saturated_fraction=[[0.0, None], [0.0, 0.5]],
    )
    return FramesResponse(
        reference_position=position,
        reference_date="2026-01-01",
        grid=GridDescription(
            size_pixels=2, pixel_scale_arcseconds=6.15, center=position, orientation="synthetic"
        ),
        unit="synthetic unit",
        display_range=DisplayRange(minimum=1.0, maximum=3.0),
        citations=["synthetic citation"],
        frames=[frame],
        notes=[],
        served_from_cache=False,
        computed_at=SYNTHETIC_COMPUTED_AT,
    )


def test_target_key_file_name():
    key = frame_cache.key_for_target("barnards_star", 5, 32)
    assert key.file_name == "barnards_star_detector5_size32.json"


def test_coordinate_key_file_name_rounds_to_six_decimals():
    key = frame_cache.key_for_coordinates(269.44650012345, -4.7668, 5, 32)
    assert key.file_name == "ra269.446500_dec-4.766800_detector5_size32.json"
    positive_key = frame_cache.key_for_coordinates(269.4465, 4.7668, 2, 16)
    assert positive_key.file_name == "ra269.446500_dec+4.766800_detector2_size16.json"


def test_default_directory_is_inside_the_backend_package(monkeypatch):
    monkeypatch.delenv("FRAME_CACHE_DIRECTORY")
    assert frame_cache.cache_directory() == frame_cache.BACKEND_DIRECTORY / "frame_cache"
    assert frame_cache.BACKEND_DIRECTORY.name == "backend"


def test_round_trip_returns_an_equal_response_served_from_cache():
    key = frame_cache.key_for_target("barnards_star", 5, 2)
    response = synthetic_frames_response()
    frame_cache.write_cached_frames(key, response)
    cached = frame_cache.read_cached_frames(key)
    assert cached is not None
    assert cached.served_from_cache is True
    assert cached.computed_at == SYNTHETIC_COMPUTED_AT
    assert cached.frames == response.frames
    assert cached.display_range == response.display_range


def test_missing_file_is_a_miss():
    assert frame_cache.read_cached_frames(FrameCacheKey("absent", 1, 8)) is None


def test_corrupt_file_is_a_miss(isolated_frame_cache):
    key = FrameCacheKey("corrupt", 1, 8)
    isolated_frame_cache.mkdir(parents=True)
    (isolated_frame_cache / key.file_name).write_text("{not json", encoding="utf-8")
    assert frame_cache.read_cached_frames(key) is None


def test_incomplete_envelope_is_a_miss(isolated_frame_cache):
    key = FrameCacheKey("partial", 1, 8)
    isolated_frame_cache.mkdir(parents=True)
    envelope = {"format_version": frame_cache.CACHE_FORMAT_VERSION, "response": {}}
    (isolated_frame_cache / key.file_name).write_text(json.dumps(envelope), encoding="utf-8")
    assert frame_cache.read_cached_frames(key) is None


def test_wrong_format_version_is_a_miss(isolated_frame_cache):
    key = frame_cache.key_for_target("barnards_star", 5, 2)
    frame_cache.write_cached_frames(key, synthetic_frames_response())
    path = isolated_frame_cache / key.file_name
    envelope = json.loads(path.read_text(encoding="utf-8"))
    envelope["format_version"] = frame_cache.CACHE_FORMAT_VERSION + 1
    path.write_text(json.dumps(envelope), encoding="utf-8")
    assert frame_cache.read_cached_frames(key) is None


def test_frames_from_an_older_frame_recipe_are_a_miss(isolated_frame_cache):
    key = frame_cache.key_for_target("barnards_star", 5, 2)
    frame_cache.write_cached_frames(key, synthetic_frames_response())
    path = isolated_frame_cache / key.file_name
    envelope = json.loads(path.read_text(encoding="utf-8"))
    envelope["frame_recipe_version"] = frame_cache.FRAME_RECIPE_VERSION - 1
    path.write_text(json.dumps(envelope), encoding="utf-8")
    assert frame_cache.read_cached_frames(key) is None


def test_write_leaves_no_temporary_files(isolated_frame_cache):
    key = frame_cache.key_for_target("barnards_star", 5, 2)
    frame_cache.write_cached_frames(key, synthetic_frames_response())
    frame_cache.write_cached_frames(key, synthetic_frames_response())
    assert [path.name for path in isolated_frame_cache.iterdir()] == [key.file_name]


def test_failed_write_leaves_no_temporary_files(isolated_frame_cache, monkeypatch):
    def fail(source, destination):
        raise OSError("synthetic replace failure")

    monkeypatch.setattr(frame_cache.os, "replace", fail)
    key = frame_cache.key_for_target("barnards_star", 5, 2)
    with pytest.raises(OSError):
        frame_cache.write_cached_frames(key, synthetic_frames_response())
    assert list(isolated_frame_cache.iterdir()) == []


def test_api_serves_cached_frames_without_reading_the_archive(client, monkeypatch):
    key = frame_cache.key_for_target("barnards_star", 5, 8)
    frame_cache.write_cached_frames(key, synthetic_frames_response())

    def fail(*arguments, **keyword_arguments):
        raise AssertionError("the archive must not be used on a cache hit")

    monkeypatch.setattr(spherex_archive, "search_releases", fail)
    monkeypatch.setattr(mirror_cutout, "http_range_reader", fail)
    monkeypatch.setattr(frame_computation, "build_epoch_frames", fail)
    response = client.get(
        "/api/frames", params={"detector": 5, "size": 8, "target": "barnards_star"}
    )
    body = response.json()
    assert response.status_code == 200
    assert body["served_from_cache"] is True
    assert body["computed_at"] == SYNTHETIC_COMPUTED_AT
    assert body["frames"][0]["observation_ids"] == ["synthetic_observation"]


def install_synthetic_search(monkeypatch, unavailable_releases):
    images = [synthetic_image("epoch_one", 61000.0), synthetic_image("epoch_two", 61100.0)]
    search = spherex_archive.ReleaseSearch(
        images=images,
        release_by_mirror_url={image.mirror_url: Collection.DATA_RELEASE_1 for image in images},
        unavailable_releases=unavailable_releases,
    )
    monkeypatch.setattr(spherex_archive, "search_releases", lambda *arguments: search)
    install_synthetic_cutouts(monkeypatch, images)


def cached_file_names(cache_directory):
    return sorted(path.name for path in cache_directory.glob("*.json"))


def test_api_caches_a_complete_live_result(client, monkeypatch, isolated_frame_cache):
    install_synthetic_search(monkeypatch, unavailable_releases={})
    parameters = {"detector": 5, "size": 9, "ra": "120", "dec": "30"}
    live = client.get("/api/frames", params=parameters).json()
    assert live["served_from_cache"] is False
    assert live["computed_at"]
    assert cached_file_names(isolated_frame_cache) == [
        "ra120.000000_dec+30.000000_detector5_size9.json"
    ]
    cached = client.get("/api/frames", params=parameters).json()
    assert cached["served_from_cache"] is True
    assert {**cached, "served_from_cache": False} == live


def test_api_does_not_cache_when_a_release_was_unavailable(
    client, monkeypatch, isolated_frame_cache
):
    install_synthetic_search(
        monkeypatch, unavailable_releases={Collection.QUICK_RELEASE_3: "IRSA returned HTTP 502"}
    )
    response = client.get(
        "/api/frames", params={"detector": 5, "size": 9, "target": "barnards_star"}
    )
    assert len(response.json()["frames"]) == 2
    assert cached_file_names(isolated_frame_cache) == []


def test_api_does_not_cache_when_there_are_no_frames(client, monkeypatch, isolated_frame_cache):
    install_synthetic_search(monkeypatch, unavailable_releases={})
    response = client.get(
        "/api/frames", params={"detector": 2, "size": 9, "target": "barnards_star"}
    )
    assert response.json()["frames"] == []
    assert cached_file_names(isolated_frame_cache) == []
