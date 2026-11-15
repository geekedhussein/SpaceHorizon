import { describe, expect, it } from 'vitest'
import { catalog, referenceDesign } from '../../../tests/content.ts'
import { resolveDesign } from '../sim/budgets.ts'
import { builderModel } from './builderModel.ts'

const model = (patch = {}) => builderModel(resolveDesign({ ...referenceDesign(), ...patch }, catalog))

describe('spacecraft builder model', () => {
  it('draws nothing without a structure, but still knows the fairing', () => {
    const empty = model({ structureId: null })
    expect(empty.parts).toEqual([])
    expect(empty.busSizeM).toBeNull()
    // Falcon 9's fairing, from /content/launchers.json.
    expect(empty.fairing).toEqual({ name: 'Falcon 9 rideshare', diameterM: 5.2, heightM: 13 })
  })

  it('draws the bus at the published size, long axis up', () => {
    // 3U frame: 100 x 100 x 340.5 mm.
    expect(model().busSizeM).toEqual([0.1, 0.3405, 0.1])
    // 6U frame: 226.3 x 100 x 366 mm.
    expect(model({ structureId: 'structure-6u-isispace' }).busSizeM).toEqual([0.2263, 0.366, 0.1])
  })

  it('gives fold-out wings the published panel area', () => {
    const wings = model().parts.filter((part) => part.kind === 'solar')
    expect(wings).toHaveLength(2)
    const area = wings.reduce((sum, wing) => sum + wing.sizeM[0] * wing.sizeM[1], 0)
    expect(area).toBeCloseTo(0.102, 9)
  })

  it('draws a body panel as one plate on the bus', () => {
    const panels = model({ solarArrayId: 'solar-panel-3u-endurosat' }).parts.filter((part) => part.kind === 'solar')
    expect(panels).toHaveLength(1)
    expect(panels[0].sizeM.slice(0, 2)).toEqual([0.1, 0.3405])
  })

  it('sizes antennas from the wavelength and the gain', () => {
    const antennas = model({
      radioIds: ['radio-uhf-endurosat', 'radio-xband-endurosat'],
    }).parts.filter((part) => part.kind === 'antenna')
    // Four UHF whips and one X-band patch.
    expect(antennas).toHaveLength(5)
    const uhf = catalog.components.find((part) => part.id === 'radio-uhf-endurosat')
    if (uhf?.category !== 'communications') throw new Error('UHF radio missing from /content')
    // Quarter of the wavelength: 299.79 / f[MHz] / 4 metres.
    expect(Math.max(...antennas[0].sizeM)).toBeCloseTo(299.792458 / uhf.frequency_mhz / 4, 9)
    // X-band: 8212.5 MHz is 36.5 mm; 16 dBi needs a square about 65 mm across.
    const patch = antennas[4]
    expect(patch.sizeM[0]).toBeCloseTo(0.0651, 3)
    expect(patch.sizeM[0]).toBe(patch.sizeM[1])
  })

  it('keeps every inside part within the bus', () => {
    const everything = model({
      instrumentIds: ['imager-multiscape50', 'imager-gecko'],
      radioIds: ['radio-uhf-endurosat', 'radio-sband-endurosat', 'radio-xband-endurosat'],
    })
    const [width, height, depth] = everything.busSizeM ?? [0, 0, 0]
    const inside = everything.parts.filter((part) => part.kind === 'internal')
    expect(inside).toHaveLength(9)
    for (const part of inside) {
      expect(part.schematic).toBe(true)
      expect(Math.abs(part.centerM[1]) + part.sizeM[1] / 2).toBeLessThan(height / 2)
      expect(part.sizeM[0]).toBeLessThan(width)
      expect(part.sizeM[2]).toBeLessThan(depth)
    }
    expect(new Set(everything.parts.map((part) => part.key)).size).toBe(everything.parts.length)
  })

  it('adds a lens only with an instrument and a nozzle only with a thruster', () => {
    const bare = model({ instrumentIds: [], propulsionId: null }).parts.map((part) => part.kind)
    expect(bare).not.toContain('lens')
    expect(bare).not.toContain('nozzle')
    const full = model().parts.map((part) => part.kind)
    expect(full).toContain('lens')
    expect(full).toContain('nozzle')
  })
})
