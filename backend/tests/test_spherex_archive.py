import httpx
import pytest

from app import spherex_archive
from app.spherex_archive import ArchiveError, Collection, ObservationImage


def make_image(
    observation_start_modified_julian_date: float, detector_band: str
) -> ObservationImage:
    return ObservationImage(
        observation_id="",
        observation_start_modified_julian_date=observation_start_modified_julian_date,
        observation_date=str(observation_start_modified_julian_date),
        detector_band=detector_band,
        wavelength_min_micrometers=0.0,
        wavelength_max_micrometers=0.0,
        download_url="",
    )


def test_search_response_is_parsed_into_images(barnard_star_search_response):
    images = spherex_archive.parse_images(barnard_star_search_response)
    assert len(images) == 6
    first_image = images[0]
    assert first_image.detector_band.startswith("SPHEREx-D")
    assert first_image.observation_date.startswith("2025-08")
    assert 0.7 < first_image.wavelength_min_micrometers < 5.5
    assert first_image.download_url.startswith("https://irsa.ipac.caltech.edu/")


def test_parsed_images_are_sorted_by_observation_time(barnard_star_search_response):
    images = spherex_archive.parse_images(barnard_star_search_response)
    start_dates = [image.observation_start_modified_julian_date for image in images]
    assert start_dates == sorted(start_dates)


def test_parsed_wavelength_ranges_are_ordered(barnard_star_search_response):
    for image in spherex_archive.parse_images(barnard_star_search_response):
        assert image.wavelength_min_micrometers < image.wavelength_max_micrometers


def test_unreadable_response_raises_archive_error():
    with pytest.raises(ArchiveError) as raised:
        spherex_archive.parse_images(b"<html>not a votable")
    assert raised.value.http_status == 502


def test_images_are_grouped_into_epochs_by_time_gap():
    epochs = spherex_archive.group_into_epochs(
        [make_image(100, "D1"), make_image(101, "D2"), make_image(200, "D1"), make_image(99, "D1")]
    )
    assert [epoch.number for epoch in epochs] == [1, 2]
    assert [epoch.image_count for epoch in epochs] == [3, 1]
    assert epochs[0].image_count_by_band == {"D1": 2, "D2": 1}


def test_gap_of_exactly_thirty_days_stays_in_the_same_epoch():
    epochs = spherex_archive.group_into_epochs([make_image(100, "D1"), make_image(130, "D1")])
    assert len(epochs) == 1


def test_gap_longer_than_thirty_days_starts_a_new_epoch():
    epochs = spherex_archive.group_into_epochs([make_image(100, "D1"), make_image(130.1, "D1")])
    assert len(epochs) == 2


def test_no_images_give_no_epochs():
    assert spherex_archive.group_into_epochs([]) == []


def test_search_url_contains_collection_and_position():
    url = spherex_archive.build_search_url(269.4465, 4.7668, 0.001, Collection.DATA_RELEASE_1)
    assert "COLLECTION=spherex_dr1" in url
    assert "POS=circle+269.4465+4.7668+0.001" in url


def test_citation_names_the_requested_release():
    assert "Data Release 1" in spherex_archive.citation_for(Collection.DATA_RELEASE_1)
    assert "Quick Release 3" in spherex_archive.citation_for(Collection.QUICK_RELEASE_3)


def test_http_error_status_becomes_archive_error(monkeypatch):
    class BadGatewayResponse:
        status_code = 502
        content = b""

    monkeypatch.setattr(httpx, "get", lambda *arguments, **keywords: BadGatewayResponse())
    with pytest.raises(ArchiveError) as raised:
        spherex_archive.download_search_response("https://example.org", timeout_seconds=1)
    assert raised.value.http_status == 502


def test_timeout_becomes_gateway_timeout(monkeypatch):
    def time_out(*arguments, **keywords):
        raise httpx.ReadTimeout("timed out")

    monkeypatch.setattr(httpx, "get", time_out)
    with pytest.raises(ArchiveError) as raised:
        spherex_archive.download_search_response("https://example.org", timeout_seconds=1)
    assert raised.value.http_status == 504


def test_unreachable_archive_becomes_bad_gateway(monkeypatch):
    def refuse_connection(*arguments, **keywords):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(httpx, "get", refuse_connection)
    with pytest.raises(ArchiveError) as raised:
        spherex_archive.download_search_response("https://example.org", timeout_seconds=1)
    assert raised.value.http_status == 502
