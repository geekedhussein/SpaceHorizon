"""The Space Horizon server.

Three jobs only: serve the built client, relay room state over WebSocket, and
store saved designs and leaderboard rows. The mission simulation runs in the
browser; nothing here simulates or scores.

Run with exactly one worker: rooms live in this process's memory.
"""

import os
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from . import db
from .config import Settings, load_settings
from .models import (
    ContentId,
    DesignIn,
    DesignOut,
    DesignSaved,
    Difficulty,
    Leaderboard,
    LeaderboardIn,
    RoomCreated,
    RoomInfo,
)
from .rooms import RoomError, RoomManager
from .ws import router as ws_router

api = APIRouter(prefix="/api")


def _settings(request: Request) -> Settings:
    return request.app.state.settings


@api.get("/health")
def health() -> dict:
    return {"status": "ok"}


@api.post("/rooms", response_model=RoomCreated, status_code=201)
def create_room(request: Request):
    try:
        room = request.app.state.rooms.create()
    except RoomError as refused:
        raise HTTPException(status_code=503, detail=refused.message) from None
    return {"code": room.code, "seed": room.seed}


@api.get("/rooms/{code}", response_model=RoomInfo)
def room_info(code: str, request: Request):
    room = request.app.state.rooms.get(code)
    if room is None:
        raise HTTPException(status_code=404, detail="There is no room with that code.")
    return {"code": room.code, "players": len(room.players), "max_players": room.max_players}


@api.post("/designs", response_model=DesignSaved, status_code=201)
def save_design(payload: DesignIn, request: Request):
    design_id = db.save_design(_settings(request).db_path, payload.scenario_id, payload.design.model_dump())
    return {"id": design_id}


@api.get("/designs/{design_id}", response_model=DesignOut)
def load_design(design_id: str, request: Request):
    found = db.load_design(_settings(request).db_path, design_id)
    if found is None:
        raise HTTPException(status_code=404, detail="There is no saved design with that id.")
    return found


@api.post("/leaderboard", status_code=201)
def submit_score(payload: LeaderboardIn, request: Request) -> dict:
    row_id = db.add_score(
        _settings(request).db_path,
        payload.scenario_id,
        payload.difficulty,
        payload.score,
        payload.names,
        payload.design.model_dump(),
        payload.seed,
    )
    return {"id": row_id}


@api.get("/leaderboard", response_model=Leaderboard)
def leaderboard(scenario_id: ContentId, difficulty: Difficulty, request: Request):
    settings = _settings(request)
    return {"rows": db.top_scores(settings.db_path, scenario_id, difficulty, settings.leaderboard_rows)}


class _ClientFiles(StaticFiles):
    """The built client, or a short note saying how to build it."""

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] == "http" and not os.path.isdir(self.directory):
            note = PlainTextResponse(
                "The game is not built yet. Run: cd client && npm run build, then reload this page.",
                status_code=503,
            )
            await note(scope, receive, send)
            return
        await super().__call__(scope, receive, send)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        db.init_db(settings.db_path)
        yield

    app = FastAPI(title="Space Horizon", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings = settings
    app.state.rooms = RoomManager(settings)

    @app.middleware("http")
    async def limit_body_size(request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            # A body must say how long it is, so it can be refused unread.
            length = request.headers.get("content-length", "0")
            if "transfer-encoding" in request.headers or not length.isdigit():
                return JSONResponse({"detail": "A Content-Length header is required."}, status_code=411)
            if int(length) > settings.max_body_bytes:
                return JSONResponse({"detail": "That request is too large."}, status_code=413)
        return await call_next(request)

    app.include_router(api)
    app.include_router(ws_router)
    # The built client. Mounted last so /api and /ws win. The folder is checked
    # on each request, so a client built after the server started is served too.
    app.mount("/", _ClientFiles(directory=settings.static_dir, html=True, check_dir=False), name="client")
    return app


app = create_app()
