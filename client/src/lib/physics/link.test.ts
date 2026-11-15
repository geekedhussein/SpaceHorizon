import { describe, expect, it } from 'vitest'
import {
  achievableDataRateBps,
  carrierToNoiseDensityDbHz,
  dishAntennaGainDb,
  eirpDbw,
  freeSpacePathLossDb,
  linkMarginDb,
  slantRangeM,
  wavelengthM,
} from './link.ts'
import { degToRad, fromDb, M_PER_KM, toDb } from './units.ts'

describe('decibels', () => {
  it('converts both ways', () => {
    expect(toDb(100)).toBeCloseTo(20, 12)
    expect(fromDb(30)).toBeCloseTo(1000, 9)
    expect(fromDb(toDb(0.37))).toBeCloseTo(0.37, 12)
  })
})

describe('slant range', () => {
  const altitudeM = 500 * M_PER_KM

  it('equals the altitude straight overhead', () => {
    expect(slantRangeM(altitudeM, degToRad(90))).toBeCloseTo(altitudeM, 3)
  })

  it('reaches the horizon distance at zero elevation', () => {
    // sqrt(r^2 - R_E^2) = sqrt(500 x 13256.274) km = 2574.5 km.
    expect(slantRangeM(altitudeM, 0) / M_PER_KM).toBeCloseTo(2574.5, 0)
  })

  it('shrinks as the spacecraft climbs in the sky', () => {
    expect(slantRangeM(altitudeM, degToRad(10))).toBeGreaterThan(
      slantRangeM(altitudeM, degToRad(45)),
    )
  })
})

describe('free-space path loss', () => {
  it('agrees with the engineering form 20 log d(km) + 20 log f(GHz) + 92.45', () => {
    // https://en.wikipedia.org/wiki/Free-space_path_loss gives this form, and
    // 20 log d(m) + 20 log f(Hz) - 147.55 in SI units.
    const cases = [
      { distanceKm: 1, frequencyGhz: 2.4 },
      { distanceKm: 2574.5, frequencyGhz: 0.4365 },
      { distanceKm: 1000, frequencyGhz: 8.2125 },
    ]
    for (const { distanceKm, frequencyGhz } of cases) {
      const loss = freeSpacePathLossDb(distanceKm * M_PER_KM, frequencyGhz * 1e9)
      const kmGhz = 20 * Math.log10(distanceKm) + 20 * Math.log10(frequencyGhz) + 92.45
      const si = 20 * Math.log10(distanceKm * 1e3) + 20 * Math.log10(frequencyGhz * 1e9) - 147.55
      expect(Math.abs(loss - kmGhz)).toBeLessThan(0.01)
      expect(Math.abs(loss - si)).toBeLessThan(0.01)
    }
  })

  it('grows by 6 dB when the distance doubles', () => {
    const near = freeSpacePathLossDb(1000e3, 2245e6)
    expect(freeSpacePathLossDb(2000e3, 2245e6) - near).toBeCloseTo(6.0206, 3)
  })
})

describe('antenna gain', () => {
  it('is 0 dBi for a perfect dish one wavelength in circumference', () => {
    const frequencyHz = 8212.5e6
    expect(dishAntennaGainDb(wavelengthM(frequencyHz) / Math.PI, frequencyHz, 1)).toBeCloseTo(0, 9)
  })

  it('grows by 6 dB when the dish diameter doubles', () => {
    const small = dishAntennaGainDb(1.5, 2245e6, 0.55)
    expect(dishAntennaGainDb(3, 2245e6, 0.55) - small).toBeCloseTo(6.0206, 3)
  })
})

describe('link budget', () => {
  it('adds up a hand-worked example', () => {
    // 2 W (3.01 dBW) into a 0 dBi antenna with 1 dB of cable loss: EIRP 2.01 dBW.
    // Path loss 160 dB, station G/T 10 dB/K, 10 log10(k) = -228.60 dBW/K/Hz:
    // C/N0 = 2.01 - 160 + 10 + 228.60 = 80.61 dB-Hz.
    const eirp = eirpDbw(2, 0, 1)
    expect(eirp).toBeCloseTo(2.01, 2)
    const cn0 = carrierToNoiseDensityDbHz({ eirpDbw: eirp, pathLossDb: 160, receiverGOverTDbK: 10 })
    expect(cn0).toBeCloseTo(80.61, 2)
    // Needing Eb/N0 of 10 dB with 3 dB margin leaves 67.61 dB-Hz: 5.77 Mbit/s.
    const rateBps = achievableDataRateBps({
      carrierToNoiseDensityDbHz: cn0,
      requiredEbN0Db: 10,
      marginDb: 3,
    })
    expect(rateBps / 1e6).toBeCloseTo(5.77, 1)
    expect(
      linkMarginDb({ carrierToNoiseDensityDbHz: cn0, dataRateBps: rateBps, requiredEbN0Db: 10 }),
    ).toBeCloseTo(3, 9)
  })

  it('halves the data rate for every 3 dB lost', () => {
    const base = { requiredEbN0Db: 10 }
    const good = achievableDataRateBps({ ...base, carrierToNoiseDensityDbHz: 70 })
    const worse = achievableDataRateBps({ ...base, carrierToNoiseDensityDbHz: 70 - toDb(2) })
    expect(worse).toBeCloseTo(good / 2, 6)
  })
})
