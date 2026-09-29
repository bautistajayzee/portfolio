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
      <TypeTitle
        :text="title"
        :as="as"
        class="text-[clamp(1.5rem,3.2vw,2.125rem)] font-medium leading-[1.12] tracking-[-0.022em]"
      />

      <p v-if="lead" class="mt-4 max-w-[34rem] text-[0.9375rem] leading-[1.75] text-n-500">
        {{ lead }}
      </p>
    </div>
  </header>
</template>
