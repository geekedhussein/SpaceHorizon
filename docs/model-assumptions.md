# Model assumptions

Every approximation, estimate and game-design value in the game is listed here. If a
number in the game is not taken directly from a published source, it must appear on
this page. A unit test checks that every content entry marked `"estimated": true` is
listed here by its id.

Status: covers the starter content (build step 1), the physics module (build step 2,
section 5) and the simulation, checks and scoring (build step 3, section 6).

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
| `solar-deployable-3u-endurosat`, `solar-deployable-6u-endurosat` | `deployed_area_m2` | Not published. Number of cells x the area per cell of the 7-cell 3U body panel (one 100 x 340.5 mm face). Every cell is counted as unfolded, which overstates drag if some cells sit on the body. |
| `radio-uhf-endurosat`, `radio-sband-endurosat`, `radio-xband-endurosat` | `antenna_gain_dbi`, `antenna_mass_kg`, `cost_musd` | Each radio is paired with its maker's matching antenna. Antenna prices are not public and are left out of `cost_musd`. The UHF and X-band gains are the published lower bounds ("more than 0 dBi", "more than 16 dBi"). |
| `vegetation-monthly` | requirement thresholds | See section 2. |

## 2. Game-design values

These are not real-world data and are not meant to be. They are tuning values for the
game and may change during balancing.

- **`science_value`** on instruments (1 to 10). Current values: 2, 6 and 9, ordered by
  number of colour bands and sharpness.
- **`tier`** (simple or advanced) on components and instruments.
- **Scenario `vegetation-monthly`**:
  - `budget_musd` = 12 and `planned_lifetime_years` = 2.
  - Revisit threshold of 30 days ("monthly").
  - Resolution threshold of 50 m.
  - Data threshold of 1,000 GB per month. Derivation: all land on Earth
    (148.94 million km2) at 42.3 m pixels x 8 bands x 12 bits = 999 GB,
    uncompressed, rounded to 1,000. 42.3 m is the pixel size of the game's 30 m
    camera flown at Landsat's 705 km.
  - History: the first values were 30 m, 2,000 GB (a full map at 30 m) and US$10
    million. With them only the 500 km orbit could pass, so the team loosened them on
    15 Nov 2026. Now all three sun-synchronous orbits can pass.
- **Difficulty margins** (`sim/parameters.ts`). Spare launch capacity and spare solar
  power required: 0% at Concept, 10% at Trade study, 20% at Point design. Random event
  chances are multiplied by 0, 1 and 2.
- **Link margin** of 3 dB kept in every link budget.
- **Score weights.** Solo: requirements 55, survival 25, efficiency 20. Team:
  50, 20, 20, and 10 for collaboration.
- **Sensible margin.** A spare share of power or downlink up to 50% earns full
  efficiency marks. Beyond that the marks fall in a straight line to zero at 200%.
- **Efficiency scaling.** The efficiency part is multiplied by the requirements part,
  so a cheap mission that achieves nothing earns nothing for being cheap.

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
- **CubeSat size and mass limits** (`body_size_mm`, `max_mass_kg` on the frames) are
  the CubeSat Design Specification's limits for a whole spacecraft. They were read
  from a published table of the specification, not from the specification's own PDF.
- **Ground stations.** One dish per site, with the figures of the Near Earth Network
  guide's overview table (Table 2-1). Where a detail table in the same guide differs,
  the entry's `notes` says so. Three of the six sites are commercial (KSAT, SSC).
- **Ground-station price.** Every station costs US$491 per pass. This is NASA's 2018
  planning rate for a Near Earth Network pass of up to 30 minutes. Commercial
  operators do not publish prices, so the same rate is used for their sites.
- **No UHF ground station.** The Near Earth Network has no UHF receivers, so
  `radio-uhf-endurosat` cannot reach any station in the game yet. Real CubeSat teams
  use their own or university UHF stations.
- **Launch prices are list prices from different years** (Electron 2020, Alpha 2022,
  rideshare 2026) and are not adjusted for inflation. The same holds for component
  prices (2021 to 2026).

## 4. Not in the starter set yet

- Random events and thermal parts have no content yet (events: build step 8).
- Antennas are not separate parts. Each radio carries its maker's matching antenna.
- Development time per component is not recorded yet, so the simulation does not
  model it.
- The real-mission comparison holds one mission (Landsat 9) inside the scenario entry.

## 5. Physics model

The equations live in `client/src/lib/physics`. Each function carries its formula and
reference in a comment. This section lists what each one leaves out.

### Conventions

- **Units.** SI base units and radians inside the module. Content files use km,
  degrees and days; they are converted at the boundary.
- **Earth is a sphere of its equatorial radius** (6378.137 km) for altitude, eclipse,
  slant range and station contact. Earth's real polar radius is 21 km smaller.
- **Earth's GM** is the JPL DE440 value, not the rounded NASA fact-sheet value.
- **Textbook references** (Vallado, the New SMAD, Curtis) are cited by title and topic.
  Page and equation numbers were not checked against a printed copy.

### Orbit

- **Two-body motion** plus the long-term J2 drift of the orbit plane. No other
  disturbances. The period does not include J2 or drag.
- **Circular orbits** for eclipse, ground speed, contact and drag.
- **Eclipse.** Earth's shadow is a cylinder: no half-shadow edge, no bending of light by
  the air. The default Sun angle (beta = 0) is the worst case, the longest eclipse.
  How beta changes through the year is not modelled yet (step 3).
- **Ground speed** ignores Earth's rotation (the ground moves at up to 0.47 km/s at
  the equator, about 7% of the result in low orbit).
- **Sun-synchronous inclination** uses the first-order J2 formula. It gives 98.21
  degrees at 705 km (Landsat 9 publishes 98.2) and 98.54 at 786 km (Sentinel-2
  publishes 98.62). A unit test holds every sun-synchronous orbit in `/content` to
  within 0.1 degree of the formula.
- **Hohmann transfer** assumes two instant burns between circular orbits in the same
  plane. This does not describe a low-thrust electric thruster such as
  `thruster-enpulsion-nano`, which spirals slowly. A low-thrust transfer is not
  modelled yet.

### Propulsion

- **Ideal rocket equation**: constant specific impulse, no losses.

### Power

- **Solar array output** = power when new and facing the Sun x sunlight strength x
  cosine of the Sun angle x yearly fade. No temperature effect, no shadowing by the
  spacecraft's own body.
- **Orbit-average power** assumes zero generation in eclipse and steady output in
  sunlight.
- **Battery sizing** uses one load for the whole eclipse and a single efficiency.
- The yearly fade, allowed depth of discharge and battery efficiency are chosen in
  section 6.

### Communications

- **Link budget** counts free-space loss plus one lumped figure for all other losses.
  No rain or air model, no Doppler shift.
- **Slant range** is taken on a spherical Earth.
- Station G/T and antenna gains come from `/content`. The required Eb/N0, margin
  and minimum elevation are chosen in section 6.

### Ground-station contact and coverage

- **Contact fraction is a long-run average**, our own derivation from spherical
  geometry (the comment in `coverage.ts` gives it in full). It assumes the ground
  track does not repeat exactly, so the station sees the orbit from every longitude
  over time. It does not give the time or length of any single pass. Checked against
  two cases with exact answers (equatorial orbit with an equatorial station; polar
  orbit with a station at the pole).
- **Longest pass** ignores Earth's rotation during the pass.
- **Several stations** are not combined yet; overlapping views would be counted twice.
- **Pixel size and strip width grow in proportion to altitude** (flat ground under the
  camera, camera looking straight down).
- **Revisit time** = equator length / strip width x orbital period. One imaging pass
  per orbit (the sunlit half), strips side by side with no overlap, no pointing to the
  side, no cloud. For Landsat 9 (705 km, 185 km strip) this gives 14.9 days; the real
  cycle is 16 days because neighbouring strips overlap.

### Thermal

- **Equilibrium temperature** treats the spacecraft as a sphere at one temperature,
  always in sunlight and heated only by the Sun. Heat from Earth, sunlight reflected
  by Earth and heat from the electronics are left out of the sphere formula. The
  general function takes any absorbed power, so they can be added later.
- **Check values.** NASA's fact sheet for Mars is reproduced (209.8 K). For Earth the
  fact sheet's own sunlight and albedo give 255.1 K, while the sheet prints 254.0 K;
  the test allows 1.5 K.
- **Radiation dose class** by orbit is not modelled yet.

### Drag and lifetime

- **Model.** The density and decay equations of "Satellite Orbital Decay
  Calculations" (IPS Radio and Space Services, Australian Space Weather Agency). The
  paper says even the best predictions are good to about 10% of the remaining
  lifetime.
- **Altitude range.** The density fit is stated for 180 to 500 km. `landsat-705` and
  `sentinel2-786` are above it. There the model is extrapolated and the result is
  flagged `extrapolated`. Above 500 km the game should only use it to say "longer than
  the mission", never to quote a lifetime. Above 1000 km the function refuses to run.
- **Constant space weather** (solar radio flux F10.7 and geomagnetic index Ap) for the
  whole mission. The values are chosen in section 6.
- **Effective area** = cross-section x drag coefficient, both constant. The paper
  suggests a drag coefficient of about 2. The spacecraft's cross-section is defined
  in section 6.
- **Re-entry** is declared at 180 km, as in the paper.
- **Difference from the paper's printed example.** The paper prints re-entry after
  45.7 days for its example (100 kg, 1 m2, 300 km). Its program takes the cube root
  as `^ .33333`, which lowers the orbit by about 1 km on the first step. Re-running
  the listing reproduces 45.7 days exactly; with an exact cube root the same equations
  give 47.1 days. The game uses the exact cube root.

### Not in the physics module yet

- Position along the orbit over time (Kepler propagation) belongs to `/lib/orbit`,
  build step 4.

## 6. Simulation, checks and scoring

The code lives in `client/src/lib/sim`. Engineering parameters and game-design
settings are in `parameters.ts`, each with its source in a comment.

### Engineering parameters

| Parameter | Value | Basis | Approximation |
| --- | --- | --- | --- |
| Lowest elevation used at a station | 10 degrees | Near Earth Network Users' Guide, section 17.5: X-band quality is not guaranteed below 10 degrees | Applied to every band and station |
| Required Eb/N0 | 9.6 dB | Uncoded BPSK or QPSK at a bit error rate of 1e-5, from the standard formula; checked by a unit test | No error-correcting code, which is conservative. Real radios use coding |
| Solar array fade | 1.03% a year | Lohmeyer et al. 2018: 0.44% to 1.03% a year measured on geostationary satellites | Top of the range. Geostationary data applied to low Earth orbit |
| Allowed depth of discharge | 40% | Knap, Vestergaard and Stroe 2020, Table 6: 10% to 40% in low Earth orbit | Top of the range. Battery wear over time is not modelled |
| Battery round-trip efficiency | 90% | NASA Small Spacecraft State of the Art report 2022, Table 3-6: 75% to 90% for lithium-ion | Top of the range |
| Solar radio flux F10.7, index Ap | 125 sfu, 13 | Long-run means of the GFZ Potsdam daily index file (124.9 and 13.3) | Held constant. The real values swing with the 11-year solar cycle, and so does drag |
| Drag coefficient | 2 | Suggested by the IPS orbital decay paper | Constant |
| Land share of Earth's surface | 29.2% | 148.94 million km2 over the sphere's area | |

### Time stepping

- **One step is one day.** Every quantity is an average over the day's orbits. Single
  eclipses and passes are not stepped; their effect is in the averages.
- **The orbit figures are fixed at the starting altitude** (period, eclipse, pass
  length, ground speed). Only drag follows the falling altitude.
- **Planned lifetime** is the scenario's years x 365.25, rounded to whole days.
- **Eclipse** is the worst case for every orbit: the Sun in the orbit plane.

### Mass, structure and cost

- **Mass** is the sum of the parts plus each radio's antenna. It stays constant;
  used propellant is not subtracted.
- **No structural margin.** The CubeSat mass limit is the frame maker's figure.
- **Fit** is checked by form factor and by instrument volume in units only. The 3D
  fit inside the fairing comes with the builder (build step 5).
- **Cost** = parts + launch + ground passes for the whole planned life. Development,
  staff and operations are not costed. Passes are paid for even if the mission ends
  early.

### Power

- **With attitude control** the array faces the Sun to within the pointing accuracy.
- **Without it** the spacecraft tumbles and a flat array catches 1/4 of full sunlight
  on average (the mean of the cosine over all directions, counting only the lit side).
- **Loads.** Computer, attitude control and standby draws are always on. Cameras
  draw extra only while imaging, radios only while sending, and the thruster only
  while firing in sunlight.
- **Load shedding.** If the array cannot carry everything, imaging is cut first, then
  sending, then the thruster. If it cannot carry the always-on parts, the mission
  ends that day. Real spacecraft can often recover from a power loss; the game's
  cannot.
- **Battery.** It must carry the always-on parts through one eclipse. If one full
  pass of sending in eclipse would go past the allowed depth, the radio only sends
  in sunlight, which cuts the sending time by the eclipse share.
- **No battery, or one too small for the eclipse**, ends the mission in the first
  eclipse.

### Communications and data

- **Link rate** is worked out at the lowest elevation, where the signal is weakest,
  and used for the whole pass. The rate is the lower of that and the radio's limit.
- **One radio per station**: the fastest one the station can hear.
- **Average pass** = pi/4 of the overhead pass (the mean chord of a circle).
- **Passes on offer** = long-run contact share of the day / average pass. Booking
  more gives no more.
- **Several stations** are added up. Overlapping views are not removed.
- **The radio sends for the whole of every booked pass.**
- **Commands.** Taking pictures needs a command link: a two-way radio that a booked
  station hears. Without one the cameras stay off. Real spacecraft can run stored
  schedules for a while; the game does not model that.
- **Camera data rate** scales with ground speed over pixel size, from the maker's
  figure at 500 km. Data is uncompressed.
- **Storage** is the computer's plus the cameras' own. Data that does not fit is lost,
  oldest and newest alike.

### Science return

- **Imaging time** is set by the player, up to the time spent over sunlit land. That
  is taken as half the day x the land share. Land is treated as spread evenly, and
  clouds, seasons and polar night are ignored.
- **Revisit time** is the larger of two limits: the days for neighbouring ground
  tracks to close up at the equator with the camera's swath, and the days to image
  all land once with the pictures that reached the ground. No overlap between strips
  and no off-nadir pointing.
- **Resolution** is the camera's pixel size scaled by altitude, straight down.
- **Requirements are judged on one camera**: the one that serves the objective best.
- **Pointing accuracy** only affects the Sun angle of the array. Its effect on image
  quality is not modelled, so the precise attitude unit has no science advantage yet.

### Drag and lifetime

- **Cross-section** is the average shadow of a tumbling body: a quarter of the frame's
  surface area (Cauchy's formula) plus half the deployed panel area. The same value is
  used when the spacecraft is pointed.
- **Thruster.** It fires only in sunlight and cancels as much of the drag as its
  thrust, power and propellant allow. It needs attitude control to aim.
- **Above 500 km** the density model is extrapolated (see section 5).

### Random events

- **Chance.** Each event has a chance per year, turned into a chance per day and
  multiplied by the difficulty factor.
- **Launch failure** chance = 1 - successes / attempts from the launcher's published
  record. Off at Concept level.
- **Effects** available: station outage, safe mode, permanent array damage. The
  events themselves, and what mitigates them, are content for build step 8. The
  tests use labelled fixtures, not real figures.
- **The random sequence does not depend on the design**, so two designs with the same
  seed meet the same events.

### Not modelled yet

- Thermal balance and radiation dose (level 2 and above).
- Battery wear and component failure rates.
- Development time.
- Land coverage by latitude, and stations seen through a real pass schedule.
