<script setup>
import TypeTitle from './TypeTitle.vue'

/**
 * The editorial spine of every section: a number in the left margin,
 * a title, and an optional lead. On wide screens the number sits in its
 * own two columns so the whole page lines up on one vertical axis.
 *
 * The title resolves out of a cipher as it scrolls into view. All eight
 * section headings share this one component, so that is the only place that
 * needed changing to cover the whole page.
 */
defineProps({
  index: { type: String, required: true },
  title: { type: String, required: true },
  lead: { type: String, default: '' },
  as: { type: String, default: 'h2' },
})
</script>

<template>
  <header class="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-12">
    <div class="md:col-span-2">
      <span class="meta text-n-400">{{ index }}</span>
    </div>

    <div class="md:col-span-10 lg:col-span-8">
      <!--
        `1.875rem` (30px) is the floor, not the previous 24px.

        A heading is the thing a phone user is deciding whether to read next, and
        24px against 15px body copy is a 1.6x step — on the one screen where you
        cannot see the surrounding page for context. At 30px the ladder reads
        40 (hero) / 30 (section) / 18-22 (card) / 15 (body), which is a hierarchy
        you can navigate by size alone.

        The ceiling is untouched at 34px, so nothing changes on a desktop. The
        3vw middle only takes over above roughly 1000px.

        All eight section headings share `SectionHead`, so this is the single
        place that needed changing.
      -->
      <TypeTitle
        :text="title"
        :as="as"
        class="text-[clamp(1.875rem,3vw,2.125rem)] font-medium leading-[1.12] tracking-[-0.022em]"
      />

      <p v-if="lead" class="mt-4 max-w-[34rem] text-[0.9375rem] leading-[1.75] text-n-500">
        {{ lead }}
      </p>
    </div>
  </header>
</template>
