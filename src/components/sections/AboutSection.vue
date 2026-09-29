<script setup>
import SectionHead from '../ui/SectionHead.vue'
import Rule from '../ui/Rule.vue'
import { about, sections } from '../../data/portfolio.js'

const head = sections.find((s) => s.id === 'about')
</script>

<template>
  <section id="about" data-section class="section border-t border-line">
    <div class="shell">
      <SectionHead v-reveal :index="head.index" :title="head.label" :lead="about.lead" />

      <div class="mt-14 grid grid-cols-1 gap-x-8 gap-y-12 md:mt-16 md:grid-cols-12">
        <!-- prose -->
        <div class="md:col-span-7">
          <p
            v-for="(paragraph, i) in about.body"
            :key="i"
            v-reveal="i * 80"
            class="mb-6 max-w-[36rem] text-[0.9375rem] leading-[1.8] text-n-600 last:mb-0"
          >
            {{ paragraph }}
          </p>
        </div>

        <!-- short facts, set against the prose -->
        <div class="md:col-span-4 md:col-start-9">
          <Rule />
          <dl class="mt-6">
            <div
              v-for="(fact, i) in about.facts"
              :key="fact.label"
              v-reveal="i * 70"
              class="border-b border-line py-3.5 last:border-b-0"
            >
              <dt class="meta text-n-400">{{ fact.label }}</dt>
              <dd class="mt-2 text-[0.875rem] leading-snug text-n-700">{{ fact.value }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </section>
</template>
