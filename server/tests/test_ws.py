from contextlib import ExitStack
from dataclasses import replace

import pytest
from app.main import create_app
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


def new_room(client) -> dict:
    return client.post("/api/rooms").json()


def join(socket, name, role=None, player_id=None) -> dict:
    """Join and return the full state. Leaves the `players` update unread."""
    message = {"type": "join", "name": name}
    if role:
        message["role"] = role
    if player_id:
        message["player_id"] = player_id
    socket.send_json(message)
    state = socket.receive_json()
    assert state["type"] == "state"
    return state


def test_join_sends_the_full_state_once_then_the_player_list(client):
    room = new_room(client)
    with client.websocket_connect(f"/ws/{room['code']}") as ada:
        state = join(ada, "Ada")
        assert state["code"] == room["code"]
        assert state["rev"] == 0
        assert state["phase"] == "need"
        assert state["design"]["orbitId"] is None
        assert "seed" not in state
        players = ada.receive_json()
        assert players["type"] == "players"
        assert players["players"] == [
            {
                "id": state["you"],
                "name": "Ada",
                "roles": ["planner", "engineer", "science", "comms"],
                "ready": False,
                "changes": 0,
            }
        ]
        assert client.get(f"/api/rooms/{room['code']}").json()["players"] == 1
    assert client.get(f"/api/rooms/{room['code']}").json()["players"] == 0


def test_an_unknown_room_is_refused(client):
    with client.websocket_connect("/ws/ZZZZZ") as socket:
        assert socket.receive_json()["code"] == "room_not_found"
        with pytest.raises(WebSocketDisconnect) as closed:
            socket.receive_json()
        assert closed.value.code == 4404


def test_messages_before_join_and_malformed_messages_are_refused(client):
    room = new_room(client)
    with client.websocket_connect(f"/ws/{room['code']}") as socket:
        socket.send_json({"type": "ready", "ready": True})
        assert socket.receive_json()["code"] == "not_joined"
        for bad in ['{"type": "dance"}', "not json", '{"type": "join", "name": ""}', '{"type": "join", "name": "A", "x": 1}']:
            socket.send_text(bad)
            assert socket.receive_json()["code"] == "invalid"


def test_a_patch_reaches_every_player_as_a_patch_not_as_full_state(client):
    room = new_room(client)
    with client.websocket_connect(f"/ws/{room['code']}") as ada, client.websocket_connect(f"/ws/{room['code']}") as ben:
        join(ada, "Ada", "planner")
        ada.receive_json()
        join(ben, "Ben", "engineer")
        ben.receive_json()
        ada.receive_json()  # the player list, now with Ben

        ada.send_json({"type": "patch", "path": "design.orbitId", "value": "sso-500", "base_rev": 0})
        for socket in (ada, ben):
            patch = socket.receive_json()
            assert patch["type"] == "patch"
            assert (patch["path"], patch["value"], patch["rev"]) == ("design.orbitId", "sso-500", 1)

        # A later joiner gets the change inside the full state.
        with client.websocket_connect(f"/ws/{room['code']}") as chen:
            state = join(chen, "Chen")
            assert state["design"]["orbitId"] == "sso-500"
            assert state["rev"] == 1


def test_a_patch_outside_the_senders_role_is_rejected(client):
    room = new_room(client)
    with client.websocket_connect(f"/ws/{room['code']}") as ada, client.websocket_connect(f"/ws/{room['code']}") as ben:
        join(ada, "Ada", "planner")
        ada.receive_json()
        join(ben, "Ben", "engineer")
        ben.receive_json()
        ada.receive_json()

        ben.send_json({"type": "patch", "path": "design.orbitId", "value": "sso-500", "base_rev": 0})
        refused = ben.receive_json()
        assert refused["type"] == "error"
        assert refused["code"] == "forbidden"
        assert refused["path"] == "design.orbitId"
        assert refused["value"] is None

        # Nothing was broadcast: the next thing Ada sees is her own patch.
        ada.send_json({"type": "patch", "path": "design.orbitId", "value": "iss-like", "base_rev": 0})
        assert ada.receive_json()["value"] == "iss-like"


def test_launch_is_rejected_until_every_player_is_ready(client):
    room = new_room(client)
    with client.websocket_connect(f"/ws/{room['code']}") as ada, client.websocket_connect(f"/ws/{room['code']}") as ben:
        join(ada, "Ada")
        ada.receive_json()
        join(ben, "Ben")
        ben.receive_json()
        ada.receive_json()

        ada.send_json({"type": "ready", "ready": True})
        assert [player["ready"] for player in ada.receive_json()["players"]] == [True, False]
        ben.receive_json()

        ada.send_json({"type": "launch"})
        assert ada.receive_json()["code"] == "not_ready"

        ben.send_json({"type": "ready", "ready": True})
        ada.receive_json()
        ben.receive_json()

        ben.send_json({"type": "launch"})
        launches = [ada.receive_json(), ben.receive_json()]
        assert launches[0] == launches[1]
        assert launches[0] == {"type": "launch", "seed": room["seed"], "players": 2, "contributors": 0}
        # Ready is cleared for the next run.
        assert [player["ready"] for player in ada.receive_json()["players"]] == [False, False]


def test_phase_and_chat_are_relayed(client):
    room = new_room(client)
    with client.websocket_connect(f"/ws/{room['code']}") as ada:
        state = join(ada, "Ada")
        ada.receive_json()
        ada.send_json({"type": "phase", "phase": "design"})
        assert ada.receive_json() == {"type": "patch", "path": "phase", "value": "design", "rev": 1, "by": state["you"]}
        ada.send_json({"type": "chat", "text": "  Ready when you are  "})
        assert ada.receive_json() == {"type": "chat", "by": state["you"], "name": "Ada", "text": "Ready when you are"}
        ada.send_json({"type": "chat", "text": "x" * 281})
        assert ada.receive_json()["code"] == "invalid"


def test_a_fifth_player_is_turned_away(client):
    room = new_room(client)
    with ExitStack() as stack:
        for index in range(4):
            socket = stack.enter_context(client.websocket_connect(f"/ws/{room['code']}"))
            join(socket, f"P{index}")
        with client.websocket_connect(f"/ws/{room['code']}") as late:
            late.send_json({"type": "join", "name": "Late"})
            assert late.receive_json()["code"] == "room_full"
            with pytest.raises(WebSocketDisconnect) as closed:
                late.receive_json()
            assert closed.value.code == 4409


def test_rejoining_with_the_same_player_id_keeps_the_players_changes(client):
    room = new_room(client)
    with client.websocket_connect(f"/ws/{room['code']}") as first:
        join(first, "Ada", player_id="ada-12345678")
        first.receive_json()
        first.send_json({"type": "patch", "path": "sandbox", "value": True, "base_rev": 0})
        first.receive_json()
    with client.websocket_connect(f"/ws/{room['code']}") as again:
        state = join(again, "Ada", player_id="ada-12345678")
        assert state["you"] == "ada-12345678"
        assert state["sandbox"] is True
        assert state["players"] == [
            {"id": "ada-12345678", "name": "Ada", "roles": ["planner", "engineer", "science", "comms"], "ready": False, "changes": 1}
        ]


def test_oversized_and_too_frequent_messages_are_refused(settings):
    with TestClient(create_app(replace(settings, max_message_bytes=200, message_burst=2, message_rate_per_s=0.001))) as client:
        room = new_room(client)
        with client.websocket_connect(f"/ws/{room['code']}") as socket:
            join(socket, "Ada")
            socket.receive_json()
            socket.send_json({"type": "chat", "text": "x" * 250})
            assert socket.receive_json()["code"] == "too_large"
            socket.send_json({"type": "chat", "text": "one"})
            assert socket.receive_json()["type"] == "chat"
            socket.send_json({"type": "chat", "text": "two"})
            assert socket.receive_json()["code"] == "rate_limited"
