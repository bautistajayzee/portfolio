<script setup>
import ThemeSwitch from '../ui/ThemeSwitch.vue'
import { useClock } from '../../composables/useClock.js'
import { useViewers } from '../../composables/useViewers.js'
import { profile } from '../../data/portfolio.js'

defineProps({
  sections: { type: Array, required: true },
  active: { type: String, default: '' },
})

/**
 * Live viewer count. Renders nothing at all until the function has answered —
 * see `useViewers` for why an unknown count must not be guessed.
 */
const { count, label } = useViewers()
const { time, date, zone } = useClock()
</script>

<template>
  <!--
    Fixed left rail, desktop only. Everything else on the page aligns to
    its right edge, so the rail doubles as the grid's first column.
  -->
  <nav
    class="fixed inset-y-0 left-0 z-50 hidden w-[var(--rail-w)] flex-col border-r border-line bg-paper px-7 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] lg:flex"
    aria-label="Sections"
  >
    <a href="#home" class="group w-fit leading-none">
      <span class="block text-[0.9375rem] font-semibold tracking-[-0.02em] group-hover:text-n-500">
        {{ profile.firstName }} {{ profile.lastName }}
      </span>
      <span class="meta mt-2 block text-n-400">Portfolio — 2026</span>
    </a>

    <ul class="mt-12 flex flex-1 flex-col gap-1">
      <li v-for="section in sections" :key="section.id">
        <a
          :href="`#${section.id}`"
          :aria-current="active === section.id ? 'true' : undefined"
          class="group flex items-baseline gap-3 py-[5px] text-[0.8125rem]"
          :class="active === section.id ? 'text-ink' : 'text-n-400 hover:text-ink'"
        >
          <span
            class="meta w-4 shrink-0 tabular-nums transition-colors"
            :class="active === section.id ? 'text-accent' : 'text-n-300 group-hover:text-n-400'"
          >
            {{ section.index }}
          </span>
          <span>{{ section.label }}</span>
        </a>
      </li>
    </ul>

    <!--
      Viewer count, pinned just above the footer rule.

      Set in the site's own mono at the same weight as every other status line in
      the rail. No `aria-live`: the number changes on a 30s poll, and announcing
      it would be noise in a screen reader for information nobody asked for.
      The glyph is decorative; the text is real and readable.
    -->
    <!--
      Local time, above the viewer count and the footer rule.

      Pinned to Manila and labelled with it — see `useClock`. Split over two
      lines because the rail is 168px of usable width and the full string on one
      line wraps into something ragged.
    -->
    <p class="mb-4 text-[0.6875rem] leading-tight">
      <span class="block text-n-600 tabular-nums">{{ time }}</span>
      <span class="mt-0.5 block text-n-400">{{ date }} · {{ zone }}</span>
    </p>

    <p
      v-if="count !== null"
      class="mb-5 flex items-center gap-2 text-[0.6875rem] leading-tight text-n-400"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        class="h-3.5 w-3.5 shrink-0 text-n-400"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="9.75" r="2.75" />
        <path d="M6.25 18.25a6.25 6.25 0 0 1 11.5 0" />
      </svg>
      <span><span class="font-medium tabular-nums text-n-600">{{ count }}</span> {{ label() }}</span>
    </p>

    <div class="border-t border-line pt-5">
      <div class="mb-4">
        <ThemeSwitch />
      </div>

      <!--
        The envelope labels the block rather than the address. Inside the link it
        was competing with a `break-all` address that already wraps to two lines
        in this column, and it read as part of the value instead of the caption.

        `text-n-400` to match the label beside it — it was `n-300`, a step
        lighter, so the glyph never looked like it belonged to the same line.
        Both are theme tokens, so it tracks the switch with the rest of the rail
        rather than being pinned to one grey.
      -->
      <div class="flex items-center gap-2">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          class="h-3.5 w-3.5 shrink-0 text-n-400"
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

      <a :href="`mailto:${profile.email}`" class="link-underline mt-2.5 block break-all text-[0.8125rem]">
        {{ profile.email }}
      </a>
    </div>
  </nav>
</template>
