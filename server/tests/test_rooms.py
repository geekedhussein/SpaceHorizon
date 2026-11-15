import pytest

from app.config import Settings
from app.models import PATH_ROLES, ROLES, Design
from app.rooms import CODE_ALPHABET, CODE_LENGTH, RoomError, RoomManager


async def nowhere(message: dict) -> None:
    pass


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def manager(clock, tmp_path):
    return RoomManager(Settings(max_rooms=3, db_path=tmp_path / "x.sqlite3"), clock)


def roles_of(room):
    return {player.name: player.roles for player in room.players.values()}


def test_room_codes_are_short_and_unambiguous(manager):
    room = manager.create()
    assert len(room.code) == CODE_LENGTH
    assert set(room.code) <= set(CODE_ALPHABET)
    assert manager.get(room.code.lower()) is room


def test_every_design_field_has_exactly_one_owner():
    design_paths = {f"design.{name}" for name in Design.model_fields}
    assert design_paths <= set(PATH_ROLES)
    assert set(PATH_ROLES.values()) == set(ROLES)


def test_a_solo_player_holds_all_four_roles(manager):
    room = manager.create()
    room.join("p1", "Ada", None, nowhere)
    assert roles_of(room) == {"Ada": list(ROLES)}


def test_roles_are_shared_evenly_and_every_role_is_held(manager):
    room = manager.create()
    for index, name in enumerate(["Ada", "Ben", "Chen", "Dee"], start=1):
        room.join(f"p{index}", name, None, nowhere)
        held = [role for roles in roles_of(room).values() for role in roles]
        assert sorted(held) == sorted(ROLES)
        sizes = [len(roles) for roles in roles_of(room).values()]
        assert max(sizes) - min(sizes) <= 1
    assert all(len(roles) == 1 for roles in roles_of(room).values())


def test_a_player_gets_the_role_they_ask_for_if_it_is_free(manager):
    room = manager.create()
    room.join("p1", "Ada", "science", nowhere)
    room.join("p2", "Ben", "science", nowhere)
    assert "science" in roles_of(room)["Ada"]
    assert "science" not in roles_of(room)["Ben"]


def test_roles_pass_on_when_a_player_leaves(manager):
    room = manager.create()
    room.join("p1", "Ada", None, nowhere)
    room.join("p2", "Ben", None, nowhere)
    room.leave("p1")
    assert roles_of(room) == {"Ben": list(ROLES)}


def test_a_fifth_player_is_refused(manager):
    room = manager.create()
    for index in range(4):
        room.join(f"p{index}", f"P{index}", None, nowhere)
    with pytest.raises(RoomError) as refused:
        room.join("p4", "Late", None, nowhere)
    assert refused.value.code == "room_full"


def test_a_patch_changes_the_design_and_counts_as_a_contribution(manager):
    room = manager.create()
    ada = room.join("p1", "Ada", None, nowhere)
    patch, cleared = room.apply_patch(ada, "design.orbitId", "sso-500", 0)
    assert patch == {"type": "patch", "path": "design.orbitId", "value": "sso-500", "rev": 1, "by": "p1"}
    assert cleared is False
    assert room.design["orbitId"] == "sso-500"
    assert room.changes["p1"] == 1


def test_a_patch_outside_the_senders_role_is_refused(manager):
    room = manager.create()
    ada = room.join("p1", "Ada", "planner", nowhere)
    ben = room.join("p2", "Ben", "engineer", nowhere)
    assert "engineer" not in ada.roles
    with pytest.raises(RoomError) as refused:
        room.apply_patch(ada, "design.structureId", "structure-3u-isispace", 0)
    assert refused.value.code == "forbidden"
    assert refused.value.extra == {"path": "design.structureId", "value": None}
    assert room.rev == 0
    room.apply_patch(ben, "design.structureId", "structure-3u-isispace", 0)
    assert room.design["structureId"] == "structure-3u-isispace"


@pytest.mark.parametrize(
    ("path", "value"),
    [
        ("design.orbitId", "Not An Id!"),
        ("design.orbitId", 7),
        ("design.radioIds", ["a"] * 9),
        ("design.groundStations", [{"stationId": "station-svalbard", "passesPerDay": -1}]),
        ("design.imagingMinutesPerDay", 5000),
        ("difficulty", "impossible"),
        ("sandbox", "yes"),
    ],
)
def test_a_bad_value_is_refused(manager, path, value):
    room = manager.create()
    ada = room.join("p1", "Ada", None, nowhere)
    with pytest.raises(RoomError) as refused:
        room.apply_patch(ada, path, value, 0)
    assert refused.value.code == "invalid"
    assert room.rev == 0


def test_an_unknown_path_is_refused(manager):
    room = manager.create()
    ada = room.join("p1", "Ada", None, nowhere)
    for path in ["design.nope", "seed", "phase", "players"]:
        with pytest.raises(RoomError) as refused:
            room.apply_patch(ada, path, 1, 0)
        assert refused.value.code == "unknown_path"


def test_a_patch_based_on_old_state_is_refused_only_across_players(manager):
    room = manager.create()
    ada = room.join("p1", "Ada", None, nowhere)
    room.apply_patch(ada, "design.orbitId", "sso-500", 0)
    # Ada may change her own choice again before she has seen the echo.
    room.apply_patch(ada, "design.orbitId", "iss-like", 0)
    # Ben takes over every role, but has not seen Ada's last change.
    room.leave("p1")
    ben = room.join("p2", "Ben", None, nowhere)
    with pytest.raises(RoomError) as refused:
        room.apply_patch(ben, "design.orbitId", "landsat-705", 1)
    assert refused.value.code == "stale"
    assert refused.value.extra["value"] == "iss-like"
    room.apply_patch(ben, "design.orbitId", "landsat-705", room.rev)
    assert room.design["orbitId"] == "landsat-705"


def test_a_change_clears_everyones_ready(manager):
    room = manager.create()
    ada = room.join("p1", "Ada", None, nowhere)
    ben = room.join("p2", "Ben", None, nowhere)
    ada.ready = ben.ready = True
    path = next(path for path, role in PATH_ROLES.items() if role in ada.roles)
    _, cleared = room.apply_patch(ada, path, None if path.startswith("design.") else "concept", 0) if path != "sandbox" else room.apply_patch(ada, path, True, 0)
    assert cleared is True
    assert not ada.ready and not ben.ready


def test_launch_needs_every_player_ready_and_then_gives_one_seed(manager):
    room = manager.create()
    ada = room.join("p1", "Ada", None, nowhere)
    ben = room.join("p2", "Ben", None, nowhere)
    room.apply_patch(ada, next(p for p, r in PATH_ROLES.items() if r in ada.roles and p.endswith("Id")), "some-id", 0)
    ada.ready = True
    with pytest.raises(RoomError) as refused:
        room.launch()
    assert refused.value.code == "not_ready"

    ada.ready = ben.ready = True
    seed = room.seed
    message = room.launch()
    assert message == {"type": "launch", "seed": seed, "players": 2, "contributors": 1}
    assert room.phase == "operate"
    assert not ada.ready and not ben.ready
    assert 0 <= room.seed < 2**32


def test_idle_empty_rooms_are_dropped_and_the_room_count_is_capped(manager, clock):
    rooms = [manager.create() for _ in range(3)]
    with pytest.raises(RoomError) as refused:
        manager.create()
    assert refused.value.code == "server_full"

    rooms[0].join("p1", "Ada", None, nowhere)
    clock.now = manager.settings.room_idle_s + 1
    # The room with a player stays; the two empty ones go.
    assert manager.get(rooms[0].code) is rooms[0]
    assert manager.get(rooms[1].code) is None
    assert len(manager.rooms) == 1
    manager.create()
