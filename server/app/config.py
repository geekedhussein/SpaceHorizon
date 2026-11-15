"""Server limits and paths. Every value can be set with an environment variable.

The server runs on a team member's own machine, so the defaults are small.
"""

import os
from dataclasses import dataclass
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    #: Most rooms held in memory at once.
    max_rooms: int = 50
    #: Most players in one room (the game is for teams of up to four).
    max_players: int = 4
    #: A room nobody has used for this long is dropped.
    room_idle_s: float = 30 * 60
    #: Largest WebSocket message accepted, in bytes.
    max_message_bytes: int = 16 * 1024
    #: Messages a connection may send per second, on average, and in a burst.
    message_rate_per_s: float = 10.0
    message_burst: int = 30
    #: Largest REST request body accepted, in bytes.
    max_body_bytes: int = 64 * 1024
    #: Rows returned by the leaderboard.
    leaderboard_rows: int = 20
    db_path: Path = SERVER_DIR / "data" / "space_horizon.sqlite3"
    #: The built client. Served as static files when the folder exists.
    static_dir: Path = SERVER_DIR.parent / "client" / "dist"


def load_settings() -> Settings:
    """Read settings from SH_* environment variables, falling back to the defaults."""
    defaults = Settings()

    def read(name: str, kind, fallback):
        raw = os.environ.get(f"SH_{name}")
        return kind(raw) if raw else fallback

    return Settings(
        max_rooms=read("MAX_ROOMS", int, defaults.max_rooms),
        max_players=min(4, read("MAX_PLAYERS", int, defaults.max_players)),
        room_idle_s=read("ROOM_IDLE_S", float, defaults.room_idle_s),
        max_message_bytes=read("MAX_MESSAGE_BYTES", int, defaults.max_message_bytes),
        message_rate_per_s=read("MESSAGE_RATE_PER_S", float, defaults.message_rate_per_s),
        message_burst=read("MESSAGE_BURST", int, defaults.message_burst),
        max_body_bytes=read("MAX_BODY_BYTES", int, defaults.max_body_bytes),
        leaderboard_rows=read("LEADERBOARD_ROWS", int, defaults.leaderboard_rows),
        db_path=read("DB_PATH", Path, defaults.db_path),
        static_dir=read("STATIC_DIR", Path, defaults.static_dir),
    )
