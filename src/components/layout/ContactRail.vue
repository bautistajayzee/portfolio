<script setup>
import { profile, social } from '../../data/portfolio.js'

/**
 * The rail's footer: how to reach him, one row per channel.
 *
 * The layout is the reference one — a short lead-in line, then a stacked list
 * where each row pairs a glyph with a handle rather than a full URL. What is not
 * copied is the styling: that reads as a list of buttons with icons and a
 * weight on each one, which is a different language from this site. Here the
 * glyph is a small outline mark in the same grey as every other status line in
 * the rail, the handle is set in the site mono, and the accent only appears on
 * hover — so the block sits in the rail rather than advertising itself.
 *
 * `social` carries `icon` and `short` for exactly this. The paths live here
 * rather than in the data because `portfolio.js` is content: it should be
 * readable on its own, and it has to stay serialisable for the audits.
 *
 * `aria-hidden` on every glyph. These are the third icon in a row that already
 * says what it is, and a screen reader announcing "Instagram logo" before
 * "instagram" is noise, not information.
 */
const GLYPHS = {
  mail: ['M3 6.5h18v11H3z', 'm3.4 7 8.6 6 8.6-6'],
  github: [
    'M9 19c-4 1.2-4-2.2-5.5-2.7M15 21v-3.4a2.9 2.9 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6 0C6.4 2.6 5.4 2.9 5.4 2.9a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.3c0 4.7 2.8 5.7 5.5 6a2.9 2.9 0 0 0-.8 2.3V21',
  ],
  linkedin: [
    'M15.5 8.5a4.6 4.6 0 0 1 4.5 4.5v6M4.5 9.5V19',
    'M4.5 4.5v.01',
    'M10 19v-5.2a2.3 2.3 0 0 1 4.6 0V19',
  ],
  instagram: [
    'M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4Z',
    'M16.2 7.8h.01',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  ],
}
</script>

<template>
  <div class="border-t border-line pt-5">
    <!--
      Sentence case in the sans, not `.meta`.

      `.meta` is the rail's label style: uppercase, mono, 0.14em of tracking.
      Right for a two-word tag, wrong here twice over — it turns a sentence
      into three lines in a 168px column, and it uppercases what follows, which
      for an email address is a broken read and for a handle is something nobody
      types.
    -->
    <p class="text-[0.6875rem] leading-[1.45] text-n-400">
      For work, collabs &amp; everything else, reach me at
    </p>

    <ul class="mt-2 flex flex-col gap-[2px]">
      <li>
        <!--
          `min-h-[24px]` on every row. The rows are visually compact on purpose,
          but Lighthouse's target-size audit measures the hit box rather than the
          ink, and at 11px mono on `leading-tight` these were 16px tall against
          a 24px minimum. Padding was tried first and pushed the block 32px
          taller than the rail had to give; a minimum height centres the glyph in
          the same box instead, so the list grows by 8px a row rather than by
          the whole padded height.
        -->
        <a
          :href="`mailto:${profile.email}`"
          class="group -ml-1.5 flex min-h-[24px] items-center gap-2 pl-1.5 text-n-500 transition-colors hover:text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            class="h-3.5 w-3.5 shrink-0 text-n-400 transition-colors group-hover:text-accent"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path v-for="d in GLYPHS.mail" :key="d" :d="d" />
          </svg>
          <span class="font-mono text-[0.6875rem] leading-tight tracking-tight break-all text-n-400 transition-colors group-hover:text-n-600">{{ profile.email }}</span>
        </a>
      </li>

      <li v-for="item in social" :key="item.label">
        <a
          :href="item.href"
          class="group -ml-1.5 flex min-h-[24px] items-center gap-2 pl-1.5 text-n-500 transition-colors hover:text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            class="h-3.5 w-3.5 shrink-0 text-n-400 transition-colors group-hover:text-accent"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path v-for="(d, i) in GLYPHS[item.icon]" :key="i" :d="d" />
          </svg>
          <span class="font-mono text-[0.6875rem] leading-tight tracking-tight text-n-400 transition-colors group-hover:text-n-600">{{ item.short }}</span>
        </a>
      </li>
    </ul>
  </div>
</template>