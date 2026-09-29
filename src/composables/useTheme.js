import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Light / dark / system.
 *
 * The heavy lifting is done by `html.dark` in style.css and a tiny inline
 * script in index.html that applies the class before first paint — this only
 * has to keep the two in sync afterwards and persist the choice.
 *
 * Colours are transitioned so a theme change crossfades rather than snapping.
 * The class is set on <html>, and the transition is applied to everything
 * under it, so a switch animates every colour on the page at once.
 */
const STORAGE_KEY = 'theme'

/** Shared across every component that calls this, so there is one source. */
const preference = ref('system')
const resolved = ref('light')

const systemQuery =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

/** Light and dark page backgrounds, for the browser's own UI. */
const CHROME = { light: '#ffffff', dark: '#0b0b0d' }

function isDark() {
  return document.documentElement.classList.contains('dark')
}

function apply() {
  const dark = preference.value === 'dark' || (preference.value === 'system' && isSystemDark())
  document.documentElement.classList.toggle('dark', dark)
  resolved.value = dark ? 'dark' : 'light'

  // Keep the mobile address bar in step with the page.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', CHROME[resolved.value])
}

function isSystemDark() {
  return systemQuery ? systemQuery.matches : false
}

function set(pref) {
  preference.value = pref
  try {
    localStorage.setItem(STORAGE_KEY, pref)
  } catch (e) {
    /* storage blocked — the theme still applies, it just will not persist */
  }
  apply()
}

/**
 * True only when the theme is actually switching between light and dark, so
 * the crossfade is skipped on first paint and when the choice does not change
 * (e.g. clicking "light" while already light).
 */
function isSwitching(from, to) {
  return (from === 'dark') !== (to === 'dark')
}

export function useTheme() {
  function onSystemChange() {
    if (preference.value !== 'system') return
    apply()
  }

  onMounted(() => {
    // Read what the inline script already decided, so the two never disagree.
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      preference.value = stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system'
    } catch (e) {
      preference.value = 'system'
    }
    apply()
    systemQuery?.addEventListener('change', onSystemChange)
  })

  onBeforeUnmount(() => {
    systemQuery?.removeEventListener('change', onSystemChange)
  })

  return { preference, resolved, set, isSwitching }
}
