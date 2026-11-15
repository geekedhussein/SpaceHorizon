# CLAUDE.md

Project context for Claude Code. Read this fully before writing code.

## 1. What we are building

A web game for the NASA Space Apps Challenge 2026, challenge **"Space Mission Design Game"**.

Players design, manage, simulate and evaluate a complete space mission, alone or in a
team of up to four. The game teaches that every engineering decision trades off against
others: a better instrument adds science value but also mass, power draw, data volume
and cost. There is rarely one perfect design.

Difficulty rating of the challenge: Intermediate and Beginner/Youth. Explanations must be
in plain language. Teaching *why* a mission failed matters as much as the simulation.

### What the brief asks for

Nearly everything in the brief is "could" or "may consider". The one firm requirement:
**the main resources must be clearly displayed at all times.**

A strong solution has:

- a clear user interface
- a mission configuration system
- resource management
- collaboration for up to four players
- a mission simulation and an evaluation/scoring system
- feedback that explains success or failure

Resources the player balances: **mass, power, budget, data, communications, time**
(development time and operational lifetime).

Scoring should reward: mission success, scientific value, efficient resource use,
decision quality, and teamwork.

### Two guiding principles

These override any conflicting detail elsewhere in this file.

1. **The game is 3D.** The spacecraft builder, the orbit and the mission playback are
   presented in a real-time 3D scene. 3D is the main interface, not an optional extra.
2. **As realistic and factually accurate as possible.** Component data, launch
   vehicles, orbits, physics and mission facts must be real or derived from real
   physics, with sources recorded. When a simplification is unavoidable, it is a
   documented, deliberate approximation, never an invented number.

Realism lives in the model; simplicity lives in the explanation. The audience still
includes beginners, so every real formula is paired with a plain-language tooltip.

## 2. Fixed technical decisions

Do not change these without asking.

| Layer | Choice |
| --- | --- |
| Client | Svelte + Vite, TypeScript, built as a static single-page app |
| 3D | Three.js, client-side only; the primary interface (see section 4) |
| Server | Python, FastAPI, WebSockets, one uvicorn worker |
| Storage | SQLite (file on disk), no database server |
| Content | JSON files in the repo (parts, instruments, launchers, orbits, scenarios, events) |

Use the current stable versions of each; check before pinning.

### The core architectural rule

**The simulation runs in the browser. The server never simulates.**

The server is hosted on a team member's own machine (or a small free VPS), so it must
stay very light. Its only jobs:

1. Serve the built static client.
2. Hold a small JSON state per room and relay changes over WebSocket.
3. Store saved designs and leaderboard rows in SQLite.

Consequences:

- The simulation is a **pure, deterministic function**:
  `simulate(design, scenario, seed) -> SimulationResult`. No `Math.random()`, no
  `Date.now()`, no network or DOM access inside it. Randomness comes from a seeded PRNG
  (for example mulberry32) created from `seed`.
- Same design + scenario + seed gives the same result on every client. Multiplayer
  rooms share one seed issued by the server, so all players see the same outcome.
- "Modify and rerun" and replays are free: rerun the function.
- Leaderboard scores are computed on the client and submitted with the design and seed.
  For v1 the server only sanity-checks the payload (shape, ranges, size). Do not port
  the simulation to Python.

### Server load rules

- Send state **patches**, never full state, after the initial join.
- No polling anywhere. WebSocket push only.
- Rooms live in memory in a dict; one worker process only (state is not shared across
  workers).
- Cap: 4 players per room, a configurable max room count, a per-connection message
  rate limit, and a max message size. Drop idle rooms after a timeout.
- SQLite writes happen only on explicit save and on leaderboard submit.
- Static files are served pre-built. No server-side rendering.

## 3. Game design

### Phases

The flow follows NASA's six-step process from the "Design and Develop Science Missions"
material, mapped onto JPL Concept Maturity Levels (CML) as a progress indicator.

| # | Phase | What the player does | CML label shown |
| --- | --- | --- | --- |
| 1 | Need and goals | Pick a scenario and science objective | CML 1, the idea |
| 2 | Concept | Choose mission type and orbit; see the four segments | CML 2, feasibility |
| 3 | Requirements | The objective generates measurable requirements | CML 2 |
| 4 | Design | Build spacecraft, pick instruments, launcher, ground stations | CML 3, trade space |
| 5 | Verify | Pre-launch check of every requirement and constraint | CML 4, point design |
| 6 | Operate | Run the simulation; watch the timeline; read the report | Mission |

Players can go back from 5 to 4 and from the report to 4 at any time. This loop is the
point of the game.

### "Begin with the end in mind"

Each science objective generates numeric requirements, and each requirement has a
check. Example: objective "map vegetation monthly" produces requirements such as
"revisit time <= 30 days", "ground resolution <= 30 m", "data returned >= X GB".
Scoring is mostly the degree to which requirements are met. Show each requirement with
a pass/fail/margin indicator.

### The four mission segments

All four are design choices, not only spacecraft and rocket:

- **Launch segment**: launch vehicle (capacity to each orbit, cost, reliability).
- **Space segment**: spacecraft bus and instruments.
- **Ground segment**: ground stations (number, contact time, cost) and operations.
- **User segment**: the science return, which is what the score measures.

### Spacecraft components

Subsystems: structure, power (solar arrays, batteries), communications, onboard
computer and storage, attitude control, thermal, propulsion (optional), instruments.

Every component has: `id`, `name`, `category`, `mass_kg`, `power_w` (negative draws,
positive generates), `cost_musd`, `tier` (simple/advanced), a plain-language
`description`, and a `why_it_matters` teaching line. Instruments also have
`data_rate_mbps`, `science_value`, and `compatible_objectives`.

### Objective-first constraints

Copied from NASA's Webb "Build It Yourself" game: options that cannot serve the chosen
objective are **greyed out with a one-line reason**, not hidden.

### Constraint model (real physics, plainly explained)

Use the standard first-order engineering equations, the kind used in early mission
studies. Each lives in a pure, unit-tested function with the formula and its source in
a comment, and each has a one-tooltip plain-language explanation. Use SI units
internally and real constants (Earth's gravitational parameter and radius, the solar
constant, and so on) defined once in a `constants.ts` with sources.

- **Orbit**: period from Kepler's third law; speed from the vis-viva equation; eclipse
  fraction from orbit geometry (altitude and beta angle; a circular-orbit worst case is
  an acceptable documented first version).
- **Mass and launch**: total wet mass + margin <= the launcher's published payload
  capacity to that orbit. Manoeuvres use the Tsiolkovsky rocket equation with real
  specific impulse values; delta-v for transfers from Hohmann formulas.
- **Power**: solar array output from the solar constant at the mission's distance from
  the Sun, cell efficiency, array area, incidence angle and yearly degradation;
  orbit-average generation must cover consumption; battery sized for eclipse duration
  and an allowed depth of discharge.
- **Communications and data**: a link budget (transmit power, antenna gains, free-space
  path loss at the real frequency and range, required signal-to-noise) gives the
  achievable data rate; ground-station contact time comes from orbit geometry and
  station latitude. Data generated <= rate x contact time; excess fills onboard
  storage, then is lost.
- **Thermal and radiation** (level 2 and above): equilibrium temperature estimate;
  radiation dose class by orbit regime affects component lifetime.
- **Lifetime**: atmospheric drag decay for low orbits (documented approximation),
  propellant budget, and component degradation.
- **Budget and time**: real published prices where they exist (launch prices,
  commercial CubeSat parts); otherwise a documented estimate. Advanced components add
  development time.

Accuracy rules for the model:

- Do not fabricate a formula or constant. If unsure, stop and ask, or cite a standard
  reference (for example *Space Mission Analysis and Design*, NASA's Systems
  Engineering Handbook, or the NASA Small Spacecraft State-of-the-Art report).
- Validate key functions against known cases in unit tests: the ISS period (about 92
  minutes), geostationary altitude (about 35,786 km), a published launcher capacity.
- Cross-check orbit results against GMAT or pykep offline when in doubt.
- Every approximation is listed in `/docs/model-assumptions.md` and reachable from the
  in-game About page.
- Difficulty levels change how much of the model is exposed and how tight the margins
  are. They never change the physics.

Orbit choice affects coverage, revisit, sunlight fraction, contact time, radiation,
lifetime and the launcher capacity needed.

### Simulation

A stepped timeline over the whole mission, computed up front from the physics module
(orbit-averaged quantities per step, so a multi-year mission stays fast). The 3D
playback then interpolates within steps for display. Per step: generate power, run instruments, produce data, downlink what fits,
roll for random events using the seeded PRNG, update component health.

Random events (solar flare, component fault, ground-station outage, budget cut) come
from `events.json`. Each has a probability, an effect, and which design choices
mitigate it (redundancy, radiation-tolerant parts, margins).

Output: a per-step log, final totals, per-requirement results, a score breakdown, and a
list of plain-language **cause explanations** ("Your battery was too small to cover the
35-minute eclipse, so the instrument shut down each orbit").

### Scoring

Score = weighted sum of: requirements met (science value), mission survived its
planned lifetime, efficiency (unused budget and sensible margins, not maximal ones),
and in team mode a collaboration component. Show the breakdown, never just a number.

### End-of-mission report

- success/failure per requirement with reasons
- resource charts over the mission
- what to change next time
- "your mission resembles ..." a real mission, with a short fact

### Difficulty levels

Three levels, modelled on NASA's Mission Design Lab study depth:

1. **Concept**: few components, generous margins, no random events.
2. **Trade study**: full catalogue, events on.
3. **Point design**: advanced components, tight budgets, harsher events. Unlocked by
   passing a level-2 mission (a checklist gate).

Plus a **sandbox** mode with constraints off.

### Multiplayer (1 to 4 players)

- One player creates a room and shares a short code.
- Roles: **Mission planner** (objective, orbit, schedule), **Spacecraft engineer**
  (bus, power, structure), **Science lead** (instruments, data), **Comms and
  resources** (communications, ground segment, budget). With fewer players, roles are
  merged; solo holds all four.
- Each role edits only its own part of the design. Everyone sees all resource bars
  live.
- Shared decisions: launching requires every player to confirm ready. Conflicts (one
  role's choice breaks another's budget) are highlighted so players must negotiate.
- A simple room chat or quick-reaction buttons is enough; no voice.

Stretch: competitive mode where several teams get the same scenario and seed and are
ranked.

### Teaching

- Short tooltip on every concept (orbital altitude, payload capacity, data rate).
- Concepts introduced gradually by difficulty level.
- A first-run tutorial mission.
- Always explain *why* a choice affected the outcome.

## 4. The 3D experience

The game is played in a Three.js scene with the interface panels laid over it.

### Scenes

- **Spacecraft builder**: the spacecraft is assembled in 3D. Each component is a 3D
  part with real proportions that attaches to the bus; adding a solar array or antenna
  visibly changes the model. The total must fit the chosen launcher's fairing, shown
  as a 3D envelope with its real dimensions.
- **Orbit and mission view**: Earth (or the target body) at true scale relative to the
  orbit, correct axial tilt and rotation rate, the Sun direction correct for the date,
  the day/night terminator, the orbit path, ground stations at their real coordinates,
  and visibility cones when a station is in contact. Scale exaggeration of the
  spacecraft itself is allowed, clearly labelled "not to scale".
- **Mission playback**: the simulation timeline drives the scene: the spacecraft moves
  along its orbit, enters eclipse, passes over stations, and events are shown where
  and when they happen. Time controls: play, pause, speed, scrub.

### Rules

- The 3D scene is a **view of the simulation state**. It never computes game results;
  positions shown must come from the same orbit functions the simulation uses.
- All textures and models ship with the client; nothing is fetched at runtime. Use
  public-domain NASA imagery and models (for example Blue Marble textures and NASA 3D
  Resources .glb files), record each asset's source and licence in
  `/docs/sources.md`, and do not use NASA logos.
- Performance budget: 60 fps on a mid-range laptop, usable on a recent phone. Compress
  textures, use level of detail, cap pixel ratio, pause rendering when the tab is
  hidden, lazy-load the 3D bundle and heavy assets.
- The server load is unaffected: all rendering is on the client.
- If WebGL is unavailable, show a clear message and fall back to 2D diagrams so the
  game remains playable. Resource bars, requirements and the report are always normal
  HTML so they stay readable and accessible.

### Orbit maths

Orbits come from Keplerian elements in JSON. Recipe (from NASA's mission-viz
Elliptical Orbit Design tutorial):

1. Elements: semi-major axis `a`, eccentricity `e`, inclination `i`, argument of
   perigee `w`, RAAN `O`, period `T`, time of perigee passage `tau`.
2. Mean anomaly: `M = 2*pi*(t - tau)/T`, wrapped to `[0, 2*pi)`.
3. Solve Kepler's equation `M = E - e*sin(E)` for `E` with Newton iteration until the
   change is below `1e-10` (cap iterations).
4. Position in the orbital plane: `x = a*(cos(E) - e)`, `y = a*sqrt(1 - e*e)*sin(E)`,
   `z = 0`.
5. Rotate by `w`, `i`, `O` to get the 3D position. Draw the full ellipse the same way.
6. A speed slider advances `t`. Controls: drag to rotate, scroll to zoom, toggles for
   labels and trajectory lines.

Put this in a pure module with unit tests (circular orbit, known eccentric case, ISS
period). Work in real units (km, s) and scale only at the rendering boundary. Use a
consistent, documented reference frame (Earth-centred inertial for the orbit; rotate
Earth beneath it). Two-body Keplerian motion is the baseline; add J2 nodal precession
for Sun-synchronous orbits, since that orbit type does not exist without it.

## 5. Repository layout

```
/client
  /src
    /lib
      /sim          pure simulation, PRNG, constraint checks, scoring (no Svelte imports)
      /physics      pure, sourced equations and constants.ts (orbit, power, link, propulsion,
                    coverage, thermal, drag)
      /orbit        Kepler propagation and reference frames (pure)
      /content      schema and cross-reference test for /content (typed access later)
      /strings      all user-facing text, one file per language (en.ts first)
      /scene3d      Three.js scenes: builder, orbit view, playback; asset loading
      /net          WebSocket client, message types, role table, reconnect
      /stores       game state: design, phase, room (Svelte runes, game.svelte.ts), tutorial
      /tutorial     the first-run tutorial's steps (pure, tested)
      /game         stars, badges and best scores (pure, tested); sound effects
      /components   resource bars, option cards, requirement list, charts, team panel
    /views          one view per phase
  /tests            Node-only test support (loads /content for the unit tests)
  /static
/content            JSON: components, instruments, launchers, orbits, ground_stations,
                    scenarios, ready_designs, events (events: later version)
  /schemas          JSON Schema for each content file
  README.md         editing guide for non-coders
/server
  /app
    main.py         FastAPI app, REST routes, static mount
    config.py       limits and paths, each settable with an SH_* environment variable
    rooms.py        in-memory room manager
    ws.py           WebSocket endpoint and message handling
    db.py           SQLite access
    models.py       Pydantic schemas for messages and REST payloads
  /tests
/docs
  sources.md              every data, texture and model source with licence
  model-assumptions.md    every approximation in the physics and content
CLAUDE.md
```

`/content` is the single source of truth for game data. The client imports it at build
time. Validate it with a schema in CI and in a unit test. Non-coders on the team edit
these files, so keep them flat and well commented in an adjacent README.

## 6. Server API

### REST

- `POST /api/rooms` -> `{code, seed}` creates a room.
- `GET /api/rooms/{code}` -> existence and player count.
- `POST /api/designs` saves a design; `GET /api/designs/{id}` loads it (shareable link).
- `POST /api/leaderboard` submits `{scenario_id, difficulty, score, design, seed, names}`.
- `GET /api/leaderboard?scenario_id=&difficulty=` returns the top rows.
- `GET /api/health`.

### WebSocket `/ws/{code}`

JSON messages with a `type` field. Validate every message with Pydantic.

Client to server: `join {name, role?, player_id?}`, `patch {path, value, base_rev}`,
`ready {ready}`, `phase {phase}`, `chat {text}`, `launch`.

Server to client: `state {full room state, rev, you}` (on join only),
`patch {path, value, rev, by}`, `players {players}`, `chat {by, name, text}`,
`error {code, message, path?, value?}`, `launch {seed, players, contributors}`.

Rules: the server is the authority on room state and assigns `rev`. It rejects a patch
whose `path` is outside the sender's role, and a `launch` unless all players are
ready. On reconnect the client sends `join` again and receives full state.

- A patch replaces one whole field: `scenarioId`, `difficulty`, `sandbox`, or
  `design.<field>`. The table of which role owns which path is `PATH_ROLES` in
  `server/app/models.py`, mirrored in `client/src/lib/net/roles.ts` (a client test
  checks the two match).
- A patch is refused as stale only if another player changed the same path after
  `base_rev`. A refusal carries the server's current `value`, so the client can show it.
- Any accepted patch clears every player's `ready`.
- `phase` moves the whole team to a step. It is sent out as a `patch` on path `phase`.
- `player_id` is chosen by the client and kept for the visit, so a reconnect is the
  same player. `launch` carries the raw counts for the client's teamwork score; the
  server does not score.

### SQLite tables

- `designs(id TEXT PRIMARY KEY, scenario_id, design_json, created_at)`
- `leaderboard(id INTEGER PRIMARY KEY, scenario_id, difficulty, score, names, design_json, seed, created_at)`

Use parameterised queries. Enable WAL mode. Rooms are not persisted.

## 7. Conventions

- TypeScript strict mode. Shared types for `Design`, `Scenario`, `SimulationResult`
  live in `/client/src/lib/sim/types.ts`; mirror the message types in
  `server/app/models.py`.
- `sim` and `orbit` maths modules are pure and fully unit-tested (Vitest). Include a
  determinism test: same inputs and seed give deep-equal results.
- Server tests with pytest, including WebSocket tests for join, patch, role rejection
  and launch.
- Units are explicit in every field name (`mass_kg`, `power_w`, `cost_musd`,
  `data_rate_mbps`).
- All user-facing text is plain language, short sentences. Keep strings in one place
  so the game can be translated (French is a likely second language).
- Accessible by default: keyboard navigation, labels, colour is never the only signal
  on resource bars, works at phone width.
- Small, focused commits. Do not add dependencies without a reason stated in the
  commit message.

## 8. Commands

Create these scripts and keep this section accurate.

```
# client
cd client && npm install
npm run dev          # Vite dev server, proxies /api and /ws to :8000
npm run build        # static build to client/dist
npm run test
npm run check        # svelte-check and type check
npm run start        # build the client and serve the whole game on :8000 (needs the server venv)

# server (call the venv's Python by path: a shell alias for python or pip
# would otherwise bypass the venv)
cd server && python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload --port 8000        # development
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000  # serve to the local network
.venv/bin/python -m pytest
```

In production the server serves `client/dist` as static files, so one process and one
port serve everything. Always run exactly one worker.

## 9. Build order

1. Content schemas (with required `source`) and a small, fully sourced starter set:
   one scenario, about 15 real components, 3 real launchers, 4 orbits.
2. Physics module with constants and validation tests against known cases.
3. Pure simulation, constraint checks and scoring, with tests. No UI yet.
4. 3D orbit and mission view driven by the orbit functions (Earth, orbit, stations).
5. Single-player UI through all six phases over the 3D scene, with live resource bars,
   the 3D spacecraft builder and the report.
6. FastAPI server: static serving, rooms, WebSocket relay, tests.
7. Multiplayer in the client: roles, patches, ready and launch.
8. Mission playback in 3D, events, difficulty levels, tutorial.
9. Saved designs, leaderboard.
10. Polish: explanations, real-mission comparison, accessibility, performance, mobile.

Single-player must be fully playable before multiplayer work starts.

## 10. Content data and sources

The NASA resources for this challenge give methods, not data tables, so content data
must be gathered from public sources. Content in `/content` is **real data**. Rules:

- Launch vehicles, orbits, ground stations, instruments and components are real or
  closely modelled on real, named items, with published figures (payload capacity by
  orbit, fairing dimensions, mass, power, data rate, price where public).
- Every entry has a required `source` field (URL or document name) and a `retrieved`
  date. The content schema test fails if `source` is missing.
- Never invent a figure or a source. If a real value cannot be found, mark the entry
  `"estimated": true` with an `estimate_basis` note, and list it in
  `/docs/model-assumptions.md`. Ask the team rather than guess for anything prominent.
- Do not rely on memory for specifications: look them up and cite them. Preferred
  sources: NASA Small Spacecraft State-of-the-Art report, launch provider user guides,
  NASA and ESA mission pages, NASA NSSDC, JPL Horizons and Solar System Dynamics for
  planetary constants and orbital elements, CubeSat 101.
- Scenarios are based on real mission types, and the "your mission resembles" facts
  must be accurate and sourced.
- Teaching text must be factually correct. Simplify the wording, never the facts.
- Any NASA resource used must be cited in the project submission; keep a running list
  in `/docs/sources.md`.

Reference material the design draws on:

- Design and Develop Science Missions (NASA SmallSat Institute webinar): six-step
  process, four segments, requirements with verification.
- Concept Maturity Levels (JPL): CML 1 to 4 and the 2-to-4 feedback loop.
- Mission Design Lab (NASA Goddard): study depths, discipline list.
- Webb "Build It Yourself" game: objective-first flow, greyed-out options, real-mission
  match. https://science.nasa.gov/mission/webb/game-build-it-yourself/
- NASA mission-viz: orbit maths and web visualisation approach.
  https://nasa.github.io/mission-viz/
- CubeSat 101 (NASA CSLI): beginner scenario and typical small-satellite phases.
- GMAT and pykep: offline only, to check orbit numbers. Never a runtime dependency.
- NASA Eyes and DSN Now: look-and-feel reference for the orbit and comms screens.

## 11. Things not to do

- Do not run simulation, physics or scoring on the server.
- Do not add a database server, Redis, a message queue, or server-side rendering.
- Do not use more than one server worker.
- Do not poll.
- Do not fetch external data or map tiles at runtime; everything needed ships with the
  client.
- Do not compute game results in the 3D layer.
- Do not invent data, constants, formulas or sources.
- Do not trade physical accuracy for convenience without recording it in
  `/docs/model-assumptions.md`.
- Do not copy NASA logos or imply NASA endorsement in the UI.

## 12. Open questions for the team

Ask before assuming on these:

- Final list of scenarios and which real missions they are compared with.
- Whether accounts are needed (current assumption: no accounts, display names only).
- Languages at launch (current assumption: English first, strings ready for French).
- Hosting target for the demo: own machine on the local network, or a free VPS.
