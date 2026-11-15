// The 3D orbit view: Earth, the orbit, the spacecraft, the Sun direction and
// the ground stations. This is a view only. Every position it draws is handed
// in from /lib/orbit; nothing here decides a game result.
//
// Rendering boundary: the orbit module works in metres in the Earth-centred
// inertial frame (z to the north pole). Three.js has y up, so a point
// (x, y, z) is drawn at (x, z, -y), scaled so 1 scene unit = 1000 km.

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import type { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { MissionGeometry, Vec3 } from '../orbit/index.ts'
import { makeLabel } from './labels.ts'
import { EARTH_EQUATORIAL_RADIUS_M } from '../physics/constants.ts'

/** Scene units per metre: 1 unit = 1000 km. */
const SCALE = 1e-6
const EARTH_RADIUS = EARTH_EQUATORIAL_RADIUS_M * SCALE

/** Display sizes, not real ones. The spacecraft is labelled "not to scale". */
const SPACECRAFT_RADIUS = 0.11
const STATION_RADIUS = 0.045
const SUN_MARKER_DISTANCE = 45
const SUN_MARKER_RADIUS = 0.8

const MIN_CAMERA_DISTANCE = 8
const MAX_CAMERA_DISTANCE = 90
const MAX_PIXEL_RATIO = 2

const COLOURS = {
  background: 0x05070d,
  path: 0x7fd4ff,
  spacecraftLit: 0xffffff,
  spacecraftDark: 0x8a93a6,
  station: 0xffb347,
  stationContact: 0x6dff9c,
  cone: 0x6dff9c,
  sun: 0xffe08a,
}

export interface OrbitSceneSetup {
  container: HTMLElement
  /** Ground stations, in the same order as MissionGeometry.stations. */
  stations: { id: string; name: string }[]
  labels: { spacecraft: string; sun: string }
  /** Earth texture at two sizes; the small one shows first. */
  textures: { small: string; large: string }
}

export interface OrbitSceneOptions {
  showLabels: boolean
  showPath: boolean
  showCones: boolean
}

export interface OrbitSceneFrame {
  geometry: MissionGeometry
  /** The orbit ellipse, inertial frame, metres. */
  pathEciM: Vec3[]
}

export interface OrbitScene {
  /** Size of the coverage cone over each station (see contactConeAngleRad). */
  setCone(centralAngleRad: number, orbitRadiusM: number): void
  setOptions(options: OrbitSceneOptions): void
  /** Draw one frame. */
  render(frame: OrbitSceneFrame): void
  /** Keyboard controls: turn the camera around Earth, or zoom. */
  turnCamera(aroundRad: number, upRad: number): void
  zoomCamera(factor: number): void
  dispose(): void
}

function toScene(v: Vec3, target = new THREE.Vector3()): THREE.Vector3 {
  return target.set(v[0] * SCALE, v[2] * SCALE, -v[1] * SCALE)
}

// Day and night on Earth. The Sun direction comes from the orbit module. The
// soft band between day and night (about 6 degrees each side) is cosmetic.
const EARTH_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const EARTH_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D dayMap;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vec3 surface = texture2D(dayMap, vUv).rgb;
    float sunHeight = dot(normalize(vWorldNormal), sunDirection);
    float day = smoothstep(-0.1, 0.1, sunHeight);
    float lit = 0.45 + 0.55 * clamp(sunHeight, 0.0, 1.0);
    gl_FragColor = vec4(surface * mix(0.07, lit, day), 1.0);
    #include <colorspace_fragment>
  }
`

/** A cone from a station (at +y) up to the height of the orbit. */
function coneGeometry(centralAngleRad: number, orbitRadius: number): THREE.BufferGeometry {
  const segments = 48
  const positions: number[] = []
  const rim = (index: number): [number, number, number] => {
    const around = (2 * Math.PI * index) / segments
    return [
      orbitRadius * Math.sin(centralAngleRad) * Math.cos(around),
      orbitRadius * Math.cos(centralAngleRad),
      orbitRadius * Math.sin(centralAngleRad) * Math.sin(around),
    ]
  }
  for (let index = 0; index < segments; index++) {
    positions.push(0, EARTH_RADIUS, 0, ...rim(index), ...rim(index + 1))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}

/**
 * Build the scene inside `container`. Throws if the browser cannot make a
 * WebGL context; the caller then shows the flat map instead.
 */
export function createOrbitScene(setup: OrbitSceneSetup): OrbitScene {
  const { container } = setup
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
  renderer.setClearColor(COLOURS.background)
  renderer.domElement.style.display = 'block'
  container.appendChild(renderer.domElement)

  const labelRenderer = new CSS2DRenderer()
  labelRenderer.domElement.style.cssText = 'position: absolute; inset: 0; pointer-events: none; overflow: hidden;'
  container.appendChild(labelRenderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400)
  camera.position.set(0, 9, 24)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false
  controls.enableDamping = true
  controls.minDistance = MIN_CAMERA_DISTANCE
  controls.maxDistance = MAX_CAMERA_DISTANCE

  // Earth. Three's sphere puts the middle of the texture (longitude 0) on +x
  // and 90 degrees east on -z, which is the Earth-fixed frame after toScene.
  const textureLoader = new THREE.TextureLoader()
  const placeholder = new THREE.DataTexture(new Uint8Array([20, 45, 90, 255]), 1, 1)
  placeholder.colorSpace = THREE.SRGBColorSpace
  placeholder.needsUpdate = true
  const earthMaterial = new THREE.ShaderMaterial({
    uniforms: { dayMap: { value: placeholder }, sunDirection: { value: new THREE.Vector3(1, 0, 0) } },
    vertexShader: EARTH_VERTEX_SHADER,
    fragmentShader: EARTH_FRAGMENT_SHADER,
  })
  const earthGroup = new THREE.Group()
  earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 96, 48), earthMaterial))
  scene.add(earthGroup)

  // Level of detail: show the small texture quickly, then swap in the large
  // one on screens that can use it.
  let disposed = false
  const useTexture = (url: string, then?: () => void) => {
    textureLoader.load(url, (texture) => {
      if (disposed) return texture.dispose()
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
      const previous = earthMaterial.uniforms.dayMap.value as THREE.Texture
      earthMaterial.uniforms.dayMap.value = texture
      previous.dispose()
      then?.()
    })
  }
  useTexture(setup.textures.small, () => {
    const bigScreen = Math.max(window.innerWidth, window.innerHeight) >= 900
    if (bigScreen && renderer.capabilities.maxTextureSize >= 4096) useTexture(setup.textures.large)
  })

  // Orbit path.
  const pathGeometry = new THREE.BufferGeometry()
  let pathPositions = new Float32Array(0)
  const path = new THREE.Line(pathGeometry, new THREE.LineBasicMaterial({ color: COLOURS.path }))
  path.frustumCulled = false
  scene.add(path)

  // Spacecraft marker.
  const spacecraftMaterial = new THREE.MeshBasicMaterial({ color: COLOURS.spacecraftLit })
  const spacecraft = new THREE.Mesh(new THREE.SphereGeometry(SPACECRAFT_RADIUS, 16, 12), spacecraftMaterial)
  const spacecraftLabel = makeLabel(setup.labels.spacecraft)
  spacecraft.add(spacecraftLabel)
  scene.add(spacecraft)

  // Sun marker: the direction is right, the distance is not (it is labelled).
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_MARKER_RADIUS, 24, 16),
    new THREE.MeshBasicMaterial({ color: COLOURS.sun }),
  )
  const sunLabel = makeLabel(setup.labels.sun)
  sun.add(sunLabel)
  scene.add(sun)

  // Ground stations ride on the Earth group, so they turn with Earth.
  const stationGeometry = new THREE.SphereGeometry(STATION_RADIUS, 12, 8)
  const coneMaterial = new THREE.MeshBasicMaterial({
    color: COLOURS.cone,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const linkMaterial = new THREE.LineBasicMaterial({ color: COLOURS.stationContact })
  const stations = setup.stations.map((station) => {
    const material = new THREE.MeshBasicMaterial({ color: COLOURS.station })
    const dot = new THREE.Mesh(stationGeometry, material)
    const label = makeLabel(station.name)
    dot.add(label)
    const cone = new THREE.Mesh(new THREE.BufferGeometry(), coneMaterial)
    cone.visible = false
    earthGroup.add(dot, cone)
    // The line from station to spacecraft lives in the inertial frame.
    const link = new THREE.Line(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(6, 3)),
      linkMaterial,
    )
    link.frustumCulled = false
    link.visible = false
    scene.add(link)
    return { material, dot, label, cone, link, placed: false }
  })

  let options: OrbitSceneOptions = { showLabels: true, showPath: true, showCones: true }
  let coneShape: THREE.BufferGeometry | null = null
  let cameraPlaced = false

  const resize = () => {
    const width = container.clientWidth
    const height = container.clientHeight
    if (width === 0 || height === 0) return
    renderer.setSize(width, height)
    labelRenderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  resize()

  const up = new THREE.Vector3(0, 1, 0)
  const scratch = new THREE.Vector3()
  const worldPosition = new THREE.Vector3()

  /** True if Earth is between the camera and a point. */
  const behindEarth = (point: THREE.Vector3): boolean => {
    const toPoint = scratch.copy(point).sub(camera.position)
    const along = THREE.MathUtils.clamp(-camera.position.dot(toPoint) / toPoint.lengthSq(), 0, 1)
    return toPoint.multiplyScalar(along).add(camera.position).length() < EARTH_RADIUS * 0.995
  }
  const showLabel = (label: CSS2DObject, anchor: THREE.Object3D) => {
    label.visible = options.showLabels && !behindEarth(anchor.getWorldPosition(worldPosition))
  }

  return {
    setCone(centralAngleRad, orbitRadiusM) {
      coneShape?.dispose()
      coneShape = coneGeometry(centralAngleRad, orbitRadiusM * SCALE)
      for (const station of stations) station.cone.geometry = coneShape
    },

    setOptions(next) {
      options = next
    },

    render({ geometry, pathEciM }) {
      const sunDirection = toScene(geometry.sunDirectionEci, new THREE.Vector3()).divideScalar(SCALE)
      earthMaterial.uniforms.sunDirection.value.copy(sunDirection)
      earthGroup.rotation.y = geometry.earthRotationRad
      sun.position.copy(sunDirection).multiplyScalar(SUN_MARKER_DISTANCE)

      toScene(geometry.positionEciM, spacecraft.position)
      spacecraftMaterial.color.setHex(geometry.inEclipse ? COLOURS.spacecraftDark : COLOURS.spacecraftLit)

      if (!cameraPlaced) {
        // Start on the day side, looking at the spacecraft's part of the sky.
        camera.position
          .copy(sunDirection)
          .multiplyScalar(0.8)
          .add(scratch.copy(spacecraft.position).normalize())
          .add(scratch.set(0, 0.35, 0))
          .setLength(26)
        cameraPlaced = true
      }

      path.visible = options.showPath
      if (options.showPath) {
        if (pathPositions.length !== pathEciM.length * 3) {
          pathPositions = new Float32Array(pathEciM.length * 3)
          pathGeometry.setAttribute('position', new THREE.BufferAttribute(pathPositions, 3))
        }
        pathEciM.forEach((point, index) => {
          pathPositions[index * 3] = point[0] * SCALE
          pathPositions[index * 3 + 1] = point[2] * SCALE
          pathPositions[index * 3 + 2] = -point[1] * SCALE
        })
        pathGeometry.attributes.position.needsUpdate = true
      }

      earthGroup.updateMatrixWorld()
      geometry.stations.forEach((view, index) => {
        const station = stations[index]
        if (!station) return
        if (!station.placed) {
          toScene(view.positionEcefM, station.dot.position)
          station.cone.quaternion.setFromUnitVectors(up, scratch.copy(station.dot.position).normalize())
          station.placed = true
        }
        station.material.color.setHex(view.inContact ? COLOURS.stationContact : COLOURS.station)
        station.dot.scale.setScalar(view.inContact ? 1.6 : 1)
        station.cone.visible = options.showCones && view.inContact && coneShape !== null
        station.link.visible = view.inContact
        if (view.inContact) {
          const ends = station.link.geometry.attributes.position
          station.dot.getWorldPosition(worldPosition)
          ends.setXYZ(0, worldPosition.x, worldPosition.y, worldPosition.z)
          ends.setXYZ(1, spacecraft.position.x, spacecraft.position.y, spacecraft.position.z)
          ends.needsUpdate = true
        }
      })

      controls.update()
      camera.updateMatrixWorld()
      showLabel(spacecraftLabel, spacecraft)
      showLabel(sunLabel, sun)
      for (const station of stations) showLabel(station.label, station.dot)

      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
    },

    turnCamera(aroundRad, upRad) {
      const spherical = new THREE.Spherical().setFromVector3(camera.position)
      spherical.theta += aroundRad
      spherical.phi = THREE.MathUtils.clamp(spherical.phi - upRad, 0.05, Math.PI - 0.05)
      camera.position.setFromSpherical(spherical)
    },

    zoomCamera(factor) {
      camera.position.setLength(
        THREE.MathUtils.clamp(camera.position.length() * factor, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE),
      )
    },

    dispose() {
      disposed = true
      resizeObserver.disconnect()
      controls.dispose()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose()
          for (const material of [object.material].flat()) material.dispose()
        }
      })
      ;(earthMaterial.uniforms.dayMap.value as THREE.Texture).dispose()
      renderer.dispose()
      renderer.domElement.remove()
      labelRenderer.domElement.remove()
    },
  }
}
