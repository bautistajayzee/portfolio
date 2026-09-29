<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { gsap, prefersReducedMotion, refreshScroll } from '../../composables/useSmoothScroll.js'

/**
 * A 1px rule pinned to the top of the viewport that fills as you read.
 *
 * It is the only piece of persistent chrome on the page, and it earns its
 * place by telling you how much is left without adding anything to look at.
 * Driven by a scrubbed ScrollTrigger so it tracks the real scroll position
 * rather than animating on its own clock.
 */
const bar = ref(null)
let tween = null

onMounted(() => {
  // Fonts and images change the page height after first paint, so the
  // trigger's end value is wrong until they have settled.
  document.fonts?.ready.then(refreshScroll)

  if (prefersReducedMotion()) {
    gsap.set(bar.value, { scaleX: 1 })
    return
  }

  tween = gsap.fromTo(
    bar.value,
    { scaleX: 0 },
    {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.25,
      },
    },
  )
})

onBeforeUnmount(() => tween?.scrollTrigger?.kill())
</script>

<template>
  <!--
    Offset down by the notch inset. `viewport-fit=cover` puts the true top of
    the viewport behind the status bar, so at `top-0` this hairline was drawn
    where nobody could see it and the progress read as permanently empty on a
    notched phone. It moves with `transform` rather than `top` so it stays out
    of layout, and GSAP is scaling the inner bar, not this element.
  -->
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-[60] h-px bg-transparent"
    style="translate: 0 env(safe-area-inset-top)"
    aria-hidden="true"
  >
    <div
      ref="bar"
      class="h-full w-full origin-left scale-x-0 bg-accent/45"
    ></div>
  </div>
</template>
