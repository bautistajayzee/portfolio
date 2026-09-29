<script setup>
import { computed } from 'vue'
import { useTheme } from '../../composables/useTheme.js'

/**
 * A three-way theme switch: follow the system, force light, force dark.
 *
 * A single accent thumb slides between the three slots rather than each button
 * carrying its own fill. One travelling element is what makes the change read as
 * movement along a track; three independently-toggling backgrounds just swap.
 *
 * The glyph colour follows the theme with the thumb — `text-paper` over the
 * accent, not `text-ink`, which would put near-black on near-black in dark mode.
 * Both directions clear 4.5:1 because the accent is defined per theme against its
 * own paper.
 *
 * The `is-switching` class is what makes the change feel deliberate — it
 * enables a short colour crossfade on everything under <html>, and is left off
 * when the click does not actually change anything, so the page does not
 * shimmer for no reason.
 */
const { preference, set, isSwitching } = useTheme()

const options = [
  {
    value: 'system',
    label: 'System theme',
    icon: 'M3 4.5h18v12H3zM9 20.5h6M12 16.5v4',
  },
  {
    value: 'light',
    label: 'Light theme',
    icon: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4',
  },
  {
    value: 'dark',
    label: 'Dark theme',
    icon: 'M20.5 13.8A8.5 8.5 0 1 1 10.2 3.5a6.7 6.7 0 0 0 10.3 10.3z',
  },
]

function choose(value) {
  if (value === preference.value) return

  const wasDark = document.documentElement.classList.contains('dark')
  const willBeDark = value === 'dark' || (value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  if (isSwitching(wasDark, willBeDark)) {
    const root = document.documentElement
    root.classList.add('is-switching')
    window.setTimeout(() => root.classList.remove('is-switching'), 320)
  }

  set(value)
}

/**
 * Which slot the thumb is currently over.
 *
 * Positioned with `translateX` rather than measured from the DOM, because all
 * three slots are a fixed 26px with a fixed 2px gap — so the offset is exactly
 * `index * (button + gap)` and needs no layout read, no resize observer, and no
 * flash on first paint. If the button size or gap ever changes, the `0.125rem`
 * below has to change with it; that is the one coupling in the component.
 */
const activeIndex = computed(() => options.findIndex((o) => o.value === preference.value))
</script>

<template>
  <div
    class="relative inline-flex items-center gap-0.5 rounded-full border border-line bg-n-50 p-[3px]"
    role="group"
    aria-label="Theme"
  >
    <!--
      The sliding thumb. One element, translated to the active slot, so the
      accent travels between options instead of jumping.

      `pointer-events-none` so it never intercepts a click meant for the button
      underneath, and `aria-hidden` because the state is already carried by each
      button's `aria-pressed` — announcing it twice would be noise.
    -->
    <span
      aria-hidden="true"
      class="pointer-events-none absolute left-[3px] top-[3px] h-[26px] w-[26px] rounded-full bg-accent transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
      :style="{ transform: `translateX(calc(${activeIndex} * (100% + 0.125rem)))` }"
    ></span>

    <!--
      Each option is a 26px disc, which is left alone deliberately.

      An invisible ring would be the obvious way to reach a 44px target, but the
      three sit 2px apart: expanding each by 9px per side makes adjacent hit
      areas overlap by 16px, and the overlap is awarded to whichever is later in
      the DOM. Each disc would get ~28px of *reliable* target instead of the 26
      it has now — a net loss dressed up as an improvement.

      26px clears WCAG 2.2 AA (2.5.8 asks for 24x24). The 44px figure is Apple
      HIG guidance and WCAG AAA, and a three-up segmented control at 44px would
      be 144px wide — a third of a phone. The burger and the close button, which
      have no such neighbour problem, do carry the ring.
    -->
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="relative grid h-[26px] w-[26px] place-items-center rounded-full transition-colors duration-200"
      :class="
        preference === option.value
          ? 'text-paper'
          : 'text-n-400 hover:text-ink'
      "
      :title="option.label"
      :aria-label="option.label"
      :aria-pressed="preference === option.value"
      @click="choose(option.value)"
    >
      <svg
        viewBox="0 0 24 24"
        class="h-[13px] w-[13px]"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path :d="option.icon" />
      </svg>
    </button>
  </div>
</template>
