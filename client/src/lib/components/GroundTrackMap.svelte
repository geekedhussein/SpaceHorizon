<script lang="ts">
  // Flat map of the mission: the 2D stand-in for the 3D view when WebGL is not
  // available, and an alternative view when it is. It only draws what the
  // orbit module worked out.
  import { terminatorLatitudeRad } from '../orbit/index.ts'
  import type { GroundPoint, MissionGeometry } from '../orbit/index.ts'
  import { radToDeg } from '../physics/units.ts'
  import { orbitViewText as text } from '../strings/en.ts'

  interface Props {
    geometry: MissionGeometry
    /** The path over the ground for the coming orbit. */
    track: GroundPoint[]
    sun: GroundPoint
    stations: { id: string; name: string; latitude_deg: number; longitude_deg: number }[]
    textureUrl: string
    showLabels: boolean
    showPath: boolean
  }
  let { geometry, track, sun, stations, textureUrl, showLabels, showPath }: Props = $props()

  // Map units are degrees: x = longitude + 180, y = 90 - latitude.
  const x = (longitudeDeg: number) => longitudeDeg + 180
  const y = (latitudeDeg: number) => 90 - latitudeDeg
  const point = (p: GroundPoint) => `${x(radToDeg(p.longitudeRad)).toFixed(2)},${y(radToDeg(p.latitudeRad)).toFixed(2)}`

  /** The ground track, cut where it wraps around the edge of the map. */
  let trackLines = $derived.by(() => {
    const lines: string[][] = [[]]
    track.forEach((p, index) => {
      if (index > 0 && Math.abs(p.longitudeRad - track[index - 1].longitudeRad) > Math.PI) lines.push([])
      lines[lines.length - 1].push(point(p))
    })
    return lines.map((line) => line.join(' '))
  })

  /** The night side: everything beyond the day-night line, away from the Sun. */
  let night = $derived.by(() => {
    const edge: string[] = []
    for (let longitudeDeg = -180; longitudeDeg <= 180; longitudeDeg += 2) {
      const latitude = terminatorLatitudeRad((longitudeDeg * Math.PI) / 180, sun)
      edge.push(`${x(longitudeDeg)},${y(radToDeg(latitude)).toFixed(2)}`)
    }
    const darkPoleY = sun.latitudeRad >= 0 ? 180 : 0
    return `${edge.join(' ')} 360,${darkPoleY} 0,${darkPoleY}`
  })

  let contact = $derived(new Set(geometry.stations.filter((s) => s.inContact).map((s) => s.stationId)))
</script>

<svg viewBox="0 0 360 180" role="img" aria-label={text.mapDescription}>
  <rect width="360" height="180" fill="#14305a" />
  <image href={textureUrl} width="360" height="180" preserveAspectRatio="none" />
  <polygon points={night} fill="#000" opacity="0.55" />

  {#if showPath}
    {#each trackLines as line}
      <polyline points={line} fill="none" stroke="#7fd4ff" stroke-width="0.7" />
    {/each}
  {/if}

  <g>
    <circle cx={x(radToDeg(sun.longitudeRad))} cy={y(radToDeg(sun.latitudeRad))} r="3" fill="#ffe08a" stroke="#000" stroke-width="0.4" />
    {#if showLabels}
      <text x={x(radToDeg(sun.longitudeRad))} y={y(radToDeg(sun.latitudeRad)) - 4.5} text-anchor="middle">{text.sunOverhead}</text>
    {/if}
  </g>

  {#each stations as station (station.id)}
    {@const active = contact.has(station.id)}
    <g>
      <!-- In contact: a larger green dot with a ring, so colour is not the only sign. -->
      {#if active}
        <circle cx={x(station.longitude_deg)} cy={y(station.latitude_deg)} r="4" fill="none" stroke="#6dff9c" stroke-width="0.6" />
      {/if}
      <circle cx={x(station.longitude_deg)} cy={y(station.latitude_deg)} r={active ? 2 : 1.4} fill={active ? '#6dff9c' : '#ffb347'} stroke="#000" stroke-width="0.3" />
      {#if showLabels}
        <text x={x(station.longitude_deg)} y={y(station.latitude_deg) + 6.5} text-anchor="middle">{station.name}</text>
      {/if}
    </g>
  {/each}

  <g>
    <circle cx={x(radToDeg(geometry.subpoint.longitudeRad))} cy={y(radToDeg(geometry.subpoint.latitudeRad))} r="2.2" fill={geometry.inEclipse ? '#8a93a6' : '#fff'} stroke="#000" stroke-width="0.5" />
    {#if showLabels}
      <text x={x(radToDeg(geometry.subpoint.longitudeRad))} y={y(radToDeg(geometry.subpoint.latitudeRad)) - 3.5} text-anchor="middle">{text.spacecraft}</text>
    {/if}
  </g>
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    max-height: 100%;
    background: #05070d;
  }
  text {
    font: 4px system-ui, sans-serif;
    fill: #fff;
    paint-order: stroke;
    stroke: #05070d;
    stroke-width: 1px;
  }
</style>
