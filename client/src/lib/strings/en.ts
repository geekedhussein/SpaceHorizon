// User-facing text, English. All strings live in this folder so the game can be
// translated: add a file per language with the same keys.
//
// Rules: plain language, short sentences, and factually correct. Simplify the
// wording, never the facts.

import type { Cause, CauseId, CheckId, ConstraintCheck, TextValues } from '../sim/types.ts'

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

// ------------------------------------------------- checks and explanations ---

/**
 * Fill the {placeholders} in a template. Numbers are written with at most one
 * decimal (two significant digits below 1), in the reader's number format.
 */
export function fillTemplate(template: string, values: TextValues, locale = 'en'): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    const value = values[key]
    if (value === undefined) return placeholder
    if (typeof value === 'string') return value
    const options =
      Math.abs(value) < 1 ? { maximumSignificantDigits: 2 } : { maximumFractionDigits: 1 }
    return new Intl.NumberFormat(locale, options).format(value)
  })
}

/** Names for the choices a design cannot launch without. */
export const slotNames: Record<string, string> = {
  orbit: 'an orbit',
  launcher: 'a launcher',
  structure: 'a structure',
  computer: 'a computer',
}

export interface CheckText {
  title: string
  /** Shown when the check passes. */
  ok: string
  /** Shown when the check is a risk or blocks the launch. */
  problem: string
  /** What to change. */
  fix: string
}

/** One entry per pre-launch check in /lib/sim/constraints.ts. */
export const checkTexts = {
  design_incomplete: {
    title: 'Design complete',
    ok: 'The orbit, launcher, structure and computer are all chosen.',
    problem: 'The design still needs {missing}.',
    fix: 'Choose each missing item before launch.',
  },
  unknown_part: {
    title: 'Known parts',
    ok: 'Every part is in the catalogue.',
    problem: 'These parts are not in the catalogue: {ids}.',
    fix: 'Remove them and choose parts from the list.',
  },
  orbit_not_served: {
    title: 'Launcher reaches the orbit',
    ok: '{launcher} flies to this orbit.',
    problem: '{launcher} does not fly to this orbit.',
    fix: 'Choose another launcher or another orbit.',
  },
  launch_mass: {
    title: 'Launch mass',
    ok: 'The spacecraft weighs {massKg} kg. With a {marginPercent}% margin it needs {neededKg} kg. {launcher} can carry {capacityKg} kg to this orbit.',
    problem: 'The spacecraft weighs {massKg} kg. With a {marginPercent}% margin it needs {neededKg} kg. {launcher} can only carry {capacityKg} kg to this orbit.',
    fix: 'Remove mass, choose a lower orbit, or choose a bigger launcher.',
  },
  cubesat_mass: {
    title: 'Structure mass limit',
    ok: 'The spacecraft weighs {massKg} kg. The {structure} may weigh up to {limitKg} kg.',
    problem: 'The spacecraft weighs {massKg} kg. The {structure} may only weigh {limitKg} kg.',
    fix: 'Use lighter parts or a larger structure.',
  },
  part_fit: {
    title: 'Parts fit the structure',
    ok: 'Every part fits the {structure}.',
    problem: 'These parts are not made for the {structure}: {parts}.',
    fix: 'Swap them, or choose the structure size they are made for.',
  },
  instrument_volume: {
    title: 'Room for instruments',
    ok: 'The instruments fill {usedU} of the {sizeU} units of space.',
    problem: 'The instruments need {usedU} units of space. The structure only has {sizeU}.',
    fix: 'Carry fewer instruments or choose a larger structure.',
  },
  budget: {
    title: 'Budget',
    ok: 'The mission costs ${costMusd} million. The budget is ${budgetMusd} million.',
    problem: 'The mission costs ${costMusd} million. The budget is only ${budgetMusd} million.',
    fix: 'Look at the biggest costs first: the launch and the ground station passes.',
  },
  solar_array: {
    title: 'Solar array',
    ok: 'A solar array is fitted.',
    problem: 'There is no solar array, so nothing makes power.',
    fix: 'Add a solar array.',
  },
  battery: {
    title: 'Battery',
    ok: 'A battery is fitted.',
    problem: 'There is no battery. The spacecraft will lose power in Earth\'s shadow on every orbit.',
    fix: 'Add a battery.',
  },
  radio: {
    title: 'Radio',
    ok: 'A radio is fitted.',
    problem: 'There is no radio, so no data can reach the ground.',
    fix: 'Add a radio.',
  },
  pointing: {
    title: 'Attitude control',
    ok: 'The spacecraft can control which way it points.',
    problem: 'Nothing controls which way the spacecraft points, so it tumbles. It cannot aim a camera or a thruster. Its solar array catches a quarter of the sunlight.',
    fix: 'Add an attitude control system.',
  },
  instrument: {
    title: 'Instrument for the objective',
    ok: 'An instrument on board can serve the objective.',
    problem: 'No instrument on board can serve the objective.',
    fix: 'Add an instrument that is not greyed out for this objective.',
  },
  ground_station: {
    title: 'Ground station',
    ok: 'At least one ground station is booked.',
    problem: 'No ground station is booked, so nobody is listening for the data.',
    fix: 'Book passes at a ground station.',
  },
  station_link: {
    title: 'Stations can hear the radio',
    ok: 'Every booked station can hear a radio on board.',
    problem: 'These stations cannot hear any radio on board: {stations}. They listen on other frequencies.',
    fix: 'Choose a radio in a band the station receives, or another station.',
  },
  station_passes: {
    title: 'Passes available',
    ok: 'The orbit gives enough passes over each booked station.',
    problem: 'You booked {requested} passes a day at {station}. This orbit only gives about {available}.',
    fix: 'Book fewer passes there, add a station, or change the orbit.',
  },
  command_link: {
    title: 'Command link',
    ok: 'The team can send commands to the spacecraft.',
    problem: 'No booked station can send commands to the spacecraft. Without commands it takes no pictures.',
    fix: 'Carry a two-way radio that a booked station can hear.',
  },
  power: {
    title: 'Power',
    ok: 'At the end of the mission the solar array still makes {availableW} W in sunlight. The plan needs {neededW} W.',
    problem: 'At the end of the mission the solar array makes {availableW} W in sunlight. The plan needs {neededW} W plus a {marginPercent}% margin.',
    fix: 'Use a bigger solar array, image for fewer minutes, or book fewer passes.',
  },
  battery_depth: {
    title: 'Battery depth of discharge',
    ok: 'Each {eclipseMinutes}-minute eclipse uses {depthPercent}% of the battery. The safe limit is {allowedPercent}%.',
    problem: 'Each {eclipseMinutes}-minute eclipse uses {depthPercent}% of the battery. The safe limit is {allowedPercent}%.',
    fix: 'Use a bigger battery.',
  },
  data_downlink: {
    title: 'Data downlink',
    ok: 'The plan makes {generatedGb} GB a day. The booked passes can carry {capacityGb} GB a day.',
    problem: 'The plan makes {generatedGb} GB a day. The booked passes can only carry {capacityGb} GB a day.',
    fix: 'Book more passes, use a faster radio, or take fewer pictures.',
  },
  orbit_lifetime: {
    title: 'Orbit lifetime',
    ok: 'The orbit lasts the planned {plannedYears} years.',
    problem: 'Air drag will bring the spacecraft down after about {years} years. The plan is {plannedYears} years.',
    fix: 'Fly higher, add a thruster, or use a smaller solar array.',
  },
} satisfies Record<CheckId, CheckText>

export interface CauseText {
  /** What happened and why. */
  text: string
  /** What to change next time. Empty when nothing needs changing. */
  fix: string
}

/** One entry per explanation the simulation can give (see /lib/sim/simulate.ts). */
export const causeTexts = {
  not_launched: {
    text: 'The mission did not launch. Some pre-launch checks are blocked.',
    fix: 'Go back to the design and fix each blocked check.',
  },
  launch_failed: {
    text: 'The {launcher} rocket failed and the spacecraft was lost. This rocket has succeeded on {successes} of its {attempts} launches.',
    fix: 'Try again, or choose a launcher with a better record.',
  },
  reentered: {
    text: 'Air drag slowed the spacecraft a little on every orbit. From {altitudeKm} km it sank until it burned up on day {day}.',
    fix: 'Fly higher, add a thruster, or use a smaller solar array.',
  },
  power_lost_array: {
    text: 'On day {day} the solar array made {availableW} W in sunlight. The always-on parts needed {neededW} W, so the spacecraft shut down.',
    fix: 'Use a bigger solar array, and add attitude control so it faces the Sun.',
  },
  power_lost_battery: {
    text: 'Every orbit spends {eclipseMinutes} minutes in Earth\'s shadow. The always-on parts need {neededWh} Wh to get through it. The battery holds {capacityWh} Wh, so the spacecraft shut down.',
    fix: 'Use a bigger battery.',
  },
  power_shortage: {
    text: 'On {days} days the solar array could not power all the planned work. Over the mission the camera did {imagingPercent}% of its planned imaging.',
    fix: 'Use a bigger solar array, or plan less imaging.',
  },
  thruster_off: {
    text: 'From day {day} there was not enough power to run the thruster. Drag then pulled the orbit down.',
    fix: 'Use a bigger solar array so the thruster can keep firing.',
  },
  thruster_unpointed: {
    text: 'The thruster was never used. A tumbling spacecraft cannot aim its push.',
    fix: 'Add an attitude control system.',
  },
  propellant_empty: {
    text: 'The thruster ran out of propellant on day {day}. After that nothing held the orbit up.',
    fix: 'Fly higher, where there is less drag to cancel.',
  },
  no_downlink: {
    text: 'No data reached the ground. No booked ground station could hear a radio on the spacecraft.',
    fix: 'Carry a radio in a band that a booked station receives.',
  },
  no_instrument: {
    text: 'The spacecraft carried no instrument, so it made no science data.',
    fix: 'Add an instrument that serves the objective.',
  },
  instrument_unsuitable: {
    text: 'The {instrument} cannot serve this objective, so its data did not count.',
    fix: 'Choose an instrument that is not greyed out for this objective.',
  },
  no_pointing: {
    text: 'The spacecraft tumbled, so the camera never pointed steadily at the ground. It took no pictures.',
    fix: 'Add an attitude control system.',
  },
  no_command_link: {
    text: 'The team could not send commands to the spacecraft, so it took no pictures.',
    fix: 'Carry a two-way radio that a booked station can hear.',
  },
  data_lost: {
    text: 'The camera made more data than the radio could send. Storage filled up, and {lostGb} GB of pictures were thrown away. That is {percent}% of everything the camera made.',
    fix: 'Book more passes, use a faster radio, or take fewer pictures.',
  },
  eclipse_transmit_blocked: {
    text: 'Sending data in Earth\'s shadow would use {depthPercent}% of the battery. The safe limit is {allowedPercent}%, so the radio only sent in sunlight.',
    fix: 'Use a bigger battery to send data on every pass.',
  },
  resolution_missed: {
    text: 'From {altitudeKm} km, one pixel of the {instrument} covers {value} m of ground. The goal was {threshold} m or less.',
    fix: 'Fly lower, or choose a sharper camera.',
  },
  revisit_swath: {
    text: 'The {instrument} sees a strip {swathKm} km wide. Covering the whole Earth with strips that narrow takes {days} days. The goal was {threshold}.',
    fix: 'Choose a camera with a wider view.',
  },
  revisit_data: {
    text: 'Pictures from about {returnedMinutes} minutes of imaging a day reached the ground. Covering all land every {threshold} days needs {neededMinutes} minutes a day.',
    fix: 'Plan more imaging, and make sure the radio can send it all.',
  },
  data_downlink_limited: {
    text: 'About {value} GB of pictures a month reached the ground. The goal was {threshold} GB. The camera took more pictures than the radio could send.',
    fix: 'Book more passes or use a faster radio.',
  },
  data_imaging_limited: {
    text: 'About {value} GB of pictures a month reached the ground. The goal was {threshold} GB. The camera did not take enough pictures.',
    fix: 'Plan more minutes of imaging each day.',
  },
  event: {
    text: '{name}: first on day {day}. Times it happened during the mission: {count}.',
    fix: '',
  },
  all_requirements_met: {
    text: 'The mission met every requirement.',
    fix: '',
  },
} satisfies Record<CauseId, CauseText>

/** The words for one pre-launch check. */
export function describeCheck(check: ConstraintCheck, locale = 'en'): { title: string; text: string; fix: string } {
  const entry = checkTexts[check.id]
  const values = { ...check.values }
  if (typeof values.missing === 'string') {
    values.missing = values.missing
      .split(',')
      .map((slot) => slotNames[slot] ?? slot)
      .join(', ')
  }
  const problem = check.status !== 'ok'
  return {
    title: entry.title,
    text: fillTemplate(problem ? entry.problem : entry.ok, values, locale),
    fix: problem ? entry.fix : '',
  }
}

/** The words for one explanation in the mission report. */
export function describeCause(cause: Cause, locale = 'en'): CauseText {
  const entry = causeTexts[cause.id]
  return { text: fillTemplate(entry.text, cause.values, locale), fix: entry.fix }
}

// ----------------------------------------------------------- orbit view ---

/** Text for the 3D orbit view and its flat-map fallback. */
export const orbitViewText = {
  title: 'Orbit view',
  orbitLabel: 'Orbit',
  play: 'Play',
  pause: 'Pause',
  speedLabel: 'Speed',
  speedValue: '{factor}× real time',
  showLabels: 'Labels',
  showPath: 'Orbit path',
  showCones: 'Station coverage',
  view3d: '3D view',
  viewMap: 'Flat map',
  viewLabel: 'View',
  loading: 'Loading the 3D view…',
  webglMissing:
    'This device cannot show 3D graphics, so here is a flat map instead. Everything else works the same.',
  controlsHint: 'Drag to turn. Scroll or pinch to zoom. Arrow keys and the + and − keys also work.',
  sceneDescription:
    '3D view of Earth with the spacecraft moving along its orbit. The readout lists the same information as text.',
  mapDescription:
    'Flat map of Earth showing the path of the spacecraft over the ground, the ground stations, and the night side.',
  spacecraft: 'Spacecraft',
  spacecraftNotToScale: 'Spacecraft (not to scale)',
  sun: 'To the Sun (really 150 million km away)',
  sunOverhead: 'Sun overhead',
  readoutTitle: 'Right now',
  time: 'Date and time',
  height: 'Height',
  heightValue: '{km} km',
  period: 'One orbit takes',
  periodValue: '{minutes} minutes',
  below: 'Over',
  north: 'N',
  south: 'S',
  east: 'E',
  west: 'W',
  light: 'Light',
  inSunlight: 'In sunlight',
  inShadow: "In Earth's shadow",
  contact: 'Stations in contact',
  noContact: 'None',
  epochNote: 'The start date is a stand-in until the mission has a launch date.',
  scaleNote: 'Earth and the orbit are drawn to scale.',
} as const

// ------------------------------------------------------------ game screens ---

/** Whole numbers above 100, one decimal above 1, two significant digits below. */
export function formatNumber(value: number, locale = 'en'): string {
  const abs = Math.abs(value)
  const options =
    abs >= 100 ? { maximumFractionDigits: 0 } : abs >= 1 ? { maximumFractionDigits: 1 } : { maximumSignificantDigits: 2 }
  return new Intl.NumberFormat(locale, options).format(value)
}

/** Money held in millions of US dollars, written the way people say it. */
export function formatMoney(musd: number, locale = 'en'): string {
  if (Math.abs(musd) >= 1) return `$${formatNumber(musd, locale)} million`
  const dollars = Number((musd * 1e6).toPrecision(3))
  return `$${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(dollars)}`
}

/** Text for the six phases, the resource bars and the report. */
export const uiText = {
  appName: 'Space Horizon',
  skipToContent: 'Skip to the main panel',
  back: 'Back',
  next: 'Next',
  none: 'None',
  noneDescription: 'Fly without one.',
  notAvailable: 'Not available:',
  tierSimple: 'Simple',
  tierAdvanced: 'Advanced',
  chosen: 'Chosen',
  moreInfo: 'What is this?',
  estimated: 'Some figures for this item are estimates. See the About notes.',

  phases: {
    need: { name: 'Need', step: 'CML 1, the idea', title: 'What is the mission for?' },
    concept: { name: 'Concept', step: 'CML 2, feasibility', title: 'Choose the kind of mission' },
    requirements: { name: 'Requirements', step: 'CML 2', title: 'What the mission must achieve' },
    design: { name: 'Design', step: 'CML 3, trade space', title: 'Build the mission' },
    verify: { name: 'Verify', step: 'CML 4, point design', title: 'Check everything before launch' },
    operate: { name: 'Operate', step: 'Mission', title: 'Fly the mission' },
  },
  phaseNavLabel: 'Mission steps',
  phaseLocked: 'Launch the mission first.',

  stage: {
    label: 'Picture',
    spacecraft: 'Spacecraft',
    orbit: 'Orbit',
    exampleOrbit: 'Example orbit: {orbit}. You choose yours in the Concept step.',
  },

  resources: {
    title: 'Resources',
    status: { ok: 'OK', tight: 'Tight', over: 'Over', short: 'Too short', none: 'Not set' },
    of: 'of',
    mass: {
      name: 'Mass',
      unit: 'kg',
      caption: 'Spacecraft mass against the lower of the launcher limit and the structure limit.',
      empty: 'Choose a structure or a launcher.',
    },
    power: {
      name: 'Power',
      unit: 'W',
      caption: 'Power the plan needs in sunlight against what the solar array makes at the end of the mission.',
      empty: 'Choose an orbit.',
    },
    budget: {
      name: 'Budget',
      unit: '',
      caption: 'Cost of parts, launch and ground station passes against the budget.',
      empty: '',
    },
    data: {
      name: 'Data',
      unit: 'GB a day',
      caption: 'Data the instruments make each day against what the booked passes can carry.',
      empty: 'Choose an orbit.',
    },
    comms: {
      name: 'Comms',
      unit: 'passes a day',
      caption: 'Ground station passes booked against the passes this orbit offers.',
      empty: 'Book a ground station.',
    },
    time: {
      name: 'Time',
      unit: 'years',
      caption: 'How long the orbit lasts against the planned mission life.',
      empty: 'Choose an orbit and a structure.',
    },
  },

  need: {
    intro: 'Every mission starts with a need. Pick the mission you want to fly.',
    scenarioLabel: 'Mission',
    objective: 'Objective',
    budget: 'Budget',
    lifetime: 'Planned life',
    years: '{years} years',
    levelLabel: 'Study depth',
    levels: {
      concept: {
        name: 'Concept',
        text: 'Generous margins. Nothing goes wrong by chance. Best for a first mission.',
      },
      'trade-study': {
        name: 'Trade study',
        text: 'Needs 10% spare launch mass and power. The rocket can fail, as real rockets sometimes do.',
      },
      'point-design': {
        name: 'Point design',
        text: 'Needs 20% spare launch mass and power. Chance events are twice as likely.',
      },
    },
    levelLocked: 'Meet every requirement at Trade study level to unlock this.',
    sandbox: 'Sandbox: checks warn but do not stop the launch',
    physicsNote: 'The level changes the margins and the luck. It never changes the physics.',
  },

  concept: {
    intro: 'A mission has four parts. You will make choices in each one.',
    missionType: 'Mission type',
    missionTypes: { 'earth-observation': 'Earth observation: a camera in orbit looks down at the ground.' },
    segments: [
      { name: 'Launch', text: 'The rocket that carries the spacecraft to its orbit.' },
      { name: 'Space', text: 'The spacecraft: its frame, power, radio and instruments.' },
      { name: 'Ground', text: 'The dish antennas on Earth that receive the data.' },
      { name: 'User', text: 'The people who use the data. Their needs set the score.' },
    ],
    orbitLabel: 'Orbit',
    orbitIntro: 'The orbit sets what the camera sees, how long the spacecraft is in shadow, and how long it lasts.',
    altitude: 'Height {km} km',
    tilt: 'Tilt {deg}°',
    period: 'One orbit in {minutes} min',
    eclipse: 'Up to {minutes} min in shadow',
    pass: 'Passes up to {minutes} min',
  },

  requirements: {
    intro: 'Begin with the end in mind. The objective becomes numbers the mission must reach. The score mostly measures how well it reaches them.',
    how: 'Each one is checked when the mission flies. The Design step shows a forecast as you build.',
    goal: 'Goal',
    atMost: 'at most {threshold} {unit}',
    atLeast: 'at least {threshold} {unit}',
    met: 'Met',
    notMet: 'Not met',
    value: 'Result: {value} {unit}',
    noValue: 'Result: never achieved',
    margin: 'Margin: {percent}%',
    forecastTitle: 'Forecast',
    forecastNote: 'What the mission would return if nothing goes wrong by chance.',
  },

  design: {
    intro: 'Every choice costs mass, power and money. Watch the resource bars as you build.',
    tabsLabel: 'Mission parts',
    tabs: { space: 'Spacecraft', launch: 'Launch', ground: 'Ground' },
    slots: {
      structure: { name: 'Structure', text: 'The frame everything is bolted to. It sets the size and the mass limit.' },
      solarArray: { name: 'Solar array', text: 'Makes electricity from sunlight.' },
      battery: { name: 'Battery', text: 'Runs the spacecraft in Earth\'s shadow.' },
      computer: { name: 'Computer', text: 'Runs the spacecraft and stores data until it can be sent.' },
      attitudeControl: { name: 'Attitude control', text: 'Controls which way the spacecraft points.' },
      propulsion: { name: 'Propulsion', text: 'Optional. A thruster can push against air drag to keep the orbit up.' },
      radios: { name: 'Radios', text: 'Send data down and receive commands. You can carry more than one.' },
      instruments: { name: 'Instruments', text: 'The reason for the mission. You can carry more than one.' },
    },
    mass: '{kg} kg',
    powerMakes: 'Makes {w} W',
    powerUses: 'Uses {w} W',
    powerNone: 'Uses no power',
    madeFor: 'Made for {sizes}U frames. Your frame is {size}U.',
    cannotServe: 'It cannot serve this objective.',
    imagingLabel: 'Imaging each day',
    imagingValue: '{minutes} minutes',
    imagingHelp: 'More imaging means more data and more power. The most a camera can use is {max} minutes a day over sunlit land.',
    imagingNeedsOrbit: 'Choose an orbit to see how much imaging is possible.',
    launcherIntro: 'The rocket must reach your orbit and carry your mass.',
    capacity: 'Carries {kg} kg to your orbit',
    capacityNoOrbit: 'Choose an orbit to see what it can carry.',
    doesNotFly: 'It does not fly to your orbit.',
    record: '{successes} of {attempts} launches succeeded',
    fairing: 'Nose cone {diameter} m wide, {height} m tall',
    dedicated: 'Your own rocket',
    rideshare: 'Shared rocket',
    stationIntro: 'Book passes at ground stations. Each pass costs money, and each station hears only some radio bands.',
    passesLabel: 'Passes a day at {station}',
    passesOffer: 'This orbit offers about {available} passes a day here.',
    passCost: '{cost} a pass',
    bands: { s: 'S-band', x: 'X-band' },
    hears: 'Hears {bands}',
    latitude: 'Latitude {deg}°',
    facts: {
      stores: 'Stores {wh} Wh',
      storage: 'Holds {gb} GB of data',
      dataRate: 'Sends up to {rate} megabits a second',
      twoWay: 'Sends and receives',
      oneWay: 'Sends only',
      pixel: 'Pixel {m} m from 500 km',
      strip: 'Strip {km} km wide from 500 km',
      bands: '{count} colour bands',
      massLimit: 'Whole spacecraft up to {kg} kg',
      size: '{u}U frame',
    },
    chosenCount: '{count} chosen',
  },

  builder: {
    title: 'Spacecraft view',
    empty: 'Choose a structure to start building.',
    loading: 'Loading the 3D view…',
    webglMissing: 'This device cannot show 3D graphics, so here is a flat drawing instead.',
    showLabels: 'Labels',
    showFairing: 'Launcher nose cone',
    sceneDescription: '3D model of the spacecraft. The list of chosen parts in the Design panel gives the same information.',
    diagramDescription: 'Flat front view of the spacecraft and its parts.',
    scaleNote: 'The frame, the solar panel area and the antenna sizes are to scale. Parts inside the frame are placed for clarity.',
    fairingNote: 'The nose cone is drawn as a plain cylinder with its real width and height.',
    controlsHint: 'Drag to turn. Scroll or pinch to zoom. Arrow keys and the + and − keys also work.',
  },

  verify: {
    intro: 'Engineers check every requirement before launch. Fix what is blocked. A risk can fly, but expect trouble.',
    status: { ok: 'OK', risk: 'Risk', blocked: 'Blocked' },
    summary: '{blocked} blocked, {risk} risks, {ok} OK',
    problemsTitle: 'Needs attention',
    okTitle: 'Passing',
    fix: 'Fix:',
    launch: 'Launch',
    launchBlocked: 'The mission cannot launch until every blocked check is fixed.',
    launchReady: 'Ready to launch. You can still go back and change the design.',
    changeDesign: 'Change the design',
  },

  operate: {
    notFlown: 'The mission has not flown yet. Finish the checks, then launch.',
    statuses: {
      completed: 'The mission flew for its whole planned life.',
      not_launched: 'The mission did not launch.',
      launch_failed: 'The rocket failed. The spacecraft was lost.',
      reentered: 'The orbit decayed and the spacecraft burned up early.',
      power_lost: 'The spacecraft lost power and shut down.',
    },
    daysFlown: 'Flew {days} of {planned} planned days.',
    seed: 'Luck number (seed): {seed}',
    scoreTitle: 'Score',
    scoreOf: '{points} of 100',
    scoreParts: {
      requirements: 'Requirements met',
      survival: 'Lasted its planned life',
      efficiency: 'Efficient use of budget and margins',
      collaboration: 'Teamwork',
    },
    pointsOf: '{points} of {weight}',
    requirementsTitle: 'Requirements',
    causesTitle: 'What happened and why',
    severity: { info: 'Note', warning: 'Problem', failure: 'Failure' },
    nextTime: 'Next time:',
    timelineTitle: 'Mission timeline',
    dayLabel: 'Day',
    dayValue: 'Day {day}',
    timelineHelp: 'The mission plays from launch to the end. Pause it, or move the slider to see any day; the orbit view follows.',
    play: 'Play the mission',
    pause: 'Pause',
    replay: 'Play again from day 1',
    toEnd: 'Skip to the end',
    dayFacts: {
      altitude: 'Height {km} km',
      power: 'Made {made} W, used {used} W',
      data: 'Made {made} GB, sent {sent} GB, lost {lost} GB',
      stored: 'Stored on board: {gb} GB',
    },
    charts: {
      power: 'Power, averaged over each day (W)',
      generation: 'Made',
      consumption: 'Used',
      data: 'Data each day (GB)',
      generated: 'Made',
      downlinked: 'Sent to the ground',
      stored: 'Data waiting on board (GB)',
      altitude: 'Height (km)',
      day: 'Day {day}',
      table: 'Show as a table',
      dayColumn: 'Day',
    },
    resemblesTitle: 'Your mission resembles {mission}',
    source: 'Source',
    relaunch: 'Launch again',
    unlocked: 'You met every requirement at Trade study level. Point design is now unlocked.',
    designChanged: 'This report is for the design you launched. You have changed the design since.',
  },

  team: {
    open: 'Team',
    openInRoom: 'Team {code} · {count} of 4',
    unread: '{count} new',
    title: 'Play as a team',
    close: 'Close',
    intro: 'Up to four players design one mission together. Each player looks after part of it.',
    nameLabel: 'Your name',
    create: 'Create a room',
    or: 'or join a room',
    codeLabel: 'Room code',
    join: 'Join',
    codeHelp: 'Share this code with your team:',
    copy: 'Copy code',
    copied: 'Copied',
    status: {
      connecting: 'Connecting…',
      open: 'Connected',
      reconnecting: 'Connection lost. Trying again…',
      closed: 'Disconnected',
    },
    playersTitle: 'Players',
    you: 'you',
    ready: 'Ready',
    notReady: 'Not ready',
    roles: {
      planner: { name: 'Mission planner', text: 'Objective, orbit and level' },
      engineer: { name: 'Spacecraft engineer', text: 'Frame, power, pointing and thruster' },
      science: { name: 'Science lead', text: 'Instruments and imaging time' },
      comms: { name: 'Comms and resources', text: 'Radios, ground stations and launcher' },
    },
    locked: 'Only the {role} can change this ({name}).',
    whoCanFix: 'Who can fix it: {owners}',
    chatTitle: 'Team chat',
    chatEmpty: 'No messages yet.',
    chatLabel: 'Message',
    send: 'Send',
    quick: ['Agreed', 'Wait', 'We are over budget', 'Can you cut some mass?', 'I need more power', 'Ready?'],
    leave: 'Leave the room',
    readyButton: 'I am ready',
    notReadyButton: 'I am not ready',
    waitingFor: 'Waiting for: {names}',
    allReady: 'Everyone is ready.',
    readyHelp: 'The mission launches only when every player is ready. Any change to the mission clears it.',
    errors: {
      room_not_found: 'There is no room with that code.',
      room_full: 'That room is full.',
      server_full: 'The server has no free rooms. Try again later.',
      forbidden: 'That choice belongs to another role.',
      stale: 'Someone else changed that first. Their choice is shown.',
      invalid: 'That value is not allowed.',
      rate_limited: 'Too many changes at once. The mission was reloaded.',
      not_ready: 'Every player must be ready before launch.',
      replaced: 'You joined this room from another window.',
      offline: 'The game server cannot be reached. You can still play alone.',
      unknown: 'Something went wrong in the room.',
    },
  },

  share: {
    title: 'Save and share',
    save: 'Save this design',
    saving: 'Saving…',
    saved: 'Saved. Anyone with this link can open the design:',
    copy: 'Copy link',
    copied: 'Copied',
    failed: 'The design could not be saved. The game server cannot be reached.',
    loaded: 'A saved design was opened from the link.',
    loadFailed: 'The saved design in the link could not be opened.',
  },

  leaderboard: {
    title: 'Leaderboard',
    subtitle: '{scenario} · {level}',
    empty: 'No scores yet. Be the first.',
    unavailable: 'The leaderboard cannot be reached right now.',
    rank: 'Place',
    names: 'Team',
    score: 'Score',
    submit: 'Add this score',
    submitting: 'Sending…',
    submitted: 'Your score is on the board.',
    nameLabel: 'Your name',
    sandboxNote: 'Sandbox missions are not ranked.',
    notFlownNote: 'Only missions that launched are ranked.',
  },
} as const
