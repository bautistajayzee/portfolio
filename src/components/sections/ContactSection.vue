<script setup>
import SectionHead from '../ui/SectionHead.vue'
import Rule from '../ui/Rule.vue'
import ProfileImage from '../ui/ProfileImage.vue'
import LetterComposer from '../ui/LetterComposer.vue'
import { contact, sections, social } from '../../data/portfolio.js'

const head = sections.find((s) => s.id === 'contact')

/**
 * The external channels, read straight off the hero's link row so a handle is
 * only ever changed in one place. `contact` is filtered out — linking this
 * section to itself would be pointless.
 */
const channels = social.filter((item) => item.href.startsWith('http'))
</script>

<template>
  <!--
    The last section carries `min-h-[100svh]` on purpose.

    Without it, Contact physically cannot scroll to the top of the viewport:
    there has to be at least a screenful of content *below* its top edge for
    the browser to be able to park that edge at the top. There was only 837px
    below it against an 886px viewport — 49px short — and that shortfall grows
    with the screen. On a 1400px-tall display it is roughly 560px, so clicking
    "Contact" left the heading most of the way down the page with the footer
    filling the view. It read as the link not working at all.

    A full-viewport closing section fixes it at every viewport height, because
    now there is always at least 100svh beneath the section's top edge.
  -->
  <section
    id="contact"
    data-section
    class="section flex flex-col justify-center border-t border-line lg:min-h-[100svh]"
  >
    <div class="shell">
      <SectionHead v-reveal :index="head.index" :title="head.label" :lead="contact.lead" />

      <!--
        Everything below the head sits on the same vertical axis as the rest
        of the page: the section number owns columns 1-2, content starts at
        column 3. This block used to start at column 1, so the headline drifted
        a full two columns left of the "Contact" title directly above it.
      -->
      <div class="mt-14 grid grid-cols-1 items-start gap-x-8 gap-y-12 md:mt-16 md:grid-cols-12">
        <!--
          Placement uses explicit `col-start` / `col-end` rather than
          `col-span-*`. The span utilities compile to the `grid-column`
          shorthand, which resets `grid-column-start` — so a `lg:col-span-6`
          silently wipes out an `md:col-start-3` and the block drifts back to
          the left edge. Start and end are set at both breakpoints instead.
        -->
        <!-- headline + email + details -->
        <div class="md:col-start-3 md:col-end-11 lg:col-start-3 lg:col-end-9">
          <h3
            v-reveal="80"
            class="text-[clamp(2.25rem,6vw,3.5rem)] font-medium leading-[0.98] tracking-[-0.035em]"
          >
            {{ contact.heading }}
          </h3>

          <!-- `py-1` takes this from a 22px-tall target to 30px. It is a mailto,
               so it is a thing people actually tap. -->
          <a
            v-reveal="150"
            :href="`mailto:${contact.details[0].value}`"
            class="link-underline mt-8 inline-block break-all py-1 text-[clamp(1.125rem,3vw,1.75rem)] leading-[1.2] tracking-[-0.02em]"
          >
            {{ contact.details[0].value }}
          </a>

          <Rule v-reveal="180" />

          <dl class="grid grid-cols-1 gap-x-8 gap-y-6 pt-7 sm:grid-cols-2">
            <div v-for="(detail, i) in contact.details.slice(1)" :key="detail.label" v-reveal="220 + i * 70">
              <dt class="meta text-n-400">{{ detail.label }}</dt>
              <dd class="mt-2.5 text-[0.9375rem] leading-snug text-n-700">
                <a v-if="detail.href" :href="detail.href" class="link-underline">{{ detail.value }}</a>
                <template v-else>{{ detail.value }}</template>
              </dd>
            </div>
          </dl>

          <!--
            The same slash-separated row the hero uses. Email and location are
            above in full; this is the short-hand version for the profiles.
          -->
          <nav v-reveal="430" aria-label="Social profiles" class="mt-10">
            <ul class="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <li
                v-for="(item, i) in channels"
                :key="item.label"
                class="flex items-baseline gap-x-3"
              >
                <a
                  :href="item.href"
                  class="meta py-2 text-n-500 transition-colors duration-200 hover:text-ink"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ item.label }}
                </a>
                <span
                  v-if="i < channels.length - 1"
                  class="meta text-n-300"
                  aria-hidden="true"
                >/</span>
              </li>
            </ul>
          </nav>
        </div>

        <!--
          The portrait is pinned to the right edge of the same grid, so its
          right-hand edge lines up with the end of every rule and row above it.
          Below `lg` it drops onto the axis and left-aligns instead of floating
          in the middle of the column.
        -->
        <div class="flex md:col-start-3 md:col-end-7 lg:col-start-10 lg:col-end-13 lg:justify-end">
          <div v-reveal="200" class="w-full max-w-[11rem] sm:max-w-[13rem]">
            <ProfileImage size="100%" />
          </div>
        </div>

        <!--
          The composer, on its own row below the grid rather than tucked into
          the left column.

          It is a full document — addressee, three fields, a counter and a send
          action — and putting it under the headline would have made that column
          roughly twice the height of the portrait beside it and left the
          section bottom-heavy.

          `md:col-start-3` is load-bearing, not decoration. This is the third
          child of the 12-column grid, and it does *not* declare a placement, so
          auto-flow put it in column 1 — the one column nothing else spans. That
          column has no content to size it, so it collapsed to 44px and split the
          composer's fields into unusable slivers. Explicit start and end, like
          every other item in this grid.

          `col-end-11` rather than 13, so the composer shares the headline's
          measure instead of running the full width of the shell.
        -->
        <div v-reveal="120" class="mt-16 md:mt-20 md:col-start-3 md:col-end-11">
          <LetterComposer />
        </div>
      </div>
    </div>
  </section>
</template>
