// User-facing text, English. All strings live in this folder so the game can be
// translated: add a file per language with the same keys.
//
// Rules: plain language, short sentences, and factually correct. Simplify the
// wording, never the facts.

export interface Tooltip {
  title: string
  text: string
}

/**
 * One plain-language explanation for each equation in /lib/physics. The keys
 * name the concept; the comment gives the function it explains.
 */
export const physicsTooltips = {
  // orbit.ts: orbitalPeriodS
  orbitalPeriod: {
    title: 'Orbital period',
    text: 'The time for one trip around Earth. Higher orbits are bigger and slower, so one trip takes longer. At 400 km it takes about 92 minutes.',
  },
  // orbit.ts: visVivaSpeedMS, circularSpeedMS
  orbitalSpeed: {
    title: 'Orbital speed',
    text: 'How fast the spacecraft must fly to stay in orbit. Gravity is stronger close to Earth, so low orbits need more speed: about 7.7 km every second at 400 km.',
  },
  // orbit.ts: eclipseFraction, eclipseDurationS
  eclipse: {
    title: 'Eclipse',
    text: 'The part of each orbit spent in Earth\'s shadow. Solar panels make no power there, so the battery must run everything. In a low orbit this can be over a third of every orbit.',
  },
  // orbit.ts: nodalPrecessionRadS
  nodalPrecession: {
    title: 'Orbit drift',
    text: 'Earth bulges a little at the equator. The extra pull slowly turns the orbit around Earth, by up to several degrees a day in low orbits.',
  },
  // orbit.ts: sunSynchronousInclinationRad
  sunSynchronous: {
    title: 'Sun-synchronous orbit',
    text: 'An orbit tilted just enough that its slow drift keeps pace with the Sun through the year. The spacecraft then passes over each place at the same local time, so the lighting matches from one picture to the next.',
  },
  // orbit.ts: hohmannTransfer
  hohmannTransfer: {
    title: 'Changing orbit',
    text: 'To move between two circular orbits, the engine fires twice. The first burn starts a half-ellipse towards the new height. The second burn makes the orbit circular again. This is the cheapest two-burn route.',
  },
  // propulsion.ts: rocketDeltaVMS, propellantMassKg
  rocketEquation: {
    title: 'Rocket equation',
    text: 'How much a spacecraft can change its speed depends on two things: how efficient the engine is, and how much of the spacecraft is propellant. Each extra bit of speed costs more propellant than the last.',
  },
  // power.ts: solarFluxWM2
  solarFlux: {
    title: 'Sunlight strength',
    text: 'Near Earth, sunlight carries about 1361 watts on every square metre. Twice as far from the Sun it is four times weaker.',
  },
  // power.ts: solarArrayPowerW, orbitAveragePowerW
  solarPower: {
    title: 'Solar power',
    text: 'A solar panel turns part of the sunlight that hits it into electricity. It makes the most power when it faces the Sun, less at an angle, and none in shadow. It also fades slowly with age.',
  },
  // power.ts: requiredBatteryCapacityWh, depthOfDischarge
  battery: {
    title: 'Battery',
    text: 'The battery powers the spacecraft in Earth\'s shadow. Draining a battery deeply on every orbit wears it out fast, so designers use only part of its capacity.',
  },
  // link.ts: slantRangeM, freeSpacePathLossDb
  pathLoss: {
    title: 'Signal loss with distance',
    text: 'A radio signal spreads out as it travels, so less of it reaches the antenna. Doubling the distance leaves a quarter of the signal. The spacecraft is furthest away when it is low on the horizon.',
  },
  // link.ts: dishAntennaGainDb, eirpDbw
  antennaGain: {
    title: 'Antenna gain',
    text: 'A dish focuses radio power into a narrow beam, like a torch reflector. A bigger dish, or a higher frequency, gives a tighter and stronger beam. It must also be pointed more carefully.',
  },
  // link.ts: carrierToNoiseDensityDbHz, achievableDataRateBps, linkMarginDb
  linkBudget: {
    title: 'Link budget',
    text: 'A tally of everything that strengthens or weakens the radio signal on its way to the ground. A stronger signal compared with the background noise can carry more data each second.',
  },
  // coverage.ts: earthCentralAngleRad, maxPassDurationS, stationContactFraction
  contactTime: {
    title: 'Contact time',
    text: 'A ground station can only talk to the spacecraft while it is above the horizon. In low orbit each pass lasts a few minutes. Stations near the poles see a polar-orbiting spacecraft on almost every orbit.',
  },
  // coverage.ts: groundSampleDistanceM, swathWidthM
  groundResolution: {
    title: 'Ground resolution',
    text: 'The size on the ground of one pixel in the picture. From higher up, the same camera sees a wider strip, but each pixel covers more ground, so the picture is less sharp.',
  },
  // coverage.ts: equatorialRevisitTimeS
  revisitTime: {
    title: 'Revisit time',
    text: 'How long it takes to image the whole Earth once. Each orbit adds one strip of pictures. A wider strip covers the globe in fewer orbits.',
  },
  // thermal.ts: equilibriumTemperatureK, sphereEquilibriumTemperatureK
  equilibriumTemperature: {
    title: 'Temperature balance',
    text: 'In space, heat only leaves as infrared glow. The spacecraft settles at the temperature where the heat it glows away equals the heat it takes in. Surface coatings shift that balance.',
  },
  // drag.ts: atmosphericDensityKgM3, orbitDecay
  dragDecay: {
    title: 'Drag and orbit decay',
    text: 'Even hundreds of kilometres up there is a trace of air. It slows the spacecraft, so the orbit sinks, and the sinking speeds up as the air gets thicker. An active Sun puffs up the air and makes this faster.',
  },
} satisfies Record<string, Tooltip>

export type PhysicsTooltipId = keyof typeof physicsTooltips
