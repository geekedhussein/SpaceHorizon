# Model assumptions

Every approximation, estimate and game-design value in the game is listed here. If a
number in the game is not taken directly from a published source, it must appear on
this page. A unit test checks that every content entry marked `"estimated": true` is
listed here by its id.

Status: covers the starter content (build step 1). The physics and simulation
sections will be added with build steps 2 and 3.

## 1. Estimated content entries

Each entry's own `estimate_basis` field holds the full reasoning. This table is the
index.

### Placeholders that need a team decision

These figures have no public source. They were chosen by the game team so the game
can be built, and should be confirmed or replaced.

| Entry | Field | Value | Basis |
| --- | --- | --- | --- |
| `imager-gecko` | `cost_musd` | 0.03 | No public price. Close to the top of the only public CubeSat camera price found (XCAM C3D, US$11,900 to 27,400, FY2022). |
| `imager-multiscape50` | `cost_musd` | 0.10 | No public price, no close comparison. Placeholder. |
| `imager-multiscape100` | `cost_musd` | 0.25 | No public price, no close comparison. Placeholder. |
| `adcs-arcsec-arcus` | `cost_musd` | 0.10 | No public price. Three wheels at about the public price of one comparable wheel (Space Inventor WHL-100, 25,000 EUR) plus a star tracker, rounded. |
| `thruster-enpulsion-nano` | `cost_musd` | 0.05 | No public price, no comparison. Placeholder. |
| `computer-endurosat-obc` | `power_w` | -0.5 | Power draw is not published. Placeholder. |
| `falcon9-rideshare` | `capacity_kg_by_orbit` | 450 | SpaceX publishes no mass limit per payload. Working cap from the top bracket of the guide's load table ("451 kg +"). |

### Figures derived from published data

| Entry | Field | How it was derived |
| --- | --- | --- |
| `sso-500` | `inclination_deg` | Computed from the J2 nodal-precession condition for a circular sun-synchronous orbit. The same formula gives 98.21 degrees at 705 km (Landsat 9 publishes 98.2) and 98.54 degrees at 786 km (Sentinel-2 publishes 98.62). |
| `electron` | `capacity_kg_by_orbit` | 200 kg to `sso-500` is stated in the user guide. The other orbits are read from the performance chart (page 35), rounded down to the nearest 5 kg. `iss-like` is interpolated between the 40 and 60 degree curves. |
| `firefly-alpha` | `capacity_kg_by_orbit`, `cost_musd` | 630 kg to `sso-500` is stated in the user guide. The other orbits are read from the performance charts, rounded down to the nearest 10 kg. `iss-like` is interpolated between the 50 and 62 degree curves. The price is the lower end of the published US$15 to 17.6 million. |
| `falcon9-rideshare` | `cost_musd`, `included_mass_kg`, `extra_cost_musd_per_kg` | From a secondary source quoting SpaceX's price page, which could not be read directly. |
| `imager-gecko`, `imager-multiscape50`, `imager-multiscape100` | `data_rate_mbps` | Not published. Derived as pixels across x bits per pixel x bands x lines per second, where lines per second = ground speed at 500 km (7.06 km/s) / pixel size on the ground. No compression. For `imager-gecko` the pixel count is swath / pixel size, with one 10-bit sample per pixel. |
| `imager-gecko` | `mass_kg`, `power_w` | The published upper limits ("below 0.5 kg", "below 6 W") are used as the values. |
| `solar-deployable-3u-endurosat` | `mass_kg`, `cost_musd` | The source gives ranges across the single and double versions. The top of each range is assigned to the double version. |
| `solar-deployable-6u-endurosat` | `mass_kg` | The source gives a range across versions. The top of the range is used. |
| `adcs-tensortech-mtq` | `mass_kg`, `power_w`, `cost_musd` | The source gives ranges across versions. The top of each range is used. |
| `adcs-arcsec-arcus` | `power_w` | Top of the published 0.94 to 1.4 W range. |
| `thruster-enpulsion-nano` | `isp_s`, `total_impulse_ns` | Lower bound of the published 2,000 to 6,000 s range, and the published minimum total impulse. |
| `battery-36wh-orbastro` | `cost_musd` | List price of 7,000 GBP (2021) converted at 1.3227 USD per GBP, the European Central Bank reference rate for 13 Nov 2026. |
| `battery-99wh-endurosat` | `cost_musd` | No public price. Scaled by stored energy from `battery-36wh-orbastro` (7,000 GBP x 99/36), same exchange rate. |
| `vegetation-monthly` | requirement thresholds | See section 2. |

## 2. Game-design values

These are not real-world data and are not meant to be. They are tuning values for the
game and may change during balancing.

- **`science_value`** on instruments (1 to 10). Current values: 2, 6 and 9, ordered by
  number of colour bands and sharpness.
- **`tier`** (simple or advanced) on components and instruments.
- **Scenario `vegetation-monthly`**:
  - `budget_musd` = 10 and `planned_lifetime_years` = 2.
  - Revisit threshold of 30 days ("monthly").
  - Resolution threshold of 30 m, matching Landsat 9's main camera.
  - Data threshold of 500 GB per month. Derivation: all land on Earth
    (148.94 million km2) x 1,111 pixels per km2 at 30 m x 2 bands (red and
    near-infrared) x 12 bits = 496 GB, uncompressed, rounded to 500.
  - All four thresholds will be checked against the simulation in build step 3 and
    re-tuned if no real design can meet them or every design can.

## 3. Deliberate approximations in the content

- **`iss-like` orbit altitude.** NASA gives the station's altitude as 370 to 460 km.
  The game uses 400 km.
- **All starter orbits are circular** (`eccentricity` = 0). The real orbits are very
  nearly circular.
- **Launch records count only full successes.** Partial failures count as
  non-successes. Electron's record includes HASTE suborbital flights of the same
  rocket.
- **Falcon 9 rideshare fairing.** The size given is the whole Falcon 9 fairing, which
  rideshare payloads share. The real limit is the volume of the purchased plate.
- **Falcon 9 rideshare orbits.** Only `sso-500` is offered. Real rideshare flights go
  to slightly different sun-synchronous altitudes on each mission; other orbits are
  sold by quote only.
- **Radio frequency.** `frequency_mhz` is the centre of the published downlink band.
- **Launch prices are list prices from different years** (Electron 2020, Alpha 2022,
  rideshare 2026) and are not adjusted for inflation. The same holds for component
  prices (2021 to 2026).

## 4. Not in the starter set yet

- Ground stations, random events, antennas and thermal parts have no content yet.
- Development time per component is not recorded yet.
- The real-mission comparison holds one mission (Landsat 9) inside the scenario entry.
