<script setup>
import SectionHead from '../ui/SectionHead.vue'
import ProjectRow from './ProjectRow.vue'
import { projects, sections } from '../../data/portfolio.js'

const head = sections.find((s) => s.id === 'projects')
</script>

<template>
  <section id="projects" data-section class="section border-t border-line">
    <div class="shell">
      <SectionHead
        v-reveal
        :index="head.index"
        :title="head.label"
        lead="A few things I have made, most of them while learning how to make them properly."
      />

      <div class="mt-14 md:mt-16">
        <ProjectRow
          v-for="(project, i) in projects"
          :key="project.title"
          :project="project"
          :index="i + 1"
          v-reveal="i * 70"
        />
        <!-- closing hairline under the last row -->
        <div class="border-t border-line"></div>
      </div>
    </div>
  </section>
</template>
