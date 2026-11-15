"""The WebSocket endpoint: one connection per player, JSON messages.

It checks each message, hands it to the room, and relays the result. Changes
go out as small patches; the full state is sent once, on join.
"""

import secrets
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from .models import (
    ChatMessage,
    JoinMessage,
    LaunchMessage,
    PatchMessage,
    PhaseMessage,
    ReadyMessage,
    client_message,
)
from .rooms import Player, Room, RoomError, RoomManager

router = APIRouter()

#: WebSocket close codes in the range reserved for applications.
CLOSE_NO_ROOM = 4404
CLOSE_ROOM_FULL = 4409
CLOSE_REPLACED = 4410


class TokenBucket:
    """A per-connection rate limit: `rate` messages a second, `burst` at once."""

    def __init__(self, rate: float, burst: int, clock=time.monotonic):
        self.rate = rate
        self.burst = burst
        self.clock = clock
        self.tokens = float(burst)
        self.updated = clock()

    def take(self) -> bool:
        now = self.clock()
        self.tokens = min(self.burst, self.tokens + (now - self.updated) * self.rate)
        self.updated = now
        if self.tokens < 1:
            return False
        self.tokens -= 1
        return True


def error(code: str, message: str) -> dict:
    return {"type": "error", "code": code, "message": message}


async def broadcast(room: Room, message: dict) -> None:
    for player in list(room.players.values()):
        try:
            await player.send(message)
        except Exception:
            # A dead connection is cleaned up by its own handler.
            pass


@router.websocket("/ws/{code}")
async def room_socket(websocket: WebSocket, code: str) -> None:
    manager: RoomManager = websocket.app.state.rooms
    settings = manager.settings
    await websocket.accept()
    room = manager.get(code)
    if room is None:
        await websocket.send_json(error("room_not_found", "There is no room with that code."))
        await websocket.close(CLOSE_NO_ROOM)
        return

    bucket = TokenBucket(settings.message_rate_per_s, settings.message_burst)
    player: Player | None = None
    try:
        while True:
            text = await websocket.receive_text()
            if len(text.encode()) > settings.max_message_bytes:
                await websocket.send_json(error("too_large", "That message is too large."))
                continue
            if not bucket.take():
                await websocket.send_json(error("rate_limited", "Too many messages. Slow down."))
                continue
            try:
                message = client_message.validate_json(text)
            except ValidationError:
                await websocket.send_json(error("invalid", "That message is not understood."))
                continue
            manager.touch(room)

            try:
                if isinstance(message, JoinMessage):
                    player_id = message.player_id or secrets.token_urlsafe(9)
                    if player is not None and player.id != player_id:
                        room.leave(player.id)
                    previous = room.players.get(player_id)
                    player = room.join(player_id, message.name, message.role, websocket.send_json)
                    if previous is not None and previous.send != websocket.send_json:
                        # The same player came back on a new connection.
                        player.ready = previous.ready
                        try:
                            await previous.send(error("replaced", "You joined from another window."))
                        except Exception:
                            pass
                    await websocket.send_json(room.state_message(player))
                    await broadcast(room, room.players_message())
                elif player is None or room.players.get(player.id) is not player:
                    await websocket.send_json(error("not_joined", "Join the room first."))
                elif isinstance(message, PatchMessage):
                    patch, cleared = room.apply_patch(player, message.path, message.value, message.base_rev)
                    await broadcast(room, patch)
                    if cleared:
                        await broadcast(room, room.players_message())
                elif isinstance(message, ReadyMessage):
                    player.ready = message.ready
                    await broadcast(room, room.players_message())
                elif isinstance(message, PhaseMessage):
                    await broadcast(room, room.set_phase(player, message.phase))
                elif isinstance(message, ChatMessage):
                    await broadcast(
                        room, {"type": "chat", "by": player.id, "name": player.name, "text": message.text}
                    )
                elif isinstance(message, LaunchMessage):
                    await broadcast(room, room.launch())
                    await broadcast(room, room.players_message())
            except RoomError as refused:
                await websocket.send_json(refused.as_message())
                if refused.code == "room_full":
                    await websocket.close(CLOSE_ROOM_FULL)
                    return
    except WebSocketDisconnect:
        pass
    finally:
        # Leave only if this connection is still the player's current one.
        if player is not None and room.players.get(player.id) is player:
            room.leave(player.id)
            manager.touch(room)
            await broadcast(room, room.players_message())
