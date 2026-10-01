<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { profile, social } from '../../data/portfolio.js'

/**
 * The rail's footer, and the mobile menu's too: how to reach him, one row per
 * channel.
 *
 * The layout is the reference one — a short lead-in line, then a stacked list
 * where each row pairs a glyph with a handle rather than a full URL. What is not
 * copied is the styling: that reads as a list of buttons with icons and a
 * weight on each one, which is a different language from this site. Here the
 * glyph is a small outline mark in the same grey as every other status line in
 * the rail, the handle is set in the site mono, and the accent only appears on
 * hover — so the block sits in the rail rather than advertising itself.
 *
 * `social` carries `icon` and `short` for exactly this. The paths live here
 * rather than in the data because `portfolio.js` is content: it should be
 * readable on its own, and it has to stay serialisable for the audits.
 *
 * `aria-hidden` on every glyph. These are the third icon in a row that already
 * says what it is, and a screen reader announcing "Instagram logo" before
 * "instagram" is noise, not information.
 */
const GLYPHS = {
  mail: ['M3 6.5h18v11H3z', 'm3.4 7 8.6 6 8.6-6'],
  check: ['m4.5 12.5 5 5 10-11'],
  github: [
    'M9 19c-4 1.2-4-2.2-5.5-2.7M15 21v-3.4a2.9 2.9 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6 0C6.4 2.6 5.4 2.9 5.4 2.9a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.3c0 4.7 2.8 5.7 5.5 6a2.9 2.9 0 0 0-.8 2.3V21',
  ],
  linkedin: [
    'M15.5 8.5a4.6 4.6 0 0 1 4.5 4.5v6M4.5 9.5V19',
    'M4.5 4.5v.01',
    'M10 19v-5.2a2.3 2.3 0 0 1 4.6 0V19',
  ],
  instagram: [
    'M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4Z',
    'M16.2 7.8h.01',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  ],
}

/* --------------------------------------------------------------- copy to clipboard */

/** Swaps the address for a confirmation, then puts it back. */
const copied = ref(false)
let resetTimer = 0

/**
 * The address, split at the `@` so it has one sensible place to break.
 *
 * `break-all` was breaking it wherever it ran out of room - "jayzeegbautista@gmai"
 * then "l.com", mid-domain. Measured: 139px of usable width in the rail at 11px
 * mono, against 158px for 24 characters, so it does have to wrap. The only
 * question is where, and a line break after the `@` is the one place a reader
 * would have chosen. Shrinking the type instead does not work either: at 10px
 * it still needs 144px.
 */
const [emailName, emailDomain] = profile.email.split('@')

/**
 * Clipboard write, with a fallback that is not optional.
 *
 * `navigator.clipboard` is unavailable outside a secure context and throws
 * rather than returning false when permission is refused, so a bare
 * `await navigator.clipboard.writeText(...)` silently does nothing on a LAN
 * address over http — which is exactly where a visitor (or the author, testing
 * on a phone) would notice a button that "does nothing". The old markup was a
 * plain `mailto:` link, which is exactly as invisible in that situation: it
 * hands off to a mail client and nothing appears to happen on the page at all.
 */
async function writeToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Denied, or not a secure context. Fall through to the legacy path.
  }

  // `execCommand` is deprecated and ugly. It is also the only thing that works
  // in every browser this site has to work in, without a permission prompt.
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    // Off-screen rather than `display: none`, which would make it unselectable.
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

async function copyEmail() {
  const ok = await writeToClipboard(profile.email)
  // No confirmation on failure. Saying "Copied" when nothing was copied is
  // worse than saying nothing at all.
  if (!ok) return
  copied.value = true
  window.clearTimeout(resetTimer)
  resetTimer = window.setTimeout(() => {
    copied.value = false
  }, 1900)
}

onBeforeUnmount(() => window.clearTimeout(resetTimer))
</script>

<template>
  <div class="border-t border-line pt-5">
    <!--
      Sentence case in the sans, not `.meta`.

      `.meta` is the rail's label style: uppercase, mono, 0.14em of tracking.
      Right for a two-word label, wrong here twice over — it turns a sentence
      into three lines in a 168px column, and it uppercases what follows, which
      for an email address is a broken read and for a handle is something nobody
      types.
    -->
    <p class="text-[0.6875rem] leading-[1.45] text-n-400">
      For work, collabs &amp; everything else, reach me at
    </p>

    <ul class="mt-2 flex flex-col gap-[2px]">
      <li>
        <!--
          `min-h-[24px]` on every row. Lighthouse measures the hit box, not the
          ink, and at 11px mono on `leading-tight` these were 16px tall against
          a 24px minimum. Padding was tried first and pushed the block 32px
          taller than the rail had to give; a minimum height centres the glyph in
          the same box instead, so the list grows by 8px a row rather than by
          the whole padded height.
        -->
        <button
          type="button"
          class="group -ml-1.5 flex min-h-[24px] w-full items-center gap-2 pl-1.5 text-left text-n-500 transition-colors hover:text-ink"
          :aria-label="`Copy email address ${profile.email}`"
          @click="copyEmail"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            class="h-3.5 w-3.5 shrink-0 text-n-400 transition-colors group-hover:text-accent"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path v-if="!copied" v-for="d in GLYPHS.mail" :key="d" :d="d" />
            <path v-else :d="GLYPHS.check[0]" />
          </svg>

          <!--
            `aria-hidden` because the button's own label already names the
            address, and reading "jayzeegbautista@gmail.com" then "Copied to
            clipboard" would say the address twice. The swap itself is the
            visible confirmation; the live region below is the announced one.
          -->
          <span
              aria-hidden="true"
              class="font-mono text-[0.6875rem] leading-tight tracking-tight break-words transition-colors"
              :class="copied ? 'text-accent' : 'text-n-400 group-hover:text-n-600'"
            ><template v-if="copied">Copied</template><template v-else>{{ emailName }}<wbr />@{{ emailDomain }}</template></span>

          <span class="sr-only" role="status">{{ copied ? 'Email address copied to clipboard' : '' }}</span>
        </button>
      </li>

      <li v-for="item in social" :key="item.label">
        <a
          :href="item.href"
          class="group -ml-1.5 flex min-h-[24px] items-center gap-2 pl-1.5 text-n-500 transition-colors hover:text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            class="h-3.5 w-3.5 shrink-0 text-n-400 transition-colors group-hover:text-accent"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path v-for="(d, i) in GLYPHS[item.icon]" :key="i" :d="d" />
          </svg>
          <span class="font-mono text-[0.6875rem] leading-tight tracking-tight text-n-400 transition-colors group-hover:text-n-600">{{ item.short }}</span>
        </a>
      </li>
    </ul>
  </div>
</template>