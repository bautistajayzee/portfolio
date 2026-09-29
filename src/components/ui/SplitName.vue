<script setup>
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useTypewriter } from '../../composables/useTypewriter.js'

/**
 * The masthead: the name, typed out one line at a time.
 *
 * All of the typing behaviour lives in `useTypewriter` — the same engine the
 * section titles use, so the two can never drift apart. This component is only
 * concerned with the shape of the masthead: two lines, the second in serif
 * italic, and a key that restarts the whole thing.
 */
const props = defineProps({
  lines: { type: Array, required: true },
  replayKey: { type: Number, default: 0 },
})

const { setLine, setCaret, start, stop } = useTypewriter(() => props.lines)

onMounted(start)

// Re-typing the name on every click of the rail's wordmark is the whole point
// of `replayKey`; the wrapper's key also forces fresh line elements.
watch(() => props.replayKey, start)
onBeforeUnmount(stop)
</script>

<template>
  <h1
    class="text-[clamp(2.5rem,7.6vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.038em]"
    :aria-label="lines.join(' ')"
  >
    <span
      v-for="(line, i) in lines"
      :key="`${replayKey}-${i}`"
      class="type-wrap"
    >
      <span
        :ref="(el) => setLine(i, el)"
        class="type-line"
        :class="i === 1 ? 'font-serif font-normal italic tracking-[-0.012em]' : ''"
      >{{ line }}</span>

      <!-- a real element, not a pseudo: it has to be positioned from script -->
      <span
        v-if="i === lines.length - 1"
        :ref="setCaret"
        class="type-caret"
        aria-hidden="true"
      ></span>
    </span>
  </h1>
</template>
