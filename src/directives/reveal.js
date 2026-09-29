import { revealElement } from '../composables/useReveal.js'

/**
 * v-reveal            → fades and rises as the element scrolls into view
 * v-reveal="120"      → the same, 120ms later
 */
export default {
  mounted(el, binding) {
    const value = binding.value
    revealElement(el, typeof value === 'number' ? value : (value?.d ?? 0))
  },
}
