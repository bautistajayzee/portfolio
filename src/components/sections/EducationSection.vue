<script setup>
import SectionHead from '../ui/SectionHead.vue'
import { education, sections } from '../../data/portfolio.js'

const head = sections.find((s) => s.id === 'education')
</script>

<template>
  <section id="education" data-section class="section border-t border-line">
    <div class="shell">
      <SectionHead
        v-reveal
        :index="head.index"
        :title="head.label"
        lead="Where the formal part of this is happening."
      />

      <div class="mt-14 md:mt-16">
        <article
          v-for="(entry, i) in education"
          :key="i"
          v-reveal="i * 90"
          class="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-line py-8 md:grid-cols-12 md:py-10"
        >
          <p class="meta pt-1 text-n-400 md:col-span-2 tabular-nums">{{ entry.period }}</p>

          <div class="md:col-span-7">
            <h3 class="max-w-[24rem] text-[clamp(1.125rem,2.2vw,1.4375rem)] font-medium leading-[1.25] tracking-[-0.018em]">
              {{ entry.title }}
            </h3>
            <p class="mt-3 text-[0.9375rem] text-n-600">{{ entry.institution }}</p>
            <p class="meta mt-2 text-n-300">{{ entry.detail }}</p>
            <p v-if="entry.note" class="mt-5 max-w-[34rem] text-[0.875rem] leading-[1.75] text-n-500">
              {{ entry.note }}
            </p>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
