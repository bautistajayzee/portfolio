<script setup>
import { ref } from 'vue'
import SectionHead from '../ui/SectionHead.vue'
import Rule from '../ui/Rule.vue'
import Lightbox from '../ui/Lightbox.vue'
import { resume, sections } from '../../data/portfolio.js'

const head = sections.find((s) => s.id === 'resume')
const enlarged = ref(false)
</script>

<template>
  <section id="resume" data-section class="section border-t border-line">
    <div class="shell">
      <SectionHead
        v-reveal
        :index="head.index"
        :title="head.label"
        lead="The one-page version, for anyone who would rather skim than scroll."
      />

      <!--
        Set as a single wide row, on the same hairline grid as a project row.

        No embedded viewer. A PDF embed pulls in a viewer runtime and renders a
        scrolling page inside the page — heavy, and it fights the site's own
        scroll. The browser already has a good PDF viewer, so the View button
        hands the file to it in a new tab and this page stays light.
      -->
      <div class="mt-14 md:mt-16">
        <Rule ink v-reveal="40" />

        <div
          v-reveal="80"
          class="grid grid-cols-1 items-start gap-x-8 gap-y-6 py-8 md:grid-cols-12 md:py-10"
        >
          <!-- format + year, in the left margin like a project index -->
          <div class="md:col-span-2">
            <p class="meta text-n-300">PDF</p>
            <p class="meta mt-2 text-n-400 md:mt-3 tabular-nums">{{ resume.updated }}</p>
          </div>

          <!-- the document itself -->
          <div class="md:col-span-6">
            <h3 class="max-w-[26rem] text-[clamp(1.125rem,2.2vw,1.4375rem)] font-medium leading-[1.25] tracking-[-0.018em]">
              {{ resume.title }}
            </h3>

            <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              <li class="meta text-n-400">One page</li>
              <li class="meta text-n-400">{{ resume.size }}</li>
            </ul>

            <p class="mt-5 max-w-[34rem] text-[0.875rem] leading-[1.75] text-n-500">
              {{ resume.note }}
            </p>
          </div>

          <!--
            Two actions, deliberately different in weight rather than two
            identical boxes: Download is the primary, so it carries a border;
            View is a quiet text link, because it is the one you take when you
            already know you want to read it.
          -->
          <div class="flex flex-wrap items-center gap-x-6 gap-y-4 md:col-span-4 md:justify-end">
            <button
              type="button"
              class="link-underline meta inline-flex items-center gap-2 py-1.5 text-n-400 transition-colors duration-200 hover:text-ink"
              @click="enlarged = true"
            >
              View Resume
              <svg
                viewBox="0 0 16 16"
                class="h-4 w-4 text-n-300"
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
              :href="resume.url"
              :download="resume.filename"
              class="meta inline-flex items-center gap-2 border border-line px-3 py-2 text-n-500 transition-colors duration-200 hover:border-ink hover:text-ink"
            >
              Download
              <svg
                viewBox="0 0 16 16"
                class="h-4 w-4 text-n-300"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 2V10M8 10L4.5 6.5M8 10L11.5 6.5M2.5 13.5H13.5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>

        <Rule ink v-reveal="200" />
      </div>
    </div>

    <!--
      The PDF opens over the page rather than in a new tab, so a reader never
      loses their place. `kind="document"` makes the lightbox render an iframe
      and hand rendering to the browser — the file is only fetched at that
      point, so nothing is downloaded until it is asked for.

      The caption is built from the title and size, NOT `resume.filename`. That
      field is documented as never being shown, and it was being handed straight
      to the lightbox, which rendered it in a `<figcaption>` — so the modal
      proudly displayed "Bautista, Jayzee G. (RESUME).pdf" over a document whose
      whole point is that it does not look like a file dump. It stays on the
      `download` attribute, which is the only place a filename belongs.
    -->
    <Lightbox
      :open="enlarged"
      kind="document"
      :src="resume.url"
      :alt="resume.title"
      :caption="`${resume.title} · PDF, ${resume.size}`"
      @close="enlarged = false"
    />
  </section>
</template>
