import math

from app.target_astrometry import CHALLENGE_TARGETS


def test_targets_endpoint_lists_the_five_challenge_targets(client):
    response = client.get("/api/targets")
    assert response.status_code == 200
    slugs = [target["slug"] for target in response.json()["targets"]]
    assert sorted(slugs) == sorted(CHALLENGE_TARGETS)
    assert len(slugs) == 5


def test_barnards_star_facts(client):
    targets = {target["slug"]: target for target in client.get("/api/targets").json()["targets"]}
    barnards_star = targets["barnards_star"]
    assert barnards_star["name"] == "Barnard's Star"
    assert barnards_star["catalogue_source_id"] == "Gaia DR3 4472832130942575872"
    assert barnards_star["reference_epoch"] == "2016-01-01"
    assert math.isclose(barnards_star["distance_parsecs"], 1000 / 546.975939730948)
    assert barnards_star["distance_source"] == "Gaia DR3 4472832130942575872"
    assert math.isclose(
        barnards_star["total_proper_motion_arcseconds_per_year"], 10.393, abs_tol=0.01
    )


def test_wise_0855_has_no_distance(client):
    targets = {target["slug"]: target for target in client.get("/api/targets").json()["targets"]}
    wise = targets["wise_0855_0714"]
    assert wise["distance_parsecs"] is None
    assert wise["distance_source"] == "not in Gaia DR3"
    assert wise["reference_epoch"] == "2015-11-12"


def test_epsilon_indi_b_uses_the_distance_of_its_host_star(client):
    targets = {target["slug"]: target for target in client.get("/api/targets").json()["targets"]}
    epsilon_indi_b = targets["epsilon_indi_b"]
    assert math.isclose(epsilon_indi_b["distance_parsecs"], 1000 / 274.8431)
    assert "Epsilon Indi A" in epsilon_indi_b["distance_source"]


def test_every_target_with_a_distance_names_a_gaia_source(client):
    for target in client.get("/api/targets").json()["targets"]:
        if target["distance_parsecs"] is not None:
            assert target["distance_source"].startswith("Gaia DR3 ")
