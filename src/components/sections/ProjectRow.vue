<script setup>
import { ref } from 'vue'
import Lightbox from '../ui/Lightbox.vue'

/**
 * One project, set as a large full-width row rather than a card in a grid.
 *
 * Every row looks the same. The "View" affordance in the last column is the
 * only interactive part, and it does one of two things:
 *
 *   preview   open the screenshot in a lightbox   (local projects)
 *   href      follow the link                    (projects that are live)
 *
 * A project can have both — the screenshot wins, since it is the thing worth
 * looking at. Keeping the two as alternatives means a button is never nested
 * inside a link.
 */
defineProps({
  project: { type: Object, required: true },
  index: { type: Number, required: true },
})

const enlarged = ref(false)
</script>

<template>
  <article class="group border-t border-line py-8 md:py-10">
    <div class="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-12">
      <!-- index + year -->
      <div class="flex items-baseline gap-4 md:col-span-2 md:block">
        <p class="meta text-n-300 tabular-nums">{{ String(index).padStart(2, '0') }}</p>
        <p class="meta mt-2 text-n-400 md:mt-3 tabular-nums">{{ project.year }}</p>
      </div>

      <!-- title + categories -->
      <div class="md:col-span-3">
        <h3 class="text-[clamp(1.25rem,2.6vw,1.75rem)] font-medium leading-[1.15] tracking-[-0.024em]">
          {{ project.title }}
        </h3>

        <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          <li v-for="tag in project.meta" :key="tag" class="meta text-n-400">
            {{ tag }}
          </li>
        </ul>
      </div>

      <!-- description -->
      <p class="max-w-[30rem] text-[0.9375rem] leading-[1.7] text-n-500 md:col-span-4">
        {{ project.description }}
      </p>

      <!--
        The affordances, stacked and right-aligned.

        These used to be mutually exclusive - `v-if` on the screenshot button and
        `v-else-if` on the link - on the assumption that a row has a screenshot
        *or* somewhere to go. Komiks and GoPeso turned out to have both, and
        adding a screenshot to them silently deleted their Figma links: the two
        rows went from "View in Figma" to "View" and nothing on the page said
        that a real destination had been dropped.

        So they are independent now. A screenshot shows what was made; a link
        opens the file it was made in. Which of the two a row has is decided by
        the data, and either may be absent.

        They are stacked rather than set side by side, and that is a fix rather
        than a preference. The column is two of twelve and measures 120px at a
        1296px viewport, while "View" and "View in Figma" are `whitespace-nowrap`
        and need 206px between them. Laid out in a row with `justify-end` the
        overflow goes leftward, because a right-aligned line that is too long
        grows to the left — and it landed on top of the description, whose right
        edge sat 54px further right than the "View" link's left edge.

        An earlier note here claimed the surplus "eats gutter rather than
        colliding with the description". That was true of a single link, which
        needs about 10px more than the column has and so reaches into the 32px
        gap. Two links need 86px more than that, and the gap ran out.

        Stacked, the widest label is what overruns, and only by that 10px. It
        reaches into the gutter and stops well short of the text.
      -->
      <div class="flex flex-col items-start gap-y-2 md:col-span-3 md:items-end">
        <button
          v-if="project.preview"
          type="button"
          class="meta mt-1 inline-flex items-center gap-2 whitespace-nowrap py-1.5 text-n-400 hover:text-accent md:mt-2"
          :aria-label="`View screenshot of ${project.title}`"
          @click="enlarged = true"
        >
          View
          <svg
            viewBox="0 0 16 16"
            class="h-4 w-4 text-n-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 11L11 5M11 5H6M11 5V10"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <a
          v-if="project.href"
          :href="project.href"
          :target="project.href.startsWith('http') ? '_blank' : undefined"
          :rel="project.href.startsWith('http') ? 'noopener noreferrer' : undefined"
          class="meta mt-1 inline-flex items-center gap-2 whitespace-nowrap py-1.5 text-n-400 hover:text-accent md:mt-2"
        >
          <!--
            `linkLabel` lets the data name the destination, so "View in Figma"
            and "Visit site" are set once per project rather than taught to this
            component. The button that opens a screenshot keeps the plain "View",
            which is enough there: the thing being viewed is right there in the
            row.

            Alongside rather than instead of it - see the note on the wrapper.

            `whitespace-nowrap` is load-bearing. The text measures 106px and the
            column is 120px, but with the 8px gap and the 16px icon the whole
            thing needs 130px — so it wrapped into "View / in / Figma" stacked
            vertically, 171px tall against the 30px it should be.

            `mt-1 md:mt-2` aligns the first of the two with the row's baseline;
            with the wrapper now stacking them, the second picks up the same
            margin and lands 30px lower, which is what separates them.

            Deliberately no `aria-label`. Adding one that named the project
            would put a different string in the accessible name than the one on
            screen, and that is exactly the mismatch the label-in-name audit
            flags. Leaving the visible text to be the name is both correct and
            shorter.
          -->
          {{ project.linkLabel || 'View' }}
          <svg
            viewBox="0 0 16 16"
            class="h-4 w-4 text-n-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 11L11 5M11 5H6M11 5V10"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </a>
      </div>
    </div>

    <Lightbox
      v-if="project.preview"
      :open="enlarged"
      :src="project.preview"
      :alt="project.previewAlt || ''"
      :caption="project.previewCaption || ''"
      @close="enlarged = false"
    />
  </article>
</template>
