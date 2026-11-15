from urllib.parse import parse_qs, urlparse

import pytest

from app import spherex_archive
from app.errors import ArchiveError
from app.spherex_archive import Collection, ObservationImage


def make_image(modified_julian_date: float, detector_band: str) -> ObservationImage:
    return ObservationImage(
        observation_id="",
        observation_start_modified_julian_date=modified_julian_date,
        observation_date=str(modified_julian_date),
        detector_band=detector_band,
        wavelength_min_micrometers=0.0,
        wavelength_max_micrometers=0.0,
        download_url="",
        mirror_url="",
    )


def search_with_outcomes(monkeypatch, outcomes, search_response):
    def download(url, timeout_seconds):
        outcome = outcomes[Collection(parse_qs(urlparse(url).query)["COLLECTION"][0])]
        if outcome is None:
            return search_response
        raise outcome

    monkeypatch.setattr(spherex_archive, "download_search_response", download)
    return spherex_archive.search_releases(269.4, 4.7, 0.01, 30.0)


def test_epochs_contain_their_images_in_time_order():
    images = [make_image(100.0, "D1"), make_image(200.0, "D2"), make_image(100.5, "D2")]
    epochs = spherex_archive.split_into_epochs(images)
    dates = [[image.observation_start_modified_julian_date for image in epoch] for epoch in epochs]
    assert dates == [[100.0, 100.5], [200.0]]


def test_detector_number_is_read_from_the_band_name():
    assert spherex_archive.detector_number(make_image(1.0, "SPHEREx-D5")) == 5


def test_release_search_keeps_an_observation_once_from_the_first_release(
    monkeypatch, barnard_star_search_response
):
    search = search_with_outcomes(
        monkeypatch,
        {Collection.DATA_RELEASE_1: None, Collection.QUICK_RELEASE_3: None},
        barnard_star_search_response,
    )
    assert len(search.images) == 6
    assert set(search.release_by_mirror_url.values()) == {Collection.DATA_RELEASE_1}
    assert search.unavailable_releases == {}


def test_release_search_survives_one_unavailable_release(monkeypatch, barnard_star_search_response):
    search = search_with_outcomes(
        monkeypatch,
        {Collection.DATA_RELEASE_1: ArchiveError(502, "down"), Collection.QUICK_RELEASE_3: None},
        barnard_star_search_response,
    )
    assert len(search.images) == 6
    assert set(search.release_by_mirror_url.values()) == {Collection.QUICK_RELEASE_3}
    assert search.unavailable_releases == {Collection.DATA_RELEASE_1: "down"}


def test_release_search_fails_when_every_release_fails(monkeypatch, barnard_star_search_response):
    with pytest.raises(ArchiveError) as raised:
        search_with_outcomes(
            monkeypatch,
            {
                Collection.DATA_RELEASE_1: ArchiveError(504, "first"),
                Collection.QUICK_RELEASE_3: ArchiveError(502, "second"),
            },
            barnard_star_search_response,
        )
    assert raised.value.http_status == 504
