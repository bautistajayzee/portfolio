<script setup>
import { profile } from '../../data/portfolio.js'
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-line">
    <div class="shell">
      <div
        class="flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="meta text-n-400">
          © {{ year }} {{ profile.fullName }}
        </p>

        <!--
          `n-400`, matching the copyright and the back-to-link on either side.

          This was `n-300`, a whole step dimmer than both its neighbours, which
          at this size put it at 1.48:1 on the light page and 1.62:1 on the dark
          one. Not quiet — gone. The wording stays: it is the only line in this
          footer that says anything, and "built with" is boilerplate.
        -->
        <p class="meta text-n-400">
          Built by hand — Vue &amp; Tailwind
        </p>

        <!--
          `data-scroll-top` tells the global anchor handler to go to the very
          top of the document rather than to the hero's top edge. The href stays
          so the link still works with JavaScript off.
        -->
        <a href="#home" data-scroll-top class="meta w-fit py-2 text-n-400 hover:text-ink">
          Back to top ↑
        </a>
      </div>
    </div>
  </footer>
</template>
