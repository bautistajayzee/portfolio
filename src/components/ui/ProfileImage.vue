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
        <!--
          This is the largest thing on the first screen, so it is the element a
          reader's eye lands on and almost certainly the LCP candidate. Two files
          exist for it and the wrong one was being fetched: 99 KB for a slot that
          renders 320 CSS px.

          The previous markup was a <picture> with two <source> elements keyed on
          `media="(max-width: 640px)"`, which picks a file by viewport width. That
          is a guess in place of the question the browser is already equipped to
          answer, and it guessed wrong in the common case: a 1446px desktop passes
          the query and gets the 850px file, but its slot is 320px at DPR 1, so
          2.7x the pixels were downloaded and thrown away. Measured - 99 KB
          requested, 318 CSS px drawn.

          `srcset`/`sizes` replaces the guess with the actual selection rule. The
          browser knows the device pixel ratio and can see the final slot, so it
          takes the smallest candidate that still covers it:

            DPR 1, 320px slot -> needs 320px  -> 600w, 43 KB
            DPR 2, 320px slot -> needs 640px  -> 850w, 99 KB

          The 99 KB is no longer wasted on a standard-DPI screen, and the file is
          no longer chosen by how wide the window happens to be. `sizes` mirrors
          the wrapper in HomeSection: `max-w-[17rem]` below `md`, and the `20rem`
          default on this component above it.

          It is a plain <img> rather than a <picture> because there is nothing
          left to branch on - both candidates are WebP, so a <picture> would only
          add a wrapper around a single answer. `v-if` and `v-else` are adjacent
          siblings here, which Vue requires; when this was a <picture> holding the
          <img>, they were not, and that is a build error rather than a runtime
          one, so the browser could never have caught it.

          One thing to know before changing this. The selection cannot be
          verified from the automation browser, because it is not self-consistent:
          two element constructions that differ only in whether `sizes` is
          assigned as a property or as an attribute, same viewport, same device
          pixel ratio, same 318px slot, returned the 42 KB file and the 96 KB file
          respectively - and on a repeat of the earlier construction it then
          returned the 96 KB file. That is the browser disagreeing with itself, so
          no measurement taken here can settle it.

          What can be said is that the markup is the standard one, that its
          failure mode is benign if a browser ignores `sizes` (it then picks
          between the two declared widths rather than fetching something larger),
          and that the saving being aimed at is real: 96 KB requested for a slot
          that renders 318 CSS px. Confirming the 54 KB on a real browser is
          worth two minutes and nothing else here can substitute for it.
        -->
        <img
          v-if="photoOk"
          srcset="/photo-600.webp 600w, /photo.webp 850w"
          sizes="(min-width: 768px) 20rem, 17rem"
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
