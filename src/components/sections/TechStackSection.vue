<script setup>
import SectionHead from '../ui/SectionHead.vue'
import Rule from '../ui/Rule.vue'
import { sections, techStack } from '../../data/portfolio.js'

const head = sections.find((s) => s.id === 'stack')

/**
 * One outline glyph per discipline, on the 24-unit grid the rest of the site's
 * icons use. Keyed by the `icon` field on each group in `portfolio.js`.
 *
 * Why one per group and not one per technology
 *
 * There are 55 entries. Giving each its own mark turns the section into a badge
 * wall, which is the exact failure the layout below is built to avoid — and a
 * hand-drawn approximation of 55 third-party logos is a worse outcome still,
 * because a wrong mark is not a neutral mistake, it is a false claim about
 * which tool you use. Seven glyphs, drawn here, can be correct by
 * construction.
 *
 * What they mean is the discipline rather than the product: code, interface,
 * server, storage, frame, tool, intelligence. That is also the information a
 * reader actually wants at this level — the section groups by discipline, so
 * the icon repeating the grouping is confirming the structure, not decorating
 * it.
 */
const GLYPHS = {
  code: ['m8.5 6.5-5 5.5 5 5.5', 'm15.5 6.5 5 5.5-5 5.5'],
  window: ['M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V6A1.5 1.5 0 0 1 4 4.5Z', 'M2.5 9h19', 'M5.75 6.75h.01', 'M8.5 6.75h.01', 'M11.25 6.75h.01'],
  server: ['M4 4h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z', 'M4 14h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1Z', 'M6.5 7h.01', 'M6.5 17h.01'],
  database: ['M20 6c0 1.66-3.58 3-8 3s-8-1.34-8-3 3.58-3 8-3 8 1.34 8 3Z', 'M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6', 'M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3'],
  frame: ['M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V6A1.5 1.5 0 0 1 4 4.5Z', 'm10.5 8.75 5.25 3.25-5.25 3.25Z'],
  wrench: ['m14.6 4.4a5 5 0 0 0-4.6 6.9l-6.3 6.3a1.9 1.9 0 0 0 2.7 2.7l6.3-6.3a5 5 0 0 0 6.9-4.6l-3.3 3.3-2.6-.7-.7-2.6Z'],
  spark: ['M12 3.2c.85 4.15 1.7 5 5.85 5.85-4.15.85-5 1.7-5.85 5.85-.85-4.15-1.7-5-5.85-5.85C10.3 8.2 11.15 7.35 12 3.2Z'],
}
</script>

<template>
  <section id="stack" data-section class="section border-t border-line">
    <div class="shell">
      <SectionHead
        v-reveal
        :index="head.index"
        :title="head.label"
        lead="The tools and technologies I use across development, design, video editing, and AI — while continuing to learn and grow as a developer."
      />

      <!--
        Set as a left-label / right-tags list rather than a card grid.

        A grid of boxed cards would give every technology the same visual
        weight as the projects above, which is wrong — a tool is not an
        achievement, it is an instrument. Keeping it as text on the same
        hairline grid as the rest of the page says "this is a list, not a
        showcase", which is what it is.

        No brand logos. A wall of them reads as decoration and means nothing;
        the name in the site's own mono type is quieter and more legible than a
        24px icon would be. What each group does carry is one small outline
        glyph naming the discipline - see `GLYPHS` above for why it is one per
        group rather than one per entry.

        The group labels carry the accent, which is also what Experience does for
        its `<dt>` labels — so a label means the same thing everywhere on the
        site. They were on `n-300`, the dimmest step in the ramp, which at this
        size was doing more harm than good: the hierarchy it expressed was the
        difference between "quiet" and "too faint to read".
      -->
      <div class="mt-14 md:mt-16">
        <div v-for="(group, i) in techStack" :key="group.label" v-reveal="i * 60">
          <Rule ink />

          <div class="grid grid-cols-1 gap-x-8 gap-y-4 py-7 md:grid-cols-12 md:py-8">
            <div class="flex items-center gap-2.5 pt-2 md:col-span-3">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                class="h-[1.05rem] w-[1.05rem] shrink-0 text-n-300"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path v-for="(d, i) in GLYPHS[group.icon]" :key="i" :d="d" />
              </svg>
              <p class="meta text-accent">{{ group.label }}</p>
            </div>

            <ul class="flex flex-wrap gap-2 md:col-span-9">
              <li
                v-for="tech in group.items"
                :key="tech"
                class="border border-line px-3 py-1.5 font-mono text-[0.75rem] leading-none text-n-400 transition-colors duration-200 hover:border-ink hover:text-ink"
              >
                {{ tech }}
              </li>
            </ul>
          </div>
        </div>
        <Rule ink />
      </div>
    </div>
  </section>
</template>
