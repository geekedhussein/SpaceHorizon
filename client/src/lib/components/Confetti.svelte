<script lang="ts">
  // A burst of confetti over the whole screen, for a mission that succeeds.
  // Decoration only: hidden from screen readers, never in the way of a click,
  // and skipped for players who ask the system to reduce motion.
  import { onMount } from 'svelte'

  interface Props {
    /** Called when the last piece has fallen. */
    ondone?: () => void
  }
  let { ondone }: Props = $props()

  const COLORS = ['#7fd4ff', '#c4a7ff', '#ffd166', '#3987e5', '#ff8fb1', '#ffffff']
  const PIECES = 160
  const LENGTH_MS = 4200
  const GRAVITY = 0.0009

  let canvas: HTMLCanvasElement

  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ondone?.()
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const ratio = Math.min(devicePixelRatio, 2)
    const resize = () => {
      canvas.width = innerWidth * ratio
      canvas.height = innerHeight * ratio
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    resize()
    addEventListener('resize', resize)

    // Two cannons, from the lower corners towards the middle. Decoration, not
    // simulation, so Math.random is fine.
    const pieces = Array.from({ length: PIECES }, (_, index) => {
      const left = index % 2 === 0
      const angle = -Math.PI / 2 + (left ? 0.45 : -0.45) + (Math.random() - 0.5) * 0.7
      const speed = 0.9 + Math.random() * 0.7
      return {
        x: left ? innerWidth * 0.08 : innerWidth * 0.92,
        y: innerHeight * 0.95,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 1.25,
        size: 6 + Math.random() * 6,
        spin: (Math.random() - 0.5) * 0.02,
        turn: Math.random() * Math.PI,
        color: COLORS[index % COLORS.length],
        delay: Math.random() * 350,
      }
    })

    const start = performance.now()
    let last = start
    let frame = requestAnimationFrame(function draw(now) {
      const dt = Math.min(now - last, 40)
      last = now
      const age = now - start
      ctx.clearRect(0, 0, innerWidth, innerHeight)
      ctx.globalAlpha = Math.min(1, Math.max(0, (LENGTH_MS - age) / 800))
      for (const piece of pieces) {
        if (age < piece.delay) continue
        piece.vy += GRAVITY * dt
        piece.vx *= 0.995
        piece.x += piece.vx * dt
        piece.y += piece.vy * dt
        piece.turn += piece.spin * dt
        ctx.save()
        ctx.translate(piece.x, piece.y)
        ctx.rotate(piece.turn)
        ctx.scale(1, Math.cos(piece.turn * 2))
        ctx.fillStyle = piece.color
        ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2)
        ctx.restore()
      }
      if (age < LENGTH_MS) frame = requestAnimationFrame(draw)
      else ondone?.()
    })

    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('resize', resize)
    }
  })
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    position: fixed;
    inset: 0;
    z-index: 60;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
  }
</style>
