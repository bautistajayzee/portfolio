<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

import SplitName from '../ui/SplitName.vue'
import ProfileImage from '../ui/ProfileImage.vue'
import { gsap, prefersReducedMotion } from '../../composables/useSmoothScroll.js'
import { profile, social } from '../../data/portfolio.js'

/** Two lines, so the name can break on a deliberate line and not by accident. */
const nameLines = [`${profile.firstName} ${profile.middleInitial}`, profile.lastName]

/**
 * The photograph gets two scroll-linked treatments, both deliberately small:
 *
 * · a one-shot mask wipe when it first scrolls in — not a bounce
 * · a 7% parallax across the hero, just enough to read as depth without the
 *   page feeling like it is moving underneath you
 *
 * Both are torn down on unmount, and both are skipped under reduced motion.
 */
const portrait = ref(null)
let wipe = null
let parallax = null
let safety = null

/**
 * Replays the masthead typing.
 *
 * Bumped whenever anything on the page links back to `#home` — the side rail,
 * the mobile menu, the footer. One delegated listener covers all three, because
 * the trigger is "a link to the hero was followed", not "a particular nav was
 * clicked".
 */
const nameKey = ref(0)

function onHomeLink(event) {
  if (event.target.closest?.('a[href="#home"]')) nameKey.value += 1
}

onMounted(() => {
  document.addEventListener('click', onHomeLink)

  if (prefersReducedMotion() || !portrait.value) return

  // A "from" tween paints its start state immediately, so a tween that never
  // runs would leave the photograph hidden. clearProps hands the element back
  // to the stylesheet when it finishes, and the timer covers the case where it
  // never does — the image must never be stuck invisible.
  wipe = gsap.from(portrait.value, {
    clipPath: 'inset(0% 0% 100% 0%)',
    duration: 1.1,
    ease: 'expo.out',
    delay: 0.1,
    clearProps: 'clipPath',
  })

  safety = window.setTimeout(() => {
    if (portrait.value) gsap.set(portrait.value, { clearProps: 'clipPath' })
  }, 2500)

  parallax = gsap.fromTo(
    portrait.value,
    { yPercent: 0 },
    {
      yPercent: -7,
      ease: 'none',
      scrollTrigger: {
        trigger: '#home',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.6,
      },
    },
  )
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onHomeLink)
  window.clearTimeout(safety)
  wipe?.kill()
  parallax?.scrollTrigger?.kill()
  parallax?.kill()
})
</script>

<template>
  <!--
    The hero is one composition, not a stack of blocks:

    · lg:min-h-[100svh] + flex/items-center centres the whole thing in the
      viewport, so it is not pinned to the top. svh (not vh) so mobile browser
      chrome does not push it off screen.
    · md: splits into two columns — photograph left, text right. The image
      takes 5 of 12 and the text 6, so the text keeps a comfortable measure
      instead of running the full width of the page.
    · md:items-center optically centres the photograph against the text column,
      so the two read as one composition rather than as two things that happen
      to be sitting side by side.
    · The text column is a single stack — role, name, two short paragraphs, and
      a slash-separated link row. One measure is what stops a hero reading as a
      wall of text.

    Placement uses explicit col-start / col-end rather than col-span-*, because
    the span utilities compile to the `grid-column` shorthand, which resets the
    start line and would undo the offset.
  -->
  <section
    id="home"
    data-section
    class="section relative pt-14 pb-16 md:pt-20 md:pb-20 lg:flex lg:min-h-[100svh] lg:items-center lg:py-14"
  >
    <div class="shell w-full">
      <div class="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-12 md:items-center">
        <!-- the photograph -->
        <div class="flex justify-center md:col-start-1 md:col-end-6">
          <div ref="portrait" class="w-full max-w-[17rem] md:max-w-none">
            <!-- the only eager, high-priority image on the page -->
            <ProfileImage priority />
          </div>
        </div>

        <!-- name, statement, links -->
        <div class="md:col-start-7 md:col-end-13">
          <div v-reveal class="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span class="meta text-n-500">{{ profile.role }}</span>
            <span class="meta text-n-300" aria-hidden="true">/</span>
            <span class="meta text-n-400">{{ profile.location }}</span>
          </div>

          <div class="mt-6">
            <SplitName :lines="nameLines" :replay-key="nameKey" />
          </div>

          <p
            v-reveal="120"
            class="mt-10 max-w-[32rem] text-[clamp(1.0625rem,1.9vw,1.3125rem)] leading-[1.5] tracking-[-0.014em] text-n-800"
          >
            An IT student who works across programming, graphic design, and
            problem-solving — turning rough ideas into things that actually run.
          </p>

          <p
            v-reveal="200"
            class="mt-6 max-w-[32rem] text-[0.9375rem] leading-[1.75] text-n-500"
          >
            Four years of freelance design and video taught me to read a brief
            properly and hit a date. An IT degree is teaching me to build the
            thing underneath it. This site is where the two meet.
          </p>

          <!-- short names and slashes, set in the site's mono -->
          <nav v-reveal="280" aria-label="Contact and profiles" class="mt-10">
            <ul class="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <li
                v-for="(item, i) in social"
                :key="item.label"
                class="flex items-baseline gap-x-3"
              >
                <a
                  :href="item.href"
                  class="meta py-2 text-n-500 transition-colors duration-200 hover:text-ink"
                  :target="item.href.startsWith('http') ? '_blank' : undefined"
                  :rel="item.href.startsWith('http') ? 'noopener noreferrer' : undefined"
                >
                  {{ item.label }}
                </a>
                <span
                  v-if="i < social.length - 1"
                  class="meta text-n-300"
                  aria-hidden="true"
                >/</span>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  </section>
</template>
