"""Shapes of everything that crosses the wire.

These mirror the TypeScript types in client/src/lib/sim/types.ts (Design) and
client/src/lib/net/messages.ts (room messages). The server checks shape, range
and size only. It never simulates, scores or looks ids up in the game content.
"""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, TypeAdapter

#: A content id: lower-case letters, digits and hyphens (see /content/README.md).
ContentId = Annotated[str, StringConstraints(min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")]
PlayerName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=24)]

Difficulty = Literal["concept", "trade-study", "point-design"]
Phase = Literal["need", "concept", "requirements", "design", "verify", "operate"]
Role = Literal["planner", "engineer", "science", "comms"]
ROLES: tuple[Role, ...] = ("planner", "engineer", "science", "comms")

#: Seeds are unsigned 32-bit integers, the input of the client's mulberry32.
MAX_SEED = 2**32 - 1


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class StationBooking(Strict):
    stationId: ContentId
    passesPerDay: float = Field(ge=0, le=50)


class Design(Strict):
    """A player's mission design. Field names match the client's `Design`."""

    orbitId: ContentId | None = None
    launcherId: ContentId | None = None
    structureId: ContentId | None = None
    solarArrayId: ContentId | None = None
    batteryId: ContentId | None = None
    computerId: ContentId | None = None
    attitudeControlId: ContentId | None = None
    propulsionId: ContentId | None = None
    radioIds: list[ContentId] = Field(default_factory=list, max_length=8)
    instrumentIds: list[ContentId] = Field(default_factory=list, max_length=8)
    groundStations: list[StationBooking] = Field(default_factory=list, max_length=16)
    imagingMinutesPerDay: float = Field(default=0, ge=0, le=1440)


# ------------------------------------------------------------- room paths ---

#: Which role may change which part of the room state. With fewer than four
#: players the roles are merged, so every path always has an owner.
PATH_ROLES: dict[str, Role] = {
    # Mission planner: objective, orbit, and the level the team plays at.
    "scenarioId": "planner",
    "difficulty": "planner",
    "sandbox": "planner",
    "design.orbitId": "planner",
    # Spacecraft engineer: bus, power, structure.
    "design.structureId": "engineer",
    "design.solarArrayId": "engineer",
    "design.batteryId": "engineer",
    "design.computerId": "engineer",
    "design.attitudeControlId": "engineer",
    "design.propulsionId": "engineer",
    # Science lead: instruments and how much data they make.
    "design.instrumentIds": "science",
    "design.imagingMinutesPerDay": "science",
    # Comms and resources: radios, ground segment, and the launch (the
    # biggest single cost in the budget).
    "design.radioIds": "comms",
    "design.groundStations": "comms",
    "design.launcherId": "comms",
}

_SETUP_VALUES: dict[str, TypeAdapter] = {
    "scenarioId": TypeAdapter(ContentId),
    "difficulty": TypeAdapter(Difficulty),
    "sandbox": TypeAdapter(bool),
}


def validate_patch_value(path: str, value: Any, design: dict) -> Any:
    """Check a patch value and return it in stored form. Raises ValueError."""
    if path in _SETUP_VALUES:
        return _SETUP_VALUES[path].validate_python(value, strict=True)
    field = path.removeprefix("design.")
    if path not in PATH_ROLES or field not in Design.model_fields:
        raise ValueError(f"unknown path {path}")
    return Design.model_validate({**design, field: value}).model_dump()[field]


# ------------------------------------------------- client to server (WS) ---


class JoinMessage(Strict):
    type: Literal["join"]
    name: PlayerName
    #: The role the player would like. Granted if nobody else asked for it.
    role: Role | None = None
    #: Chosen by the client and kept for the visit, so a reconnect is
    #: recognised as the same player.
    player_id: Annotated[str, StringConstraints(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")] | None = None


class PatchMessage(Strict):
    type: Literal["patch"]
    path: Annotated[str, StringConstraints(max_length=64)]
    value: Any
    #: The newest room revision the sender had seen.
    base_rev: int = Field(ge=0)


class ReadyMessage(Strict):
    type: Literal["ready"]
    ready: bool


class PhaseMessage(Strict):
    type: Literal["phase"]
    phase: Phase


class ChatMessage(Strict):
    type: Literal["chat"]
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=280)]


class LaunchMessage(Strict):
    type: Literal["launch"]


ClientMessage = Annotated[
    JoinMessage | PatchMessage | ReadyMessage | PhaseMessage | ChatMessage | LaunchMessage,
    Field(discriminator="type"),
]
client_message = TypeAdapter(ClientMessage)

# Server to client messages are plain dicts built in rooms.py:
#   state   {type, rev, code, phase, scenarioId, difficulty, sandbox, design,
#            players, you}                       on join only
#   patch   {type, path, value, rev, by}
#   players {type, players: [{id, name, roles, ready, changes}]}
#   chat    {type, by, name, text}
#   launch  {type, seed, players, contributors}
#   error   {type, code, message, path?, value?}


# ------------------------------------------------------------------ REST ---


class RoomCreated(BaseModel):
    code: str
    seed: int


class RoomInfo(BaseModel):
    code: str
    players: int
    max_players: int


class DesignIn(Strict):
    scenario_id: ContentId
    design: Design


class DesignSaved(BaseModel):
    id: str


class DesignOut(BaseModel):
    id: str
    scenario_id: str
    design: Design
    created_at: str


class LeaderboardIn(Strict):
    scenario_id: ContentId
    difficulty: Difficulty
    #: Computed on the client. The server only checks that it is a score.
    score: float = Field(ge=0, le=100)
    design: Design
    seed: int = Field(ge=0, le=MAX_SEED)
    names: list[PlayerName] = Field(min_length=1, max_length=4)


class LeaderboardRow(BaseModel):
    id: int
    score: float
    names: list[str]
    seed: int
    created_at: str


class Leaderboard(BaseModel):
    rows: list[LeaderboardRow]
