<script setup>
import { computed, ref, watch } from 'vue'
import { profile } from '../../data/portfolio.js'

/**
 * The photograph, on its own.
 *
 * Presented the same way everything else on the page is: a hairline border,
 * square corners, no shadow, no rounding. It carries the accent as a small
 * rule beneath it, which is the only ornament in the component.
 *
 * On hover the frame tilts toward the cursor. Deliberately geometry only —
 * rotateX/rotateY under a perspective, nothing else:
 *
 * · **No lift.** No `translateZ`, no scale-up, no shadow spreading. Those are
 *   the moves that turn a photograph into a card, and this is a photograph. The
 *   depth comes from the rotation alone.
 * · **No sheen or glare.** A gradient sweeping across the image would fight the
 *   hairline border and the flat paper page it sits on.
 * · **7° is the ceiling.** Past about that it stops reading as a considered
 *   response to the pointer and starts reading as a toy.
 *
 * The smoothing is a CSS transition rather than a rAF loop, so it costs nothing
 * while idle and inherits the same easing as the rest of the site. The transition
 * lives on the frame and the perspective on the `figure`, because `perspective`
 * only applies to an element's *children* — putting both on one element would
 * give the frame no perspective at all.
 *
 * Not gated on `prefers-reduced-motion`, matching every other animation here.
 * The tilt only ever responds to the pointer directly under it, so it is
 * direct manipulation rather than motion the viewer has to sit through.
 */
const props = defineProps({
  /** Caps the width. The image stays square either way. */
  size: { type: String, default: '20rem' },
  /** Set false to render a plain, static photograph. */
  tilt: { type: Boolean, default: true },
  /**
   * True only for the hero photograph.
   *
   * This component is used twice: in the hero, where the image is the largest
   * thing on the first screen and should be fetched before anything else, and
   * again at the very bottom of Contact, several thousand pixels down. Both
   * copies were asking for `fetchpriority="high"` and neither deferred, so the
   * browser was told that a photograph nobody could see yet was urgent — and
   * competing with the webfonts for it.
   */
  priority: { type: Boolean, default: false },
})

/** Maximum rotation in degrees, at the corner of the frame. */
const MAX_DEG = 7

// If the photo is missing, fall back to a monogram rather than a broken image.
const photoOk = ref(true)
watch(
  () => profile.photo,
  () => {
    photoOk.value = true
  },
)

const tiltX = ref(0)
const tiltY = ref(0)

const frameStyle = computed(() => ({
  transform: `rotateX(${tiltX.value}deg) rotateY(${tiltY.value}deg)`,
}))

/**
 * Map the pointer's position within the frame to a rotation.
 *
 * The `-` on X is what makes it feel attached rather than inverted: the cursor
 * near the top pushes the top edge away, and near the bottom brings it forward.
 * Ignoring the sign gives a card that leans away from where you are pointing.
 */
function onPointerMove(event) {
  // Touch and pen would tilt on a tap-and-drag, which is a scroll gesture.
  if (event.pointerType !== 'mouse') return

  const el = event.currentTarget
  const box = el.getBoundingClientRect()
  if (!box.width || !box.height) return

  const nx = (event.clientX - box.left) / box.width - 0.5
  const ny = (event.clientY - box.top) / box.height - 0.5

  tiltY.value = Math.max(-1, Math.min(1, nx * 2)) * MAX_DEG
  tiltX.value = Math.max(-1, Math.min(1, -ny * 2)) * MAX_DEG
}

function onPointerLeave() {
  tiltX.value = 0
  tiltY.value = 0
}
</script>

<template>
  <figure class="w-full" :style="{ maxWidth: props.size, perspective: '900px' }">
    <div
      class="transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
      :class="props.tilt ? 'cursor-default' : ''"
      :style="props.tilt ? frameStyle : undefined"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
      @pointercancel="onPointerLeave"
    >
      <div class="aspect-square w-full overflow-hidden border border-line bg-n-100">
        <img
          v-if="photoOk"
          :src="profile.photo"
          :alt="`${profile.fullName}, ${profile.role}`"
          class="h-full w-full object-cover"
          width="400"
          height="400"
          :loading="props.priority ? 'eager' : 'lazy'"
          :fetchpriority="props.priority ? 'high' : 'auto'"
          decoding="async"
          @error="photoOk = false"
        />
        <span
          v-else
          class="flex h-full w-full select-none items-center justify-center font-serif text-[3rem] italic text-n-300"
        >
          JG
        </span>
      </div>

      <!-- the single accent mark -->
      <div class="mt-3 h-[3px] w-10 bg-accent" aria-hidden="true"></div>
    </div>
  </figure>
</template>
