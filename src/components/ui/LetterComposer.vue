<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useClock } from '../../composables/useClock.js'
import { profile } from '../../data/portfolio.js'

/**
 * A letter composer that hands off to the visitor's own mail client.
 *
 * There is no endpoint behind this and there is deliberately no third-party form
 * service. A portfolio is a static site with nowhere to POST a message, and
 * wiring one up would mean shipping someone's mail through an infrastructure the
 * owner did not choose. So the letter is assembled into a `mailto:` and the
 * visitor's mail app opens with it already written — they see the recipient and
 * the whole body before anything leaves, which is the property a hosted form
 * form-service cannot offer.
 *
 * What is worth getting right in that arrangement:
 *
 * · **The recipient is on screen.** Stated in the header, not hidden in a
 *   `mailto:` URL, so there is never a moment of not knowing where it is going.
 * · **The message is capped at 1000 characters.** Browsers and mail clients
 *   disagree about how long a `mailto:` they will honour — around 2000
 *   characters is where it gets unreliable. The counter is there so the limit is
 *   visible while writing rather than discovered at send time.
 * · **The visitor's own name and reply address go in the body**, because a
 *   `mailto:` sets the recipient but has nowhere to set a sender. Without this
 *   the letter arrives with no way to answer it.
 * · **Nothing is validated that does not need to be.** The message cannot be
 *   empty, and an address that is present but malformed is flagged — but no
 *   email is *required*, since the mail client is going to attach their real one.
 *
 * The letter is dated with the site clock, which is pinned to Manila like
 * everything else here, rather than the visitor's timezone — two clocks on one
 * page would be a puzzle.
 */
const MAX = 1000

const name = ref('')
const email = ref('')
const message = ref('')

const { date } = useClock()

/** Present-but-malformed is worth catching; absent is not. */
const addressOk = computed(() => {
  const value = email.value.trim()
  return value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
})

const canSend = computed(() => message.value.trim().length > 0 && addressOk.value)

const remaining = computed(() => MAX - message.value.length)

/**
 * The letter itself, assembled once.
 *
 * Both destinations below read from this, so the two buttons cannot send
 * different things. Assembling it per-destination is how a mailto and a Gmail
 * link quietly drift apart.
 */
const letter = computed(() => {
  const who = name.value.trim()
  const from = email.value.trim()

  const subject = who ? `Portfolio enquiry from ${who}` : 'Portfolio enquiry'

  const body = [
    'Hi Jayzee,',
    '',
    message.value.trim(),
    '',
    `— ${who || 'Your name'}`,
    from,
  ]
    // Drop the trailing address line when it is empty, so the letter does not
    // sign off with a blank line the reader has to guess at.
    .filter((line, i, all) => line !== '' || i < 4 || i < all.length - 1)
    .join('\n')

  return { to: profile.email, subject, body }
})

/**
 * Primary: the visitor's own mail handler.
 *
 * A real `href` rather than a `location.href` assignment inside a click handler,
 * which means cmd-click and middle-click open it elsewhere instead of hijacking
 * the tab, the link is inspectable, and it degrades to a plain link.
 *
 * `mailto:` is what actually reaches a *native* app — the Gmail app on iOS and
 * Android when it is the registered handler. It is the only route that opens the
 * installed application rather than a web page.
 */
const mailtoHref = computed(() => {
  const { to, subject, body } = letter.value
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
})

/**
 * Secondary: Gmail specifically.
 *
 * `view=cm&fs=1` is Gmail's compose parameter, and it reaches the Gmail *app*
 * on a phone where the app has "open links from other apps" switched on, and the
 * Gmail web compose everywhere else. There is no public deep-link that opens the
 * Gmail app's compose screen without going through a web URL, so this is as
 * close as it gets — which is why it is offered alongside the `mailto:` rather
 * than instead of it.
 *
 * Same URL-length ceiling as the mailto, roughly 2000 characters, which is the
 * other reason the message is capped.
 */
const gmailHref = computed(() => {
  const { to, subject, body } = letter.value
  return (
    'https://mail.google.com/mail/?view=cm&fs=1' +
    `&to=${encodeURIComponent(to)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  )
})

/**
 * Copy the address.
 *
 * `navigator.clipboard` needs a secure context and can still be refused, so
 * there is a hidden input as a fallback — the one case where it matters most is
 * a site opened over plain http on a LAN, which is exactly not a secure context.
 */
const copied = ref(false)
let copyTimer = 0

async function copyAddress() {
  const ok = await writeClipboard(profile.email)
  if (!ok) return

  copied.value = true
  window.clearTimeout(copyTimer)
  copyTimer = window.setTimeout(() => {
    copied.value = false
  }, 1800)
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const el = document.createElement('textarea')
      el.value = text
      el.setAttribute('readonly', '')
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      el.remove()
      return ok
    } catch {
      return false
    }
  }
}

onBeforeUnmount(() => window.clearTimeout(copyTimer))
</script>

<template>
  <!--
    Square with a hairline border, like the portrait frame and the resume panel,
    rather than the rounded surfaces the chat uses. It is a document, not a
    control, and this is where the page stops looking like an app.
  -->
  <div class="border border-line">
    <!-- the letter's addressee -->
    <div class="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-b border-line px-5 py-4 sm:px-6">
      <div>
        <p class="meta text-n-400">To</p>
        <p class="mt-2 text-[0.9375rem] break-all text-ink">{{ profile.email }}</p>
      </div>
      <div>
        <p class="meta text-n-400">Date</p>
        <p class="mt-2 text-[0.9375rem] text-n-700">{{ date }}</p>
      </div>
    </div>

    <div class="px-5 py-6 sm:px-6">
      <!-- who is writing -->
      <div class="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        <div>
          <label for="letter-name" class="meta block text-n-400">Your name</label>
          <input
            id="letter-name"
            v-model="name"
            type="text"
            autocomplete="name"
            placeholder="Your name"
            class="mt-2.5 w-full border-b border-line bg-transparent pb-2 text-[0.9375rem] text-ink outline-none transition-colors placeholder:text-n-300 focus:border-ink"
          />
        </div>

        <div>
          <label for="letter-email" class="meta block text-n-400">Your email</label>
          <input
            id="letter-email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="you@company.com"
            :aria-invalid="email.trim().length > 0 && !addressOk"
            class="mt-2.5 w-full border-b bg-transparent pb-2 text-[0.9375rem] outline-none transition-colors placeholder:text-n-300 focus:border-ink"
            :class="email.trim().length > 0 && !addressOk ? 'border-accent' : 'border-line'"
          />
          <p v-if="email.trim().length > 0 && !addressOk" class="meta mt-2 text-accent">
            That address looks incomplete
          </p>
        </div>
      </div>

      <!-- the letter itself -->
      <div class="mt-8">
        <div class="flex items-baseline justify-between gap-4">
          <label for="letter-message" class="meta block text-n-400">Message</label>
          <span class="meta tabular-nums" :class="remaining < 100 ? 'text-accent' : 'text-n-300'">
            {{ message.length }} / {{ MAX }}
          </span>
        </div>

        <textarea
          id="letter-message"
          v-model="message"
          rows="5"
          :maxlength="MAX"
          placeholder="Tell me a bit about what you have in mind…"
          class="mt-2.5 w-full resize-y border-b border-line bg-transparent pb-2 text-[0.9375rem] leading-[1.65] text-ink outline-none transition-colors placeholder:text-n-300 focus:border-ink"
        ></textarea>
      </div>

      <!--
        The button carries the accent because it is the only primary action on
        the page. Everything else on the site is either a link or a hairline.
      -->
      <div class="mt-8 flex flex-wrap items-center gap-x-3 gap-y-3">
        <!--
          Two destinations, one letter.

          Both are anchors with a real `href` rather than buttons that assign
          `location.href`, so cmd-click works and the link is inspectable.

          They are deliberately NOT `role="button"`. That was here first, and it
          is a trap: ARIA says a button must activate on Space, an anchor does
          not, so a `role="button"` link silently stops responding to half of
          what a keyboard expects and needs a keydown handler bolted on to fix.

          The disabled state renders a `<span>` rather than an anchor with the
          `href` pulled. That was the original approach here and Lighthouse
          flagged it as a non-crawlable link — correctly, since `<a>` with no
          `href` is a link to nowhere as far as a crawler is concerned, and this
          site is one page of links. A span cannot be focused and cannot be
          activated, which is the whole point of the disabled state, so it
          describes itself with `aria-disabled` and there is no crawlable
          violation to suppress.
        -->
        <a
          v-if="canSend"
          :href="mailtoHref"
          class="rounded-[10px] bg-accent px-5 py-2.5 text-[0.8125rem] font-medium tracking-[0.01em] text-paper transition-opacity duration-200"
        >
          Send letter
          <!--
            An arrow as SVG, not as a character. U+2192 is outside the `latin`
            subset every font here is served in, so the glyph was being drawn by
            whatever fallback font the OS happened to have — a different shape,
            weight and slant from the label beside it, on the one button that
            matters most in the section.
          -->
          <svg
            viewBox="0 0 16 16"
            class="ml-1.5 inline-block h-3 w-3 align-[-0.05em]"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 8H13M9 4L13 8L9 12" />
          </svg>
        </a>
        <span
          v-else
          aria-disabled="true"
          class="pointer-events-none rounded-[10px] bg-accent px-5 py-2.5 text-[0.8125rem] font-medium tracking-[0.01em] text-paper opacity-35"
        >
          Send letter
          <svg
            viewBox="0 0 16 16"
            class="ml-1.5 inline-block h-3 w-3 align-[-0.05em]"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 8H13M9 4L13 8L9 12" />
          </svg>
        </span>

        <!--
          Outlined, not filled. Only one accent-filled control on the page — the
          primary action. The Gmail route is the same action by another name, so
          it does not get to look like the main one too.
        -->
        <a
          v-if="canSend"
          :href="gmailHref"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-[10px] border border-line px-5 py-2.5 text-[0.8125rem] leading-none font-medium tracking-[0.01em] text-n-600 transition-colors duration-200 hover:border-ink hover:text-ink"
        >
          Open in Gmail
        </a>
        <span
          v-else
          aria-disabled="true"
          class="pointer-events-none rounded-[10px] border border-line px-5 py-2.5 text-[0.8125rem] leading-none font-medium tracking-[0.01em] text-n-600 opacity-35"
        >
          Open in Gmail
        </span>

        <button
          type="button"
          class="meta ml-auto py-2 text-n-500 transition-colors duration-200 hover:text-ink"
          :aria-label="copied ? 'Copied — address copied to clipboard' : `Copy address — ${profile.email} to clipboard`"
          @click="copyAddress"
        >
          <!--
            The tick is SVG for the same reason as the arrow above: U+2713 is
            outside `latin` and was rendering in a fallback face.
          -->
          <span class="inline-flex items-center gap-1">
            <template v-if="copied">
              <svg
                viewBox="0 0 16 16"
                class="h-3 w-3"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3 8.5 6.5 12 13 4.5" />
              </svg>
              Copied
            </template>
            <template v-else>Copy address</template>
          </span>
        </button>
      </div>

      <p class="mt-3 max-w-[36rem] text-[0.75rem] leading-snug text-n-400">
        Either button opens your own mail app with the letter already written —
        you can read the whole thing, and the recipient, before anything is sent.
        Nothing leaves this page.
      </p>
    </div>
  </div>
</template>
