<script setup>
import { nextTick, ref, watch } from 'vue'
import ThemeSwitch from '../ui/ThemeSwitch.vue'
import { lockScroll, unlockScroll } from '../../composables/useSmoothScroll.js'
import { profile } from '../../data/portfolio.js'

const props = defineProps({
  sections: { type: Array, required: true },
  open: { type: Boolean, default: false },
  active: { type: String, default: '' },
})

const emit = defineEmits(['update:open'])
const closeButton = ref(null)
const openButton = ref(null)
let lastFocused = null

function close() {
  emit('update:open', false)
}

/**
 * Release the page *before* the click finishes bubbling.
 *
 * The menu locks scrolling with `overflow: hidden`, and Vue's watcher runs on
 * the next microtask — so without this the browser would try to follow the
 * link while the scrollport was still locked, and the jump would be swallowed.
 * Clearing it synchronously makes the link work on the very first click.
 */
function followLink() {
  unlockScroll()
  close()
}

function onKeydown(event) {
  if (event.key === 'Escape') close()
}

// Lock the page behind the overlay, and hand focus back where it came from.
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      lastFocused = document.activeElement
      lockScroll()
      await nextTick()
      closeButton.value?.focus()
    } else {
      unlockScroll()
      // The burger first, not `lastFocused`.
      //
      // Capturing `document.activeElement` is the obvious approach and it is
      // unreliable exactly where this matters: iOS Safari does not move focus
      // to a button when it is tapped, so on an iPhone `lastFocused` is `<body>`
      // and the restore silently does nothing, dumping keyboard and switch-control
      // users at the top of the document. The element that opened the menu is
      // known, so focus it directly and keep the capture only as a fallback for
      // the case where this component was opened from somewhere else entirely.
      const target = openButton.value ?? lastFocused
      target?.focus?.()
    }
  },
)
</script>

<template>
  <!-- Top bar, below the lg breakpoint. -->
  <!--
    `inert` while the menu is open. This bar is `z-40` under the menu's `z-50`,
    so its burger and name are invisible while the menu is up — but Tab is a
    document walk, not a visual one, and would happily move focus into something
    nobody can see. The full-screen menu lives in this same component but
    further down, and must stay interactive.
  -->
  <header
    class="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-md lg:hidden"
    :inert="open || undefined"
  >
    <div class="mx-auto flex max-w-[62rem] items-center justify-between px-6 pb-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] sm:px-8">
      <a href="#home" class="text-[0.9375rem] font-semibold tracking-[-0.02em]">
        {{ profile.shortName }}
      </a>
      <button
        ref="openButton"
        type="button"
        class="-mr-1.5 p-1.5 text-n-600 hover:text-ink"
        aria-label="Open menu"
        :aria-expanded="open"
        aria-controls="mobile-menu"
        @click="emit('update:open', true)"
      >
        <svg viewBox="0 0 24 24" fill="none" class="h-5 w-5" aria-hidden="true">
          <path
            d="M3.5 7.5h17M3.5 12h17M3.5 16.5h17"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  </header>

  <!--
    Full-screen menu. It stays in the DOM and is hidden with opacity +
    pointer-events rather than `visibility`, because a visibility transition
    out of `hidden` does not resolve reliably. `inert` keeps the links
    unfocusable while it is closed.

    Height is set in the stylesheet, not here. `inset-0` sizes a fixed element to
    the *layout* viewport, which on a phone is taller than what you can actually
    see once the browser's URL bar is showing — so the last rows, the theme
    switch and the email address, sat below the fold with no scrollbar to
    indicate it. `100dvh` tracks the visible area as that bar collapses.
  -->
  <div
    id="mobile-menu"
    class="fixed inset-x-0 top-0 z-50 flex flex-col bg-paper transition-opacity duration-[260ms] ease-out lg:hidden"
    :class="open ? 'is-open opacity-100' : 'pointer-events-none opacity-0'"
    :aria-hidden="!open"
    :inert="!open || undefined"
    @keydown="onKeydown"
  >
    <!--
      `pt` uses `max()` against the notch inset. `viewport-fit=cover` in the
      viewport meta lets the page run edge to edge, which is what makes the
      inset non-zero and worth honouring — without it these all resolve to 0
      and cost nothing.
    -->
    <div class="flex items-center justify-between border-b border-line px-6 pb-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] sm:px-8">
      <span class="text-[0.9375rem] font-semibold tracking-[-0.02em]">
        {{ profile.shortName }}
      </span>
      <button
        ref="closeButton"
        type="button"
        class="-mr-1.5 p-1.5 text-n-600 hover:text-ink"
        aria-label="Close menu"
        @click="close"
      >
        <svg viewBox="0 0 24 24" fill="none" class="h-5 w-5" aria-hidden="true">
          <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!--
      `overscroll-contain` stops the list handing a flick to the page behind it.
      The page is scroll-locked, so without it the gesture is swallowed by the
      locked scrollport instead of moving the list — which reads as the menu
      being stuck. The bottom padding clears the home indicator.
    -->
    <nav
      class="flex-1 overflow-y-auto overscroll-contain px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-8 sm:px-8 sm:pt-10"
      aria-label="Sections"
    >
      <ul class="flex flex-col">
        <li
          v-for="(section, i) in sections"
          :key="section.id"
          class="border-b border-line last:border-b-0"
        >
          <a
            :href="`#${section.id}`"
            class="mnav-item flex items-baseline gap-4 py-4"
            :style="open ? { transitionDelay: `${80 + i * 45}ms` } : null"
            @click="followLink"
          >
            <span class="meta w-6 shrink-0 tabular-nums" :class="active === section.id ? 'text-accent' : 'text-n-300'">
              {{ section.index }}
            </span>
            <span class="text-[1.375rem] font-medium tracking-[-0.02em]" :class="active === section.id ? 'text-ink' : 'text-n-700'">
              {{ section.label }}
            </span>
          </a>
        </li>
      </ul>

      <div class="mt-12">
        <div class="mb-6">
          <ThemeSwitch />
        </div>

        <div class="flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            class="h-4 w-4 shrink-0 text-n-400"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
            <path d="M3.5 7.5 12 13.5l8.5-6" />
          </svg>
          <p class="meta text-n-400">Get in touch</p>
        </div>

        <a :href="`mailto:${profile.email}`" class="link-underline mt-3 block break-all text-[0.9375rem]">
          {{ profile.email }}
        </a>
      </div>
    </nav>
  </div>
</template>

<style scoped>
/*
  The visible viewport, not the layout one.

  `inset-0` was wrong for a phone: a fixed element sized that way fills the
  *layout* viewport, which is taller than the screen once the browser's URL bar
  is in play. The menu then had content below the visible area and nothing to
  scroll to it with.

  `100vh` first as a fallback — `dvh` is unsupported on anything older than
  roughly 2022, and an unknown value in a `height` declaration is simply
  dropped, which would have collapsed the menu to zero height.
*/
#mobile-menu {
  height: 100vh;
  height: 100dvh;
}

/* The links rise a few pixels behind the overlay's own fade. */
.mnav-item {
  opacity: 0;
  transform: translateY(10px);
  transition:
    opacity 0.45s var(--ease-expo),
    transform 0.5s var(--ease-expo),
    color 0.18s ease;
}

#mobile-menu.is-open .mnav-item {
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .mnav-item {
    opacity: 1;
    transform: none;
  }
}
</style>
