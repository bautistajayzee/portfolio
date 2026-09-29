<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { lockScroll, refreshScroll, unlockScroll } from '../../composables/useSmoothScroll.js'

/**
 * A lightbox for a screenshot or a document.
 *
 * Opens over the page, closes on Escape, on a click outside the content, or on
 * the close button. Focus moves to the close button on open and returns to
 * whatever was focused before.
 *
 * `kind: 'document'` swaps the image for an iframe and lets the browser's own
 * PDF viewer do the work. That costs no JavaScript at all — the file is only
 * fetched once the dialog is actually open, so the page itself stays as light
 * as it was.
 */
const props = defineProps({
  open: { type: Boolean, default: false },
  src: { type: String, default: '' },
  alt: { type: String, default: '' },
  caption: { type: String, default: '' },
  kind: { type: String, default: 'image' },
})

const emit = defineEmits(['close'])
const closeButton = ref(null)
let lastFocused = null

const isDocument = () => props.kind === 'document'

function close() {
  emit('close')
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    close()
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      lastFocused = document.activeElement
      lockScroll()
      await nextTick()
      closeButton.value?.focus()
    } else {
      unlockScroll()
      // the page may have resized while it was locked
      refreshScroll()
      lastFocused?.focus?.()
    }
  },
)

onBeforeUnmount(() => {
  unlockScroll()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="lightbox-frame fixed inset-0 z-[70] flex flex-col items-center justify-center p-5 sm:p-8"
      role="dialog"
      aria-modal="true"
      :aria-label="caption || (isDocument() ? 'Document preview' : 'Image preview')"
      @keydown="onKeydown"
    >
      <!-- click anywhere outside the figure to dismiss -->
      <div
        class="absolute inset-0 bg-[#0a0a0a]/92"
        @click="close"
      ></div>

      <figure class="relative z-10 flex max-h-full w-full max-w-5xl flex-col">
        <!--
          A document renders in an iframe so the browser's built-in PDF viewer
          handles it. No viewer library, no extra bytes — and because the whole
          dialog is behind `v-if`, the file is not requested until it is opened.
        -->
        <iframe
          v-if="isDocument()"
          :src="src"
          :title="alt || caption || 'Document'"
          class="h-[78vh] w-full rounded-[4px] border border-[#2c2a27] bg-[#1a1a1a]"
        ></iframe>

        <img
          v-else
          :src="src"
          :alt="alt"
          class="max-h-[78vh] w-full rounded-[4px] border border-[#2c2a27] object-contain"
        />

        <figcaption
          v-if="caption"
          class="meta mt-4 text-center text-[#a9a49b]"
        >
          {{ caption }}
        </figcaption>

        <!-- escape hatch, for anyone who would rather have the real tab -->
        <p v-if="isDocument()" class="meta mt-3 text-center text-[#5c5852]">
          <a :href="src" target="_blank" rel="noopener noreferrer" class="hover:text-[#a9a49b]">
            Open in a new tab
          </a>
        </p>
      </figure>

      <button
        ref="closeButton"
        type="button"
        class="lightbox-close absolute right-4 top-4 z-20 -mr-1.5 p-1.5 text-[#a9a49b] hover:text-white sm:right-6 sm:top-6"
        :aria-label="isDocument() ? 'Close document preview' : 'Close image preview'"
        @click="close"
      >
        <svg viewBox="0 0 24 24" fill="none" class="h-6 w-6" aria-hidden="true">
          <path
            d="M5.5 5.5l13 13M18.5 5.5l-13 13"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <!--
        Keyboard-only hint.

        There is no Esc key on a phone, so this was instructing a gesture the
        device cannot make — and it occupied the bottom of the screen where a
        thumb goes. Hidden wherever there is no fine pointer, with the X button
        in the corner as the actual affordance. `(hover: hover) and (pointer:
        fine)` is the honest test: a touchscreen laptop with a keyboard attached
        still gets told about Esc, which is correct, because it does have one.
      -->
      <p class="lightbox-hint meta absolute bottom-4 left-0 right-0 z-20 text-center text-[#5c5852]">
        Esc to close
      </p>
    </div>
  </Teleport>
</template>

<style scoped>
/*
  Notches and home indicators.

  The viewport meta sets `viewport-fit=cover`, so this overlay genuinely covers
  the whole screen including the areas a phone reserves for its own furniture.
  The close button is absolutely positioned at the top-right and the hint at the
  bottom, which is exactly where that furniture is — so they are pushed inboard
  by the insets. On a device with none, every one of these resolves to 0 and the
  layout is unchanged.
*/
.lightbox-frame {
  padding-top: max(1.25rem, env(safe-area-inset-top));
  padding-right: max(1.25rem, env(safe-area-inset-right));
  padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
  padding-left: max(1.25rem, env(safe-area-inset-left));
}

.lightbox-close {
  top: max(1rem, calc(env(safe-area-inset-top) + 0.25rem));
  right: max(1rem, calc(env(safe-area-inset-right) + 0.25rem));
}

.lightbox-hint {
  bottom: max(1rem, calc(env(safe-area-inset-bottom) + 0.25rem));
}

/* No Esc key where there is no mouse. See the note on the element. */
@media not all and (hover: hover) and (pointer: fine) {
  .lightbox-hint {
    display: none;
  }
}

@media (min-width: 640px) {
  .lightbox-close {
    top: max(1.5rem, calc(env(safe-area-inset-top) + 0.75rem));
    right: max(1.5rem, calc(env(safe-area-inset-right) + 0.75rem));
  }
}
</style>
