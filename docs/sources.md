# Sources

Every data, texture and model source used by the game, with its licence where one
applies. Each content entry in `/content` also carries its own `source` and
`retrieved` fields; this page is the overview and the citation list for the project
submission.

All sources below were read on 2026-11-15 unless noted.

## NASA resources (must be cited in the submission)

| Resource | Used for |
| --- | --- |
| [International Space Station FAQ](https://www.nasa.gov/international-space-station-frequently-asked-questions/) | `iss-like` orbit: inclination 51.6 degrees, altitude 370 to 460 km |
| [International Space Station reference](https://www.nasa.gov/reference/international-space-station/) | Cross-check of the same figures |
| [Landsat 9 mission page](https://science.nasa.gov/mission/landsat-9) | `landsat-705` orbit (705 km, 98.2 degrees, 10:12 crossing, 16-day repeat); 30 m pixels and 185 km strip width for the scenario and the real-mission fact; check case for the revisit formula |
| [Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html), D. R. Williams, NSSDCA, updated 15 Nov 2024 | Physics constants: equatorial and mean radius, J2, solar irradiance, sidereal rotation period, tropical year, obliquity. Check case: black-body temperature and Bond albedo |
| [Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html), D. R. Williams, NSSDCA, updated 19 May 2025 | Check cases for the physics tests: solar irradiance at Mars, black-body temperature, Bond albedo, distance from the Sun |
| [Near Earth Network (NEN) Users' Guide](https://explorers.larc.nasa.gov/2021APMIDEX/pdf_files/453-UG-002905.pdf), 453-NENUG Revision 4, NASA Goddard | Ground stations: sites, coordinates, bands and G/T; the 10 degree lowest elevation (section 17.5) |
| [SCaN Mission Operations and Communications Services (MOCS)](https://soma.larc.nasa.gov/simplex/pdf_files/SCaN-MOCS-0001_Rev-1.pdf), SCaN-MOCS-0001 Revision 1, Table 5-2 | Ground-station price per pass (US$491, 2018) |
| NASA Small Spacecraft Technology State of the Art report 2022, power chapter, Table 3-6 | Lithium-ion battery efficiency |
| [Astrodynamic Parameters](https://ssd.jpl.nasa.gov/astro_par.html), JPL Solar System Dynamics | Physics constants: Earth's GM (DE440), the astronomical unit, the length of the day |

Design references named in CLAUDE.md (methods, not data):

- Design and Develop Science Missions (NASA SmallSat Institute webinar)
- Concept Maturity Levels (JPL)
- Mission Design Lab (NASA Goddard)
- [Webb "Build It Yourself" game](https://science.nasa.gov/mission/webb/game-build-it-yourself/)
- [NASA mission-viz](https://nasa.github.io/mission-viz/)
- CubeSat 101 (NASA CubeSat Launch Initiative)

## Other space agencies

| Resource | Used for |
| --- | --- |
| [Copernicus SentiWiki, Sentinel-2 mission](https://sentiwiki.copernicus.eu/web/s2-mission) | `sentinel2-786` orbit: 786 km, 98.62 degrees, 10:30 crossing |

## Launch vehicles

| Resource | Used for |
| --- | --- |
| [Electron Payload User Guide v7.0](https://rocketlabcorp.com/assets/Electron-Payload-User-Guide-7.0-v6.pdf), Rocket Lab, 1 Nov 2022 | `electron`: capacity (stated and chart on page 35), fairing, size |
| [Alpha Payload User's Guide v5.3](https://fireflyspace.com/wp-content/uploads/2026/09/Alpha-PUG-5.3-1.pdf), Firefly Aerospace, Sept 2026 | `firefly-alpha`: capacity (stated and charts), fairing, size |
| [Rideshare Payload User's Guide v11](https://storage.googleapis.com/rideshare-static/Rideshare_Payload_Users_Guide.pdf), SpaceX | `falcon9-rideshare`: programme rules, load table |
| [SpaceX rideshare pricing as of February 2026](https://newspaceeconomy.ca/2026/02/27/spacex-rideshare-pricing-as-of-february-2026-what-it-costs-whats-included-and-how-buyers-budget-a-mission/), New Space Economy | `falcon9-rideshare`: price (secondary source) |
| [Rocket Lab Electron](https://en.wikipedia.org/wiki/Rocket_Lab_Electron), Wikipedia (CC BY-SA 4.0) | `electron`: launch record, price |
| [Firefly Alpha](https://en.wikipedia.org/wiki/Firefly_Alpha), Wikipedia (CC BY-SA 4.0) | `firefly-alpha`: launch record, price |
| [Falcon 9](https://en.wikipedia.org/wiki/Falcon_9), Wikipedia (CC BY-SA 4.0) | `falcon9-rideshare`: launch record, fairing size |

## Instruments

| Resource | Used for |
| --- | --- |
| [Dragonfly Aerospace, Gecko](https://dragonflyaerospace.com/products/gecko/) | `imager-gecko` |
| [Simera Sense, MultiScape50](https://simera-sense.com/products/multiscape50/) | `imager-multiscape50` |
| [Simera Sense, MultiScape100](https://simera-sense.com/products/multiscape100/) | `imager-multiscape100` |
| satcatalog.com, XCAM C3D CubeSat camera (average cost, FY2022) | Price comparison for `imager-gecko` |

## Spacecraft components

| Resource | Used for |
| --- | --- |
| [satcatalog, 3-Unit CubeSat structure](https://www.satcatalog.com/component/3-unit-cubesat-structure/) | `structure-3u-isispace` |
| [satcatalog, 6-Unit CubeSat structure](https://www.satcatalog.com/component/6-unit-cubesat-structure/) | `structure-6u-isispace` |
| [satsearch, EnduroSat 3U solar panel](https://satsearch.co/products/endurosat-3u-cubesat-solar-panel) | `solar-panel-3u-endurosat` |
| [satsearch, EnduroSat 3U deployable solar array](https://satsearch.co/products/endurosat-3u-deployable-solar-array) | `solar-deployable-3u-endurosat` |
| [satsearch, EnduroSat 6U deployable solar array](https://satsearch.co/products/endurosat-6u-deployable-solar-array) | `solar-deployable-6u-endurosat` |
| [satsearch, OrbAstro 36Wh EPS](https://satsearch.co/products/orbastro-36wh-eps) | `battery-36wh-orbastro`; price basis for `battery-99wh-endurosat` |
| [satsearch, EnduroSat EPS](https://satsearch.co/products/endurosat-eps-i-electrical-power-system) | `battery-99wh-endurosat` |
| [EnduroSat, UHF Transceiver II](https://www.endurosat.com/products/uhf-transceiver-ii/) and [satsearch listing](https://satsearch.co/products/endurosat-uhf-transceiver-ii) | `radio-uhf-endurosat` |
| [satsearch, EnduroSat S-band transceiver](https://satsearch.co/products/endurosat-s-band-receiver) | `radio-sband-endurosat` |
| [EnduroSat, X-Band Transmitter](https://endurosat.com/products/x-band-transmitter/) and [satsearch listing](https://satsearch.co/products/endurosat-x-band-transmitter) | `radio-xband-endurosat` |
| [EnduroSat, Onboard Computer](https://www.endurosat.com/products/onboard-computer/) and [satsearch listing](https://satsearch.co/products/endurosat-onboard-computer) | `computer-endurosat-obc` |
| [satsearch, Tensor Tech ADCS-MTQ](https://satsearch.co/products/tensortech-adcs-mtq-integrated-attitude-determination-and-control-system-with-magnetorquers) | `adcs-tensortech-mtq` |
| [satsearch, arcsec Arcus ADCS](https://satsearch.co/products/arcsec-arcus-adcs) | `adcs-arcsec-arcus` |
| satsearch.co, Space Inventor WHL-100 reaction wheel (list price) | Price comparison for `adcs-arcsec-arcus` |
| [satsearch, ENPULSION NANO](https://satsearch.co/products/enpulsion-enpulsion-nano) | `thruster-enpulsion-nano` |

## Physics model

Constants from NASA and JPL are listed under NASA resources above.

| Resource | Used for |
| --- | --- |
| [CODATA 2022 recommended values](https://physics.nist.gov/cuu/Constants/Table/allascii.txt), NIST | Speed of light, Boltzmann constant, Stefan-Boltzmann constant, standard gravity |
| [Satellite Orbital Decay Calculations](https://www.sws.bom.gov.au/Category/Educational/Space%20Weather/Space%20Weather%20Effects/SatelliteOrbitalDecayCalculations.pdf), IPS Radio and Space Services, The Australian Space Weather Agency | Air density model, drag decay equation and the worked example used as a test |
| [Hohmann transfer orbit](https://en.wikipedia.org/wiki/Hohmann_transfer_orbit), Wikipedia (CC BY-SA 4.0) | Worked example (low orbit to geostationary) used as a test for the speed and transfer functions |
| [Free-space path loss](https://en.wikipedia.org/wiki/Free-space_path_loss), Wikipedia (CC BY-SA 4.0) | Engineering form of the path-loss formula used as a test |
| D. A. Vallado, *Fundamentals of Astrodynamics and Applications* | Standard reference for J2 nodal precession, sun-synchronous orbits and the Hohmann transfer |
| J. R. Wertz, D. F. Everett, J. J. Puschell (eds.), *Space Mission Engineering: The New SMAD* | Standard reference for eclipse duration, solar array and battery sizing, the link equation, Earth coverage geometry and thermal balance |
| H. D. Curtis, *Orbital Mechanics for Engineering Students* | Standard reference for Kepler's third law, the vis-viva equation and the rocket equation |

| [Phase-shift keying](https://en.wikipedia.org/wiki/Phase-shift_keying), Wikipedia (CC BY-SA 4.0) | Bit error rate formula for BPSK and QPSK, giving the required Eb/N0 of 9.6 dB |
| W. Lohmeyer et al., "Solar array degradation of geostationary communications satellites", Int. J. Space Science and Engineering 5(1), 2018, DOI 10.1504/IJSPACESE.2018.090549 | Yearly solar array fade |
| V. Knap, L. K. Vestergaard, D.-I. Stroe, Energies 13, 4097 (2020), Table 6 | Battery depth of discharge in low Earth orbit |
| J. Matzka et al., "The geomagnetic Kp index and derived indices of geomagnetic activity", Space Weather 2021, [DOI 10.1029/2020SW002641](https://doi.org/10.1029/2020SW002641); GFZ Potsdam daily index file (CC BY 4.0) | Long-run mean F10.7 and Ap for the drag model |
| [Mulberry32](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c), T. Ettinger; JavaScript form from [bryc/code](https://github.com/bryc/code/blob/master/jshash/PRNGs.md) (public domain) | Seeded random number generator |
| [Computing Greenwich Apparent Sidereal Time](https://aa.usno.navy.mil/faq/GAST), US Naval Observatory | Greenwich mean sidereal time, which turns Earth beneath the orbit in the orbit view |
| *The Astronomical Almanac*, low-precision formulas for the Sun (page C24), as cited in `client/src/lib/orbit/frames.ts` | Direction of the Sun for the date: day and night on the globe, the day-night line on the flat map, the Sun-synchronous orbit plane |

The three textbooks are cited by title and topic. Page and equation numbers were not
checked against a printed copy; each formula is instead checked by a unit test against
a published figure or a hand calculation.

## Other figures

| Resource | Used for |
| --- | --- |
| [Earth](https://en.wikipedia.org/wiki/Earth), Wikipedia (CC BY-SA 4.0) | Land area (148,940,000 km2) and equatorial circumference (40,075.017 km), used to derive the scenario's data threshold |
| [Frankfurter](https://api.frankfurter.dev/v1/latest?from=GBP&to=USD), European Central Bank reference rates | GBP to USD rate of 1.3227 on 13 Nov 2026, for prices listed in pounds |

## Textures and 3D models

Each asset added to the client must be listed here with its source and licence. Do
not use NASA logos.

| File | What it is | Source | Licence |
| --- | --- | --- | --- |
| `client/static/textures/earth-day-2048.webp` (2048 x 1024) | Earth by day, equirectangular. Shown first, and on the flat map. | **Not recorded. To be confirmed by the team.** | **To be confirmed** |
| `client/static/textures/earth-day-4096.webp` (4096 x 2048) | The same picture, larger. Loaded on big screens. | **Not recorded. To be confirmed by the team.** | **To be confirmed** |

The two Earth textures were added without a note of where they came from, and the
files carry no source information. They must not ship in the submission until the
original image (for example a named NASA Blue Marble image) and its licence are
written here.

No 3D model files are used. The spacecraft is drawn from simple shapes sized from
`/content` (see `docs/model-assumptions.md`, section 7).

## Software

| Library | Used for | Licence |
| --- | --- | --- |
| [three.js](https://threejs.org/) 0.187 | The 3D orbit view and spacecraft builder | MIT |
