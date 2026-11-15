# Game content

These JSON files are the game's data: the parts, cameras, rockets, orbits and
missions a player can choose. The game reads them when it is built. You can edit them
without touching any code.

| File | What it holds |
| --- | --- |
| `components.json` | Spacecraft parts: frames, solar arrays, batteries, radios, computer, pointing units, thruster |
| `instruments.json` | Cameras and other science instruments |
| `launchers.json` | Rockets |
| `orbits.json` | Orbits the player can pick |
| `scenarios.json` | Missions, each with its objective and requirements |
| `schemas/` | The rules each file must follow. Edit these only together with the code. |

JSON files cannot hold comments, so the explanations live here and in the
`description` lines inside each schema.

## Rules for every entry

1. **Real data only.** Take figures from the maker's page, a user guide, or a NASA or
   ESA page. Look them up; do not write them from memory.
2. **`source` and `retrieved` are required.** `source` is the URL or document name.
   `retrieved` is the date you read it, written `YYYY-MM-DD`.
3. **If a figure is not in the source, say so.** Set `"estimated": true`, explain
   which figure and how you worked it out in `estimate_basis`, and add the entry's
   `id` to `docs/model-assumptions.md`. The tests fail if you skip any of these.
4. **`id` is permanent.** Lower-case letters, digits and hyphens. Other files and
   saved games refer to it, so never change one that is in use.
5. **Units are in the field name.** `mass_kg` is kilograms, `cost_musd` is millions of
   US dollars (so US$6,300 is `0.0063`), `power_w` is watts.
6. **Text is for beginners.** `description` says what the thing is. `why_it_matters`
   says what the player gains and gives up by choosing it. Short sentences, no
   jargon, and every fact correct.
7. **`notes` is for the team.** Players never see it.

## Field notes

### Power

`power_w` is **negative when a part uses power** and **positive when it makes
power**. For a solar array it is the most the array makes in full sunlight when new.
`standby_power_w` is what a part uses while switched on but idle.

### Components (`components.json`)

`category` is one of `structure`, `solar_array`, `battery`, `communications`,
`computer`, `attitude_control`, `thermal`, `propulsion`. Some categories need extra
fields:

| Category | Extra fields |
| --- | --- |
| `structure` | `form_factor_u`: frame size in CubeSat units (1U is a 10 cm cube) |
| `battery` | `capacity_wh` |
| `communications` | `max_data_rate_mbps`, `frequency_mhz` (centre of the downlink band), `rf_power_w` |
| `propulsion` | `propellant_kg` (already counted in `mass_kg`), `isp_s`; optional `thrust_mn`, `total_impulse_ns` |

`fits_form_factors_u` lists the frame sizes a part is made for. Leave it out if the
part fits any frame.

### Instruments (`instruments.json`)

- `ground_resolution_m_at_500km` and `swath_km_at_500km` are the maker's figures for a
  500 km orbit. The game scales them for other altitudes.
- `compatible_objectives` lists the objective ids the instrument can serve. An
  instrument that cannot serve the chosen objective is shown greyed out with its
  `limitation` line as the reason.
- `science_value` (1 to 10) is a game score, not a real figure.

### Launchers (`launchers.json`)

- `capacity_kg_by_orbit` must name **every** orbit in `orbits.json`. Write `null` if
  the rocket cannot fly there. If you add an orbit, add it to every launcher.
- A `dedicated` launch has one price. A `rideshare` launch costs `cost_musd` for up to
  `included_mass_kg`, plus `extra_cost_musd_per_kg` for each kilogram above that.
- `launch_attempts` and `launch_successes` are raw counts; the game works out the
  reliability. Count only full successes, and update `record_as_of`.

### Orbits (`orbits.json`)

Only the altitude, tilt and shape are stored. The game works out the period, speed
and time in shadow from these.

### Scenarios (`scenarios.json`)

- `objective_id` links a scenario to the instruments that list it in
  `compatible_objectives`.
- Each requirement has a `metric` (what the simulation measures), a `comparator`
  (`<=` or `>=`) and a `threshold`. New metrics need code, so ask before adding one.
- `budget_musd`, `planned_lifetime_years` and the thresholds are game-design values.
  Record how you chose them in `estimate_basis`.

## Checking your changes

```
cd client
npm install
npm run test
```

The test reports which entry and which field is wrong.
