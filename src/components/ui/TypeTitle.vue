<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useCipher } from '../../composables/useCipher.js'

/**
 * A section title that resolves out of a cipher as it scrolls into view.
 *
 * The hero masthead can animate on load because it is already on screen. A
 * section title cannot — scrambling eight titles the moment the page paints
 * would be a cut-and-paste reel. So this waits for its own IntersectionObserver,
 * and unlike the reveal observer in `useReveal` it **stays connected**: the
 * title replays every time it comes back into view. That matches the masthead,
 * which replays on every return to `#home`.
 *
 * Two details that are load-bearing rather than cosmetic:
 *
 * · **The threshold is low on purpose.** It was `0.6`, which meant a title had
 *   to be 60% visible to fire. These titles are about 36px tall, and the smooth
 *   scroll tween moves fast enough to carry one across the viewport in fewer
 *   frames than that takes to register — so a sidebar jump could skip a title
 *   entirely and, with a fire-once observer, lose its effect for the whole
 *   session. Silently. `0.3` cannot be outrun that way.
 * · **There is a cooldown.** Without one, a title resting on the threshold
 *   boundary re-triggers on every scroll event and the page strobes.
 *
 * Unlike the masthead there is no caret here. A caret marks the position being
 * typed, and a cipher scrambles every position at once — there is no position
 * for it to point at.
 *
 * All eight section headings share `SectionHead`, so this one component covers
 * the whole page.
 */
const props = defineProps({
  text: { type: String, required: true },
  as: { type: String, default: 'h2' },
})

const host = ref(null)
const chars = computed(() => [...props.text])

const { setCell, start, stop } = useCipher(() => props.text, {
  duration: 700,
})

/**
 * How long a title must stay out of sight before it is allowed to replay.
 *
 * Longer than the effect itself, so a title can never interrupt its own run,
 * and short enough that a deliberate scroll back down still feels immediate.
 */
const COOLDOWN = 1100

let io = null

onMounted(() => {
  // No observer support, or nothing to observe: just resolve it.
  if (typeof IntersectionObserver === 'undefined' || !host.value) return start()

  let lastRun = 0

  io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue

        const now = performance.now()
        if (now - lastRun < COOLDOWN) continue
        lastRun = now

        start()
      }
    },
    {
      // Once the title is properly on screen, not merely grazing the fold.
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.3,
    },
  )

  io.observe(host.value)
})

onBeforeUnmount(() => {
  io?.disconnect()
  io = null
  stop()
})
</script>

<template>
  <component :is="as" ref="host" :aria-label="text">
    <span class="type-wrap">
      <span
        v-for="(char, i) in chars"
        :key="i"
        :ref="(el) => setCell(i, el)"
        class="cipher-cell"
      >{{ char }}</span>
    </span>
  </component>
</template>
