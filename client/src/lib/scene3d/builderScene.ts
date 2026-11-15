// The 3D spacecraft builder: draws the shapes listed by builderModel.ts, and
// the launcher's fairing around them. A view only: it decides nothing about
// the game.
//
// Rendering boundary: the model is in metres with y up, which is also
// Three.js's frame, so 1 scene unit = 1 m and nothing is rescaled.

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import type { BuilderModel, BuilderPartKind } from './builderModel.ts'
import { makeLabel } from './labels.ts'

const MAX_PIXEL_RATIO = 2

const COLOURS: Record<BuilderPartKind, number> = {
  bus: 0xc9d2e0,
  internal: 0x5b7fb8,
  solar: 0x1d3f8f,
  antenna: 0xe0b05a,
  lens: 0x1b1f2a,
  nozzle: 0x8a93a6,
}
const BACKGROUND = 0x05070d
const FAIRING = 0x7fd4ff

export interface BuilderSceneOptions {
  showLabels: boolean
  showFairing: boolean
}

export interface BuilderScene {
  setModel(model: BuilderModel): void
  setOptions(options: BuilderSceneOptions): void
  render(): void
  turnCamera(aroundRad: number, upRad: number): void
  zoomCamera(factor: number): void
  dispose(): void
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.dispose()
      for (const material of [object.material].flat()) material.dispose()
    }
  })
  // Labels are HTML elements; take them off the page with their parents.
  group.traverse((object) => {
    const element = (object as { element?: HTMLElement }).element
    element?.remove()
  })
  group.clear()
}

/**
 * Build the scene inside `container`. Throws if the browser cannot make a
 * WebGL context; the caller then shows the flat drawing instead.
 */
export function createBuilderScene(container: HTMLElement): BuilderScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
  renderer.setClearColor(BACKGROUND)
  renderer.domElement.style.display = 'block'
  container.appendChild(renderer.domElement)

  const labelRenderer = new CSS2DRenderer()
  labelRenderer.domElement.style.cssText = 'position: absolute; inset: 0; pointer-events: none; overflow: hidden;'
  container.appendChild(labelRenderer.domElement)

  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 1.1))
  const sunlight = new THREE.DirectionalLight(0xffffff, 2.2)
  sunlight.position.set(2, 3, 4)
  scene.add(sunlight)

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200)
  camera.position.set(0.6, 0.35, 0.9)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false
  controls.enableDamping = true

  const spacecraft = new THREE.Group()
  const fairing = new THREE.Group()
  scene.add(spacecraft, fairing)

  let options: BuilderSceneOptions = { showLabels: true, showFairing: false }
  let model: BuilderModel | null = null
  /** What the camera was last framed on; reframe only when this changes. */
  let framedOn = ''

  const frameCamera = () => {
    if (!model) return
    const showingFairing = options.showFairing && model.fairing !== null
    const reach = showingFairing && model.fairing ? Math.max(model.fairing.heightM, model.fairing.diameterM) / 2 : model.reachM
    const key = `${reach.toFixed(4)}|${showingFairing}`
    if (reach <= 0 || key === framedOn) return
    framedOn = key
    // Far enough for the whole model to fit the narrower side of the view.
    const halfAngle = THREE.MathUtils.degToRad(camera.fov / 2) * Math.min(1, camera.aspect)
    const distance = (reach * 1.5) / Math.tan(halfAngle)
    const centreY = showingFairing && model.fairing && model.busSizeM ? model.fairing.heightM / 2 - model.busSizeM[1] / 2 : 0
    controls.target.set(0, centreY, 0)
    camera.position.set(0.55, 0.3, 0.78).setLength(distance).add(controls.target)
    controls.minDistance = Math.max(0.05, model.reachM * 0.8)
    controls.maxDistance = distance * 4
  }

  const rebuild = () => {
    disposeGroup(spacecraft)
    disposeGroup(fairing)
    if (!model) return

    for (const part of model.parts) {
      const geometry =
        part.shape === 'cylinder'
          ? new THREE.CylinderGeometry(part.sizeM[0] / 2, part.sizeM[0] / 2, part.sizeM[1], 32)
          : new THREE.BoxGeometry(...part.sizeM)
      const isBus = part.kind === 'bus'
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: COLOURS[part.kind],
          metalness: part.kind === 'solar' ? 0.6 : 0.2,
          roughness: part.kind === 'solar' ? 0.3 : 0.7,
          // The bus is see-through so the parts inside it show.
          transparent: isBus,
          opacity: isBus ? 0.22 : 1,
          depthWrite: !isBus,
        }),
      )
      mesh.position.set(...part.centerM)
      if (isBus || part.kind === 'solar') {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: isBus ? 0xffffff : 0x9db8ff }),
        )
        mesh.add(edges)
      }
      if (part.label && options.showLabels) {
        // Keep the names apart: inside parts to the left, antennas to the
        // right, the frame below and the solar array above.
        const gap = 0.012
        if (part.kind === 'internal') {
          const label = makeLabel(part.label, 'left')
          label.position.x = -part.sizeM[0] / 2 - gap
          mesh.add(label)
        } else if (part.kind === 'antenna') {
          const label = makeLabel(part.label, 'right')
          label.position.x = part.sizeM[0] / 2 + gap
          mesh.add(label)
        } else if (part.kind === 'bus') {
          const label = makeLabel(part.label, 'below')
          label.position.y = -part.sizeM[1] / 2 - 3 * gap
          mesh.add(label)
        } else {
          const label = makeLabel(part.label)
          label.position.y = part.sizeM[1] / 2
          mesh.add(label)
        }
      }
      spacecraft.add(mesh)
    }

    // The fairing: a plain cylinder of the published width and height, with
    // the spacecraft standing on its floor.
    if (options.showFairing && model.fairing && model.busSizeM) {
      const { diameterM, heightM, name } = model.fairing
      const geometry = new THREE.CylinderGeometry(diameterM / 2, diameterM / 2, heightM, 48, 1, true)
      const shell = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: FAIRING,
          transparent: true,
          opacity: 0.08,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      )
      shell.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry, 30),
          new THREE.LineBasicMaterial({ color: FAIRING, transparent: true, opacity: 0.6 }),
        ),
      )
      shell.position.y = heightM / 2 - model.busSizeM[1] / 2
      if (options.showLabels) {
        const label = makeLabel(`${name}: ${diameterM} m × ${heightM} m`)
        label.position.y = heightM / 2
        shell.add(label)
      }
      fairing.add(shell)
    }
    frameCamera()
  }

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

  return {
    setModel(next) {
      model = next
      rebuild()
    },
    setOptions(next) {
      options = next
      rebuild()
    },
    render() {
      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
    },
    turnCamera(aroundRad, upRad) {
      const offset = camera.position.clone().sub(controls.target)
      const spherical = new THREE.Spherical().setFromVector3(offset)
      spherical.theta += aroundRad
      spherical.phi = THREE.MathUtils.clamp(spherical.phi - upRad, 0.05, Math.PI - 0.05)
      camera.position.setFromSpherical(spherical).add(controls.target)
    },
    zoomCamera(factor) {
      const offset = camera.position.clone().sub(controls.target)
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance))
      camera.position.copy(offset).add(controls.target)
    },
    dispose() {
      resizeObserver.disconnect()
      controls.dispose()
      disposeGroup(spacecraft)
      disposeGroup(fairing)
      renderer.dispose()
      renderer.domElement.remove()
      labelRenderer.domElement.remove()
    },
  }
}
