<script setup>
import { ref, watch } from 'vue'
import { profile } from '../../data/portfolio.js'

/**
 * The photograph, cropped to a circle, for the chat panel.
 *
 * Replaces what used to be a `JB` monogram in a flat disc. Four of these sit
 * in the panel — the header, the greeting, every answer, and the typing
 * indicator — so it is worth one component rather than four copies of the same
 * `<img>`.
 *
 * The initials are a fallback, not the design. `profile.photo` is a single path
 * and a 24px circle is the last place on the page where a broken image icon
 * would actually be noticed, so it falls back to monogram initials exactly the
 * way `ProfileImage` does.
 */
const props = defineProps({
  /** `sm` is the in-message avatar, `md` the one in the header. */
  size: { type: String, default: 'sm' },
})

const photoOk = ref(true)
watch(
  () => profile.photo,
  () => {
    photoOk.value = true
  },
)
</script>

<template>
  <span
    class="grid shrink-0 place-items-center overflow-hidden rounded-full bg-n-200"
    :class="props.size === 'md' ? 'h-8 w-8' : 'h-6 w-6'"
    aria-hidden="true"
  >
    <img
      v-if="photoOk"
      :src="profile.photo"
      alt=""
      class="h-full w-full object-cover"
      :width="props.size === 'md' ? 32 : 24"
      :height="props.size === 'md' ? 32 : 24"
      decoding="async"
    />
    <span
      v-else
      class="select-none font-semibold text-ink"
      :class="props.size === 'md' ? 'text-[0.625rem]' : 'text-[0.5rem]'"
    >
      JG
    </span>
  </span>
</template>
