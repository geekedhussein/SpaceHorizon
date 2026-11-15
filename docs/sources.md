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
| [Landsat 9 mission page](https://science.nasa.gov/mission/landsat-9) | `landsat-705` orbit (705 km, 98.2 degrees, 10:12 crossing, 16-day repeat); 30 m pixels and 185 km strip width for the scenario and the real-mission fact |

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

## Other figures

| Resource | Used for |
| --- | --- |
| [Earth](https://en.wikipedia.org/wiki/Earth), Wikipedia (CC BY-SA 4.0) | Land area (148,940,000 km2) and equatorial circumference (40,075.017 km), used to derive the scenario's data threshold |
| [Frankfurter](https://api.frankfurter.dev/v1/latest?from=GBP&to=USD), European Central Bank reference rates | GBP to USD rate of 1.3227 on 13 Nov 2026, for prices listed in pounds |

## Textures and 3D models

None yet. Each asset added to the client must be listed here with its source and
licence. Do not use NASA logos.
