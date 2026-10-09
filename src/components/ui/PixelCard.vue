<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

/**
 * The pixel grid, adapted from the open-source PixelCard in vue-bits.dev.
 *
 * A canvas of squares, laid out on a diagonal delay from the centre, that grow
 * into visibility when the pointer enters and shrink back out when it leaves.
 * Nothing about the photograph is drawn here — this is the field behind it.
 *
 * Two things changed from the original, both forced by this codebase:
 *
 * · **JavaScript, not TypeScript.** Everything else in `src/` is plain JS.
 * · **Colours come from CSS custom properties, not from the variant table.**
 *   The original hard-codes one palette per variant, which would put a fixed
 *   blue field behind a portrait that otherwise inherits `--c-n-*` from the
 *   theme. Here `colors` is supplied by the caller and re-read on a theme
 *   change, so the field belongs to whichever theme is active. See
 *   `HomeSection.vue`.
 *
 * The original's structure is otherwise intact, including the parts that look
 * redundant: the `counterStep` delay is what makes the field sweep outward from
 * the middle rather than light up all at once, and `isIdle` is what stops the
 * loop once nothing is moving so an idle card costs nothing.
 */

/** Map the variant name to a gap/speed pair. Colours are not set here. */
const VARIANTS = {
  default: { gap: 5, speed: 35 },
  blue: { gap: 10, speed: 25 },
  yellow: { gap: 3, speed: 20 },
  pink: { gap: 6, speed: 80 },
}

const props = defineProps({
  variant: { type: String, default: 'default' },
  gap: { type: Number, default: null },
  speed: { type: Number, default: null },
  colors: { type: String, default: '' },
  noFocus: { type: Boolean, default: false },
  className: { type: String, default: '' },
  /**
   * Largest a square may grow, in pixels. The original hard-codes 2, which reads
   * as a sparse scattering at any real gap; 3 with a gap of 4 is the density in
   * the reference the hero uses. `minSize` is derived from this rather than
   * hard-coded, so the shimmer keeps its range at any size.
   */
  dotSize: { type: Number, default: 2 },
})

class Pixel {
  constructor(canvas, context, x, y, color, speed, delay, maxSizeInteger) {
    this.width = canvas.width
    this.height = canvas.height
    this.ctx = context
    this.x = x
    this.y = y
    this.color = color
    this.speed = this.getRandomValue(0.1, 0.9) * speed
    this.size = 0
    this.sizeStep = Math.random() * 0.4
    // The dot grows to `maxSizeInteger` and stays there.
    //
    // The original oscillates the size between a small `minSize` and the cap, and
    // `fillRect` on a fractional size antialiases, so for most of every cycle the
    // dot composites at a fraction of its colour and the field reads as a ghost.
    // Measured on this site: the canvas held tens of thousands of pixels with
    // non-zero alpha and almost none of them were legible. Pinning the floor to
    // the cap makes every square land on whole pixels at full colour, which is
    // what the reference grid actually looks like.
    this.minSize = maxSizeInteger
    this.maxSizeInteger = maxSizeInteger
    this.maxSize = this.getRandomValue(this.minSize, this.maxSizeInteger)
    this.delay = delay
    this.counter = 0
    this.counterStep = Math.random() * 4 + (this.width + this.height) * 0.01
    this.isIdle = false
    this.isReverse = false
    this.isShimmer = false
  }

  getRandomValue(min, max) {
    return Math.random() * (max - min) + min
  }

  draw() {
    const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5
    this.ctx.fillStyle = this.color
    this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size)
  }

  appear() {
    this.isIdle = false
    if (this.counter <= this.delay) {
      this.counter += this.counterStep
      return
    }
    if (this.size >= this.maxSize) this.isShimmer = true
    if (this.isShimmer) {
      this.shimmer()
    } else {
      this.size += this.sizeStep
    }
    this.draw()
  }

  disappear() {
    this.isShimmer = false
    this.counter = 0
    if (this.size <= 0) {
      this.isIdle = true
      return
    } else {
      this.size -= 0.1
    }
    this.draw()
  }

  shimmer() {
    if (this.size >= this.maxSize) {
      this.isReverse = true
    } else if (this.size <= this.minSize) {
      this.isReverse = false
    }
    this.size += this.isReverse ? -this.speed : this.speed
  }
}

/**
 * Scale `speed` into a per-frame increment.
 *
 * Reduced motion pins this to 0, which stops the shimmer from ever reaching
 * `maxSize` — the squares still appear and disappear in response to the
 * pointer, but they no longer pulse. The response to the pointer is direct
 * manipulation, so it is kept; the looping pulse is not asked for, so it goes.
 */
function getEffectiveSpeed(value, reducedMotion) {
  const max = 100
  const throttle = 0.001
  if (value <= 0 || reducedMotion) return 0
  if (value >= max) return max * throttle
  return value * throttle
}

const containerRef = ref(null)
const canvasRef = ref(null)

let pixels = []
let animationId = null
let timePrevious = performance.now()
let resizeObserver = null

const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const variantCfg = computed(() => VARIANTS[props.variant] || VARIANTS.default)
const finalGap = computed(() => props.gap ?? variantCfg.value.gap)
const finalSpeed = computed(() => props.speed ?? variantCfg.value.speed)
const finalNoFocus = computed(() => props.noFocus ?? variantCfg.value.noFocus)

function initPixels() {
  if (!containerRef.value || !canvasRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  const width = Math.floor(rect.width)
  const height = Math.floor(rect.height)
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx || !width || !height) return

  canvasRef.value.width = width
  canvasRef.value.height = height
  canvasRef.value.style.width = `${width}px`
  canvasRef.value.style.height = `${height}px`

  const palette = (props.colors || '').split(',').filter(Boolean)
  if (!palette.length) return

  const gap = parseInt(finalGap.value.toString(), 10)
  const speed = getEffectiveSpeed(finalSpeed.value, reducedMotion)
  const next = []

  for (let x = 0; x < width; x += gap) {
    for (let y = 0; y < height; y += gap) {
      const color = palette[Math.floor(Math.random() * palette.length)]

      const dx = x - width / 2
      const dy = y - height / 2
      const distance = Math.sqrt(dx * dx + dy * dy)
      const delay = reducedMotion ? 0 : distance

      next.push(new Pixel(canvasRef.value, ctx, x, y, color, speed, delay, props.dotSize))
    }
  }

  pixels = next
}

function doAnimate(fnName) {
  animationId = requestAnimationFrame(() => doAnimate(fnName))
  const timeNow = performance.now()
  const timePassed = timeNow - timePrevious
  const timeInterval = 1000 / 60

  // Hold the clock to 60fps so the motion is the same on a 120Hz display.
  if (timePassed < timeInterval) return
  timePrevious = timeNow - (timePassed % timeInterval)

  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!ctx || !canvas) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  let allIdle = true
  for (let i = 0; i < pixels.length; i++) {
    const pixel = pixels[i]
    pixel[fnName]()
    if (!pixel.isIdle) allIdle = false
  }

  // Nothing left to move: stop burning frames until the next pointer event.
  if (allIdle && animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}

function handleAnimation(name) {
  if (animationId !== null) cancelAnimationFrame(animationId)
  animationId = requestAnimationFrame(() => doAnimate(name))
}

const onMouseEnter = () => handleAnimation('appear')
const onMouseLeave = () => handleAnimation('disappear')

/**
 * Focus is the same gesture as hover, so the card also answers the keyboard.
 *
 * The `relatedTarget` guard stops the animation retriggering when focus moves
 * between two things inside the card — without it, tabbing within would flicker
 * the field off and on.
 */
const onFocus = (e) => {
  if (e.currentTarget?.contains?.(e.relatedTarget)) return
  handleAnimation('appear')
}
const onBlur = (e) => {
  if (e.currentTarget?.contains?.(e.relatedTarget)) return
  handleAnimation('disappear')
}

/*
  Rebuild the grid when anything that decides its shape changes.

  `() => props.colors` rather than a cached computed: a `computed` declared below
  this line would be in its temporal dead zone here, and referencing it threw
  `Cannot access 'finalColorsSource' before initialization` on every render. The
  inline getter is equivalent here — Vue compares the result — and has no ordering
  constraint.
*/
watch([finalGap, finalSpeed, () => props.colors, () => props.dotSize, finalNoFocus], () => {
  initPixels()
})

onMounted(() => {
  initPixels()
  resizeObserver = new ResizeObserver(() => initPixels())
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (animationId !== null) cancelAnimationFrame(animationId)
})
</script>

<template>
  <!--
    `absolute inset-0` and behind whatever is layered on top: this is a backdrop,
    so it takes no part in the layout. `pointer-events-none` keeps the
    photograph above it fully clickable and hoverable — without it the canvas
    swallows the pointer and the effect never triggers.
  -->
  <div
    ref="containerRef"
    :class="['pointer-events-none absolute inset-0 isolate select-none', className]"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @focus="finalNoFocus ? undefined : onFocus"
    @blur="finalNoFocus ? undefined : onBlur"
    :tabindex="finalNoFocus ? -1 : 0"
    aria-hidden="true"
  >
    <canvas ref="canvasRef" class="block h-full w-full"></canvas>
    <slot></slot>
  </div>
</template>