// What the spacecraft builder draws: a list of simple shapes worked out from
// the chosen parts. Pure, with no Three.js, so it is unit-tested and the flat
// drawing can use it too. It decides nothing about the game.
//
// Frame: metres, origin at the centre of the bus, y along its long axis.
//
// To scale (from /content or from physics):
//   - the bus: the structure's published outside size
//   - deployed solar panels: their published total area
//   - whip antennas: a quarter of the radio's wavelength, L = c / (4 f)
//   - patch antennas: the area that gives the published gain,
//       A = G lambda^2 / (4 pi)
//     (the antenna gain relation used in physics/link.ts, solved for area
//     with an efficiency of 1)
//   - the launcher's fairing: its published width and height
// Placed for clarity only (marked `schematic`): the parts inside the bus, the
// camera lens, the thruster nozzle, and where each part sits.

import type { Vec3 } from '../orbit/kepler.ts'
import { SPEED_OF_LIGHT_M_S } from '../physics/constants.ts'
import type { ResolvedDesign } from '../sim/budgets.ts'

export type BuilderPartKind = 'bus' | 'internal' | 'solar' | 'antenna' | 'lens' | 'nozzle'

export interface BuilderPart {
  /** Unique within the model. */
  key: string
  /** Catalogue name, shown as the label. Empty for extra pieces of a part. */
  label: string
  kind: BuilderPartKind
  /** A cylinder's axis is y: size is [diameter, length, diameter]. */
  shape: 'box' | 'cylinder'
  sizeM: Vec3
  centerM: Vec3
  schematic: boolean
}

export interface BuilderModel {
  parts: BuilderPart[]
  /** Outside size of the bus as drawn: width, height (long axis), depth. */
  busSizeM: Vec3 | null
  /** Half the largest span of the model, for placing the camera. */
  reachM: number
  fairing: { name: string; diameterM: number; heightM: number } | null
}

const PANEL_THICKNESS_M = 0.003
const WHIP_THICKNESS_M = 0.003
const PATCH_THICKNESS_M = 0.004
/** Below this frequency the radio gets whip antennas, above it a patch. */
const WHIP_BELOW_MHZ = 1000

export function builderModel(resolved: ResolvedDesign): BuilderModel {
  const fairing = resolved.launcher
    ? {
        name: resolved.launcher.name,
        diameterM: resolved.launcher.fairing_diameter_m,
        heightM: resolved.launcher.fairing_height_m,
      }
    : null
  const structure = resolved.structure
  if (!structure) return { parts: [], busSizeM: null, reachM: 0, fairing }

  // Long axis up; the wider of the other two sides across.
  const [depth, width, height] = [...structure.body_size_mm].sort((a, b) => a - b).map((mm) => mm / 1000)
  const parts: BuilderPart[] = [
    {
      key: structure.id,
      label: structure.name,
      kind: 'bus',
      shape: 'box',
      sizeM: [width, height, depth],
      centerM: [0, 0, 0],
      schematic: false,
    },
  ]

  // Inside the bus: equal slabs from the thruster end up to the instruments.
  const inside = [
    resolved.propulsion,
    resolved.battery,
    resolved.computer,
    resolved.attitudeControl,
    ...resolved.radios,
    ...resolved.instruments,
  ].filter((entry) => entry !== null)
  const wall = 0.006
  const slot = (height - 2 * wall) / Math.max(inside.length, 5)
  inside.forEach((entry, index) => {
    parts.push({
      key: `${entry.id}-${index}`,
      label: entry.name,
      kind: 'internal',
      shape: 'box',
      sizeM: [width - 2 * wall, slot * 0.8, depth - 2 * wall],
      centerM: [0, -height / 2 + wall + slot * (index + 0.5), 0],
      schematic: true,
    })
  })

  if (resolved.propulsion) {
    const diameter = 0.4 * depth
    parts.push({
      key: 'nozzle',
      label: '',
      kind: 'nozzle',
      shape: 'cylinder',
      sizeM: [diameter, 0.02, diameter],
      centerM: [0, -height / 2 - 0.01, 0],
      schematic: true,
    })
  }
  if (resolved.instruments.length > 0) {
    const diameter = 0.6 * depth
    parts.push({
      key: 'lens',
      label: '',
      kind: 'lens',
      shape: 'cylinder',
      sizeM: [diameter, 0.02, diameter],
      centerM: [0, height / 2 + 0.01, 0],
      schematic: true,
    })
  }

  // Solar array: on the +z face. Fold-out panels are two wings as tall as the
  // bus, with the published area between them.
  const solar = resolved.solarArray
  if (solar) {
    const z = depth / 2 + PANEL_THICKNESS_M / 2
    if (solar.deployed_area_m2) {
      const wingWidth = solar.deployed_area_m2 / 2 / height
      for (const side of [-1, 1]) {
        parts.push({
          key: `${solar.id}-${side}`,
          label: side === 1 ? solar.name : '',
          kind: 'solar',
          shape: 'box',
          sizeM: [wingWidth, height, PANEL_THICKNESS_M],
          centerM: [side * (width / 2 + wingWidth / 2), 0, z],
          schematic: false,
        })
      }
    } else {
      parts.push({
        key: solar.id,
        label: solar.name,
        kind: 'solar',
        shape: 'box',
        sizeM: [width, height, PANEL_THICKNESS_M],
        centerM: [0, 0, z],
        schematic: false,
      })
    }
  }

  // Antennas, sized from each radio's frequency and gain.
  let patches = 0
  for (const radio of resolved.radios) {
    const wavelengthM = SPEED_OF_LIGHT_M_S / (radio.frequency_mhz * 1e6)
    if (radio.frequency_mhz < WHIP_BELOW_MHZ) {
      const length = wavelengthM / 4
      const y = height / 2 - 0.01
      const whips: [Vec3, Vec3][] = [
        [[length, WHIP_THICKNESS_M, WHIP_THICKNESS_M], [width / 2 + length / 2, y, 0]],
        [[length, WHIP_THICKNESS_M, WHIP_THICKNESS_M], [-width / 2 - length / 2, y, 0]],
        [[WHIP_THICKNESS_M, WHIP_THICKNESS_M, length], [0, y, -depth / 2 - length / 2]],
        [[WHIP_THICKNESS_M, WHIP_THICKNESS_M, length], [0, y, depth / 2 + length / 2]],
      ]
      whips.forEach(([sizeM, centerM], index) => {
        parts.push({
          key: `${radio.id}-whip-${index}`,
          label: index === 0 ? radio.antenna_name : '',
          kind: 'antenna',
          shape: 'box',
          sizeM,
          centerM,
          schematic: false,
        })
      })
    } else {
      const gain = 10 ** (radio.antenna_gain_dbi / 10)
      const side = Math.sqrt((gain * wavelengthM ** 2) / (4 * Math.PI))
      parts.push({
        key: `${radio.id}-patch`,
        label: radio.antenna_name,
        kind: 'antenna',
        shape: 'box',
        sizeM: [side, side, PATCH_THICKNESS_M],
        centerM: [0, height / 4 - (patches * height) / 2, -depth / 2 - PATCH_THICKNESS_M / 2],
        schematic: false,
      })
      patches++
    }
  }

  const reachM = Math.max(
    ...parts.map((part) =>
      Math.max(...part.centerM.map((centre, axis) => Math.abs(centre) + part.sizeM[axis] / 2)),
    ),
  )
  return { parts, busSizeM: [width, height, depth], reachM, fairing }
}
