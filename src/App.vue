<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

import SideNav from './components/layout/SideNav.vue'
import MobileNav from './components/layout/MobileNav.vue'
import PageFooter from './components/layout/PageFooter.vue'
import ChatWidget from './components/ui/ChatWidget.vue'
import ScrollProgress from './components/ui/ScrollProgress.vue'

import HomeSection from './components/sections/HomeSection.vue'
import AboutSection from './components/sections/AboutSection.vue'
import EducationSection from './components/sections/EducationSection.vue'
import ExperienceSection from './components/sections/ExperienceSection.vue'
import SkillsSection from './components/sections/SkillsSection.vue'
import TechStackSection from './components/sections/TechStackSection.vue'
import ProjectsSection from './components/sections/ProjectsSection.vue'
import ResumeSection from './components/sections/ResumeSection.vue'
import ContactSection from './components/sections/ContactSection.vue'

import { sections } from './data/portfolio.js'
import { initScrollMotion } from './composables/useScrollMotion.js'

const menuOpen = ref(false)
const active = ref('home')

let spy = null

onMounted(() => {
  // Needs the sections in the DOM, so it cannot run alongside initSmoothScroll.
  initScrollMotion()

  // --- scroll spy: which section is crossing the middle of the screen -----
  // A negative rootMargin shrinks the viewport to a thin strip down the
  // middle, so only the section passing through that strip is "active".
  if (typeof IntersectionObserver === 'undefined') return

  spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) active.value = entry.target.id
      }
    },
    { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
  )

  document.querySelectorAll('[data-section]').forEach((s) => spy.observe(s))
})

onBeforeUnmount(() => {
  spy?.disconnect()
})
</script>

<template>
  <ScrollProgress />

  <!--
    The skip link and the desktop rail go inert with the rest.

    They live outside the content region below, so without this they were the
    last three things still tabbable while the mobile menu was open. The skip
    link was the worst of them: it is `focus:z-[60]`, which is *above* the menu's
    `z-50`, so tabbing to it painted a visible skip link on top of an open menu
    and threw the user out of the thing they had just opened.

    The rail is `hidden` below `lg` where the menu exists, and `menuOpen` can
    only ever be true there, so this is inert in practice for the rail and
    meaningful for the skip link.
  -->
  <div :inert="menuOpen || undefined">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-6 focus:z-[60] focus:rounded focus:border focus:border-ink focus:bg-paper focus:px-4 focus:py-2 focus:text-[0.8125rem]"
    >
      Skip to content
    </a>

    <SideNav :sections="sections" :active="active" />
  </div>

  <MobileNav :sections="sections" :active="active" v-model:open="menuOpen" />

  <!--
    The rest of the page goes `inert` while the mobile menu is open.

    The menu covering the viewport is not enough: Tab is a document walk, not a
    visual one, so without this, keyboard and switch-control users tabbed
    straight out of the open menu and into the 38 focusable things behind it —
    links that looked covered, and a focus ring nobody could see. The menu keeps
    its own `inert` for the opposite case, so the two together mean exactly one
    region of the page is interactive at a time, whichever one that is.
  -->
  <div class="lg:pl-[var(--rail-w)]" :inert="menuOpen || undefined">
    <main id="main">
      <HomeSection />
      <AboutSection />
      <EducationSection />
      <ExperienceSection />
      <SkillsSection />
      <TechStackSection />
      <ProjectsSection />
      <ResumeSection />
      <ContactSection />
    </main>
    <PageFooter />
  </div>

  <!--
    The chat launcher is outside the region above so it would stay clickable
    under the open menu; it needs the same treatment.
  -->
  <div :inert="menuOpen || undefined">
    <ChatWidget />
  </div>
</template>
