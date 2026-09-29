<script setup>
import SectionHead from '../ui/SectionHead.vue'
import { experience, sections } from '../../data/portfolio.js'

const head = sections.find((s) => s.id === 'experience')
</script>

<template>
  <section id="experience" data-section class="section border-t border-line">
    <div class="shell">
      <SectionHead
        v-reveal
        :index="head.index"
        :title="head.label"
        lead="Work I have already been paid to do."
      />

      <div class="mt-14 md:mt-16">
        <article
          v-for="(role, i) in experience"
          :key="i"
          v-reveal="i * 90"
          class="border-t border-line py-8 md:py-10"
        >
          <div class="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-12">
            <p class="meta pt-1.5 text-n-400 md:col-span-2 tabular-nums">{{ role.period }}</p>

            <div class="md:col-span-7">
              <h3 class="max-w-[26rem] text-[clamp(1.125rem,2.2vw,1.4375rem)] font-medium leading-[1.25] tracking-[-0.018em]">
                {{ role.title }}
              </h3>
              <p class="meta mt-3 text-n-400">{{ role.organisation }}</p>
              <p class="mt-5 max-w-[32rem] text-[0.9375rem] leading-[1.75] text-n-500">
                {{ role.summary }}
              </p>
            </div>
          </div>

          <!-- what the work actually involved -->
          <dl class="mt-10 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
            <div
              v-for="(point, j) in role.points"
              :key="point.label"
              v-reveal="120 + j * 70"
              class="border-t border-line pt-4"
            >
              <dt class="meta text-accent">{{ point.label }}</dt>
              <dd class="mt-2.5 max-w-[18rem] text-[0.875rem] leading-[1.7] text-n-600">
                {{ point.detail }}
              </dd>
            </div>
          </dl>
        </article>
      </div>
    </div>
  </section>
</template>
