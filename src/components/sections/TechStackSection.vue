<script setup>
import SectionHead from '../ui/SectionHead.vue'
import Rule from '../ui/Rule.vue'
import { sections, techStack } from '../../data/portfolio.js'

const head = sections.find((s) => s.id === 'stack')
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

        No logos. A wall of brand marks reads as decoration and means nothing;
        the name in the site's own mono type is both quieter and more legible
        than a 24px icon would be.

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
            <p class="meta pt-2 text-accent md:col-span-3">{{ group.label }}</p>

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
