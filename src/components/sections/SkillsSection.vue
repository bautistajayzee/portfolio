<script setup>
import SectionHead from '../ui/SectionHead.vue'
import Rule from '../ui/Rule.vue'
import { sections, skills } from '../../data/portfolio.js'

const head = sections.find((s) => s.id === 'skills')
</script>

<template>
  <section id="skills" data-section class="section border-t border-line">
    <div class="shell">
      <SectionHead
        v-reveal
        :index="head.index"
        :title="head.label"
        lead="What I can actually do, and what I have actually practised."
      />

      <!--
        Skills are set as large type rather than chips. Four things don't need
        to be a grid of rounded boxes, and setting them big keeps the page
        honest about how little there is here.
      -->
      <div class="mt-14 md:mt-16">
        <div
          v-for="(skill, i) in skills"
          :key="skill.name"
          v-reveal="i * 80"
        >
          <Rule ink />
          <div class="grid grid-cols-1 gap-x-8 gap-y-3 py-7 md:grid-cols-12 md:py-8">
            <p class="meta pt-2 text-n-300 md:col-span-2 tabular-nums">
              {{ String(i + 1).padStart(2, '0') }}
            </p>
            <h3 class="text-[clamp(1.375rem,3.6vw,2rem)] font-medium leading-[1.1] tracking-[-0.026em] md:col-span-4">
              {{ skill.name }}
            </h3>
            <p class="max-w-[28rem] self-center text-[0.9375rem] leading-[1.7] text-n-500 md:col-span-5 md:col-start-8">
              {{ skill.detail }}
            </p>
          </div>
        </div>
        <Rule ink />
      </div>

      <p v-reveal="360" class="mt-9 max-w-[34rem] text-[0.875rem] leading-[1.75] text-n-400">
        The design and video work is where the years went. The programming came
        later, out of coursework — the tools are listed in the next section, and
        the systems built with them are below that.
      </p>
    </div>
  </section>
</template>
