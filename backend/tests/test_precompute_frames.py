import pytest

from app import frame_cache, precompute_frames
from app.errors import ArchiveError
from app.precompute_frames import CombinationStatus
from app.spherex_archive import Collection
from tests.test_frame_cache import synthetic_frames_response

SINGLE_COMBINATION = ["--targets", "barnards_star", "--detectors", "5"]


@pytest.fixture
def waits(monkeypatch) -> list[float]:
    recorded: list[float] = []
    monkeypatch.setattr(precompute_frames, "sleep", recorded.append)
    return recorded


@pytest.fixture
def mirror_client(monkeypatch):
    class UnusedClient:
        def __enter__(self):
            return self

        def __exit__(self, *exception_details):
            return False

    monkeypatch.setattr(precompute_frames, "open_mirror_client", UnusedClient)


def install_computation(monkeypatch, outcomes: list) -> list[tuple]:
    """Make the computation return or raise each outcome in turn; returns the recorded calls."""
    calls: list[tuple] = []
    remaining = list(outcomes)

    def compute(description, detector, size, client, read_search_response=None):
        calls.append((description.entry.name, detector, size))
        outcome = remaining.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(precompute_frames, "compute_live_frames", compute)
    return calls


def test_defaults_cover_every_target_and_detector_at_the_api_size():
    options = precompute_frames.parse_arguments([])
    assert options.targets == list(precompute_frames.CHALLENGE_TARGETS)
    assert options.detectors == [1, 2, 3, 4, 5, 6]
    assert options.size == 32
    assert options.force is False


def test_arguments_are_parsed():
    options = precompute_frames.parse_arguments(
        ["--targets", "barnards_star", "--detectors", "2", "5", "--size", "16", "--force"]
    )
    assert options.targets == ["barnards_star"]
    assert options.detectors == [2, 5]
    assert options.size == 16
    assert options.force is True


@pytest.mark.parametrize(
    "arguments", [["--targets", "pluto"], ["--detectors", "7"], ["--size", "4"]]
)
def test_invalid_arguments_are_rejected(arguments):
    with pytest.raises(SystemExit):
        precompute_frames.parse_arguments(arguments)


def test_a_complete_result_is_written_to_the_cache(monkeypatch, waits, mirror_client, capsys):
    calls = install_computation(monkeypatch, [(synthetic_frames_response(), True)])
    assert precompute_frames.main(SINGLE_COMBINATION) == 0
    assert calls == [("Barnard's Star", 5, 32)]
    assert waits == []
    assert frame_cache.read_cached_frames(frame_cache.key_for_target("barnards_star", 5, 32))
    output = capsys.readouterr().out
    assert "barnards_star D5: 1 epochs, 2 exposures used, 0 skipped" in output
    assert "1 of 1 combinations succeeded" in output


def test_an_incomplete_result_is_retried_and_never_written(
    monkeypatch, waits, mirror_client, capsys
):
    incomplete = (synthetic_frames_response(), False)
    calls = install_computation(monkeypatch, [incomplete] * 5)
    assert precompute_frames.main(SINGLE_COMBINATION) == 1
    assert len(calls) == 5
    assert waits == [30, 60, 90, 120]
    assert (
        frame_cache.read_cached_frames(frame_cache.key_for_target("barnards_star", 5, 32)) is None
    )
    output = capsys.readouterr().out
    assert "barnards_star D5: failed (the result was incomplete)" in output
    assert "0 of 1 combinations succeeded" in output
    assert "failed: --targets barnards_star --detectors 5" in output


def test_archive_errors_are_retried_until_one_attempt_succeeds(monkeypatch, waits, mirror_client):
    install_computation(
        monkeypatch,
        [ArchiveError(502, "IRSA returned HTTP 502"), (synthetic_frames_response(), True)],
    )
    assert precompute_frames.main(SINGLE_COMBINATION) == 0
    assert waits == [30]
    assert frame_cache.read_cached_frames(frame_cache.key_for_target("barnards_star", 5, 32))


def test_a_failure_does_not_stop_the_other_combinations(monkeypatch, waits, mirror_client):
    failure = ArchiveError(503, "IRSA returned HTTP 503")
    calls = install_computation(monkeypatch, [failure] * 5 + [(synthetic_frames_response(), True)])
    exit_code = precompute_frames.main(["--targets", "barnards_star", "--detectors", "1", "2"])
    assert exit_code == 1
    assert [detector for _, detector, _ in calls] == [1] * 5 + [2]
    assert frame_cache.read_cached_frames(frame_cache.key_for_target("barnards_star", 2, 32))
    assert (
        frame_cache.read_cached_frames(frame_cache.key_for_target("barnards_star", 1, 32)) is None
    )


def test_a_valid_cache_file_is_kept_without_computing(monkeypatch, waits, mirror_client, capsys):
    key = frame_cache.key_for_target("barnards_star", 5, 32)
    frame_cache.write_cached_frames(key, synthetic_frames_response())
    calls = install_computation(monkeypatch, [])
    assert precompute_frames.main(SINGLE_COMBINATION) == 0
    assert calls == []
    assert CombinationStatus.ALREADY_CACHED.value in capsys.readouterr().out


def test_force_recomputes_even_when_a_valid_cache_file_exists(monkeypatch, waits, mirror_client):
    key = frame_cache.key_for_target("barnards_star", 5, 32)
    frame_cache.write_cached_frames(key, synthetic_frames_response())
    calls = install_computation(monkeypatch, [(synthetic_frames_response(), True)])
    assert precompute_frames.main([*SINGLE_COMBINATION, "--force"]) == 0
    assert len(calls) == 1


def test_saved_search_responses_are_read_per_release(tmp_path):
    (tmp_path / "barnards_star_spherex_dr1.xml").write_bytes(b"synthetic data release 1 response")
    read_search_response = precompute_frames.stored_search_response_reader(
        tmp_path, "barnards_star"
    )
    assert (
        read_search_response(Collection.DATA_RELEASE_1, "unused")
        == b"synthetic data release 1 response"
    )


def test_a_missing_saved_search_response_makes_that_release_unavailable(tmp_path):
    read_search_response = precompute_frames.stored_search_response_reader(
        tmp_path, "barnards_star"
    )
    with pytest.raises(ArchiveError, match="No saved search response"):
        read_search_response(Collection.QUICK_RELEASE_3, "unused")


def test_search_responses_directory_is_parsed(tmp_path):
    options = precompute_frames.parse_arguments(["--search-responses", str(tmp_path)])
    assert options.search_responses == tmp_path
