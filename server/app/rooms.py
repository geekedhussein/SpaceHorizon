"""Rooms: a small shared state per team, held in memory.

Everything here is plain logic with no network code, so it is easy to test.
ws.py does the sending. The server relays and guards the state; it never
simulates the mission.
"""

import secrets
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from .config import Settings
from .models import MAX_SEED, PATH_ROLES, ROLES, Design, validate_patch_value

#: Letters and digits that are hard to mix up when read aloud (no 0/O, 1/I/L).
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 5

Send = Callable[[dict], Awaitable[None]]


class RoomError(Exception):
    """A request the room refuses. Sent to the client as an `error` message."""

    def __init__(self, code: str, message: str, **extra: Any):
        super().__init__(message)
        self.code = code
        self.message = message
        self.extra = extra

    def as_message(self) -> dict:
        return {"type": "error", "code": self.code, "message": self.message, **self.extra}


def new_seed() -> int:
    return secrets.randbelow(MAX_SEED + 1)


@dataclass
class Player:
    id: str
    name: str
    send: Send
    preferred_role: str | None = None
    roles: list[str] = field(default_factory=list)
    ready: bool = False


@dataclass
class Room:
    code: str
    seed: int
    max_players: int
    last_active: float
    rev: int = 0
    phase: str = "need"
    #: None until the planner picks one; the client then shows its default.
    scenario_id: str | None = None
    difficulty: str = "concept"
    sandbox: bool = False
    design: dict = field(default_factory=lambda: Design().model_dump())
    #: Connected players, in the order they joined.
    players: dict[str, Player] = field(default_factory=dict)
    #: For each path: the revision that last changed it, and who did.
    path_rev: dict[str, tuple[int, str]] = field(default_factory=dict)
    #: Changes made by each player id. Kept when a player reconnects.
    changes: dict[str, int] = field(default_factory=dict)

    # ---------------------------------------------------------- players ---

    def join(self, player_id: str, name: str, role: str | None, send: Send) -> Player:
        if player_id not in self.players and len(self.players) >= self.max_players:
            raise RoomError("room_full", "This room is full.")
        player = Player(id=player_id, name=name, send=send, preferred_role=role)
        self.players[player_id] = player
        self.changes.setdefault(player_id, 0)
        self.assign_roles()
        return player

    def leave(self, player_id: str) -> None:
        if self.players.pop(player_id, None) is not None:
            self.assign_roles()

    def assign_roles(self) -> None:
        """Share the four roles among the connected players.

        A player gets the role they asked for if nobody earlier asked for it.
        The roles left over go one at a time to whoever has the fewest, in
        join order. So a solo player holds all four, two players hold two
        each, and so on.
        """
        players = list(self.players.values())
        for player in players:
            player.roles = []
        taken: set[str] = set()
        for player in players:
            if player.preferred_role in ROLES and player.preferred_role not in taken:
                player.roles.append(player.preferred_role)
                taken.add(player.preferred_role)
        if not players:
            return
        for role in ROLES:
            if role not in taken:
                min(players, key=lambda player: len(player.roles)).roles.append(role)
        for player in players:
            player.roles.sort(key=ROLES.index)

    def players_message(self) -> dict:
        return {
            "type": "players",
            "players": [
                {
                    "id": player.id,
                    "name": player.name,
                    "roles": player.roles,
                    "ready": player.ready,
                    "changes": self.changes.get(player.id, 0),
                }
                for player in self.players.values()
            ],
        }

    def state_message(self, player: Player) -> dict:
        return {
            "type": "state",
            "rev": self.rev,
            "code": self.code,
            "phase": self.phase,
            "scenarioId": self.scenario_id,
            "difficulty": self.difficulty,
            "sandbox": self.sandbox,
            "design": self.design,
            "players": self.players_message()["players"],
            "you": player.id,
        }

    # ------------------------------------------------------------ state ---

    def _current(self, path: str) -> Any:
        if path == "scenarioId":
            return self.scenario_id
        if path in ("difficulty", "sandbox", "phase"):
            return getattr(self, path)
        return self.design.get(path.removeprefix("design."))

    def apply_patch(self, player: Player, path: str, value: Any, base_rev: int) -> tuple[dict, bool]:
        """Apply one change. Returns the patch to broadcast, and whether any
        player's "ready" was cleared by it."""
        role = PATH_ROLES.get(path)
        if role is None:
            raise RoomError("unknown_path", "That part of the mission cannot be changed.", path=path)
        if role not in player.roles:
            raise RoomError(
                "forbidden", "That choice belongs to another role.", path=path, value=self._current(path)
            )
        last_rev, last_by = self.path_rev.get(path, (0, player.id))
        if last_by != player.id and last_rev > base_rev:
            raise RoomError(
                "stale", "Someone else changed that first.", path=path, value=self._current(path)
            )
        try:
            stored = validate_patch_value(path, value, self.design)
        except ValueError:
            # Pydantic's ValidationError is a ValueError too.
            raise RoomError(
                "invalid", "That value is not allowed.", path=path, value=self._current(path)
            ) from None

        if path == "scenarioId":
            self.scenario_id = stored
        elif path in ("difficulty", "sandbox"):
            setattr(self, path, stored)
        else:
            self.design[path.removeprefix("design.")] = stored
        self.rev += 1
        self.path_rev[path] = (self.rev, player.id)
        self.changes[player.id] = self.changes.get(player.id, 0) + 1
        # The mission changed, so earlier "ready" answers no longer stand.
        cleared = any(other.ready for other in self.players.values())
        for other in self.players.values():
            other.ready = False
        return {"type": "patch", "path": path, "value": stored, "rev": self.rev, "by": player.id}, cleared

    def set_phase(self, player: Player, phase: str) -> dict:
        self.phase = phase
        self.rev += 1
        return {"type": "patch", "path": "phase", "value": phase, "rev": self.rev, "by": player.id}

    def launch(self) -> dict:
        """Start the mission for everyone with one shared seed."""
        if not self.players or not all(player.ready for player in self.players.values()):
            raise RoomError("not_ready", "Every player must be ready before launch.")
        message = {
            "type": "launch",
            "seed": self.seed,
            # Raw counts for the client's teamwork score: how many players
            # are in the team, and how many of them changed the mission.
            "players": len(self.players),
            "contributors": sum(1 for player in self.players.values() if self.changes.get(player.id, 0) > 0),
        }
        # The next launch gets fresh luck.
        self.seed = new_seed()
        self.phase = "operate"
        self.rev += 1
        for player in self.players.values():
            player.ready = False
        return message


class RoomManager:
    """All rooms, in one dict in this one process."""

    def __init__(self, settings: Settings, clock: Callable[[], float] = time.monotonic):
        self.settings = settings
        self.clock = clock
        self.rooms: dict[str, Room] = {}

    def sweep(self) -> None:
        """Drop rooms nobody has used for a while. Called when rooms are
        created or looked up, so no timer is needed."""
        now = self.clock()
        for code in [
            code
            for code, room in self.rooms.items()
            if not room.players and now - room.last_active > self.settings.room_idle_s
        ]:
            del self.rooms[code]

    def create(self) -> Room:
        self.sweep()
        if len(self.rooms) >= self.settings.max_rooms:
            raise RoomError("server_full", "The server has no free rooms. Try again later.")
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            if code not in self.rooms:
                break
        room = Room(code=code, seed=new_seed(), max_players=self.settings.max_players, last_active=self.clock())
        self.rooms[code] = room
        return room

    def get(self, code: str) -> Room | None:
        self.sweep()
        return self.rooms.get(code.upper())

    def touch(self, room: Room) -> None:
        room.last_active = self.clock()
