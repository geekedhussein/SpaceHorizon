// Text labels that float over a 3D scene. They are ordinary HTML, so they stay
// sharp and readable at any zoom.

import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

/**
 * `side` says where the text sits from its anchor point: 'above' (the
 * default), 'below', or to the 'left' or 'right' of it.
 */
export function makeLabel(text: string, side: 'above' | 'below' | 'left' | 'right' = 'above'): CSS2DObject {
  const element = document.createElement('div')
  element.textContent = text
  element.style.cssText =
    'font: 12px system-ui, sans-serif; color: #fff; background: rgba(5, 7, 13, 0.7);' +
    'padding: 1px 6px; border-radius: 4px; white-space: nowrap; pointer-events: none;' +
    (side === 'above' ? 'transform: translateY(-14px);' : '')
  const label = new CSS2DObject(element)
  if (side === 'above') label.center.set(0.5, 1)
  else if (side === 'below') label.center.set(0.5, 0)
  else label.center.set(side === 'left' ? 1 : 0, 0.5)
  return label
}
