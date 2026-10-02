<script setup>
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import ChatAvatar from './ChatAvatar.vue'
import { useClock } from '../../composables/useClock.js'
import { chat, profile } from '../../data/portfolio.js'

/**
 * A small assistant panel driven by a fixed list of questions.
 *
 * There is no model, no API and no text input — you pick a question and the
 * matching answer comes back. It is the same shape as a real chat UI so it
 * behaves the way people expect (messages stack, the newest is scrolled into
 * view, Escape closes), with none of the plumbing.
 *
 * The pause before an answer appears is a `setTimeout`, not a network call.
 * It exists so clicking a question reads as a response rather than a page swap.
 *
 * Two motion decisions, both of them about the open and close:
 *
 * · **The panel scales out of the launcher.** `transform-origin` is pinned to
 *   bottom-right so it grows from the button that summoned it rather than
 *   from its own centre.
 * · **Open and close are the same speed.** They used to differ, on the
 *   reasoning that a dismissal should get out of the way. See the note on
 *   `.chat-panel-enter-active` in the stylesheet for why that stopped being true.
 *
 * No `prefers-reduced-motion` gate, matching the scroll and the typewriter —
 * these are short opacity and transform changes, not movement through space.
 * There *was* one on the typing dots here, and a blanket reset elsewhere that
 * collapsed every duration on the site to 0.01ms. Both are gone; see the note at
 * the bottom of `style.css`.
 */

const open = ref(false)
const typing = ref(false)
const messages = ref([])

/** Live clock, shown in the header while the panel is open. */
const { time, zone } = useClock()

/**
 * True while an answer is being typed out, as distinct from `typing`, which is
 * the three-dot pause before it starts. Kept apart because they are different
 * states with different affordances, but either one means the widget is busy.
 */
const streaming = ref(false)

/**
 * Which message the reveal loop is currently writing into.
 *
 * Kept separately from `streaming` because the caret has to be attached to one
 * specific row in the log, not merely to "something is happening".
 */
const streamingId = ref(null)

const logEl = ref(null)
const panelEl = ref(null)
const chipRow = ref(null)
const launcherEl = ref(null)
const firstChipEl = ref(null)

/* --- drag to scroll the question row ----------------------------------
 *
 * A horizontal strip is close to unusable with a plain mouse wheel, which only
 * emits vertical deltas. Browsers translate that into horizontal scrolling
 * inconsistently — Firefox and Safari want Shift held, and a trackpad is
 * required to emit `deltaX` at all. So on a desktop the row simply looked
 * stuck.
 *
 * Dragging it with the pointer is the fix. Touch and pen already swipe natively,
 * so the handler declines anything that is not a mouse — otherwise this fights
 * the platform gesture rather than replacing it.
 *
 * `suppressClick` is the part that is easy to forget: a drag that ends over a
 * chip fires that chip on release, so a visitor trying to scroll the row would
 * ask a question they did not mean to ask. The flag lives for exactly one
 * gesture — set on pointer-up, consumed by the click that follows, cleared on
 * the next pointer-down.
 *
 * This was removed on the theory that the row was why questions were hard to tap
 * on a phone. That was wrong: the row was fine, and what actually broke was the
 * panel being sized in `100vw`, which includes a classic scrollbar and pushed
 * the whole widget off the left edge. Removing the row made it worse — a wrapped
 * stack of seven chips took four rows and pushed the panel up over the top bar.
 */
let chipDrag = null
let suppressClick = false

function onChipPointerDown(event) {
  suppressClick = false
  if (event.pointerType !== 'mouse') return

  const el = chipRow.value
  if (!el) return

  chipDrag = { id: event.pointerId, startX: event.clientX, startScroll: el.scrollLeft, moved: 0 }
  // Capture is a nicety — it keeps the drag alive if the pointer leaves the row.
  // A throw here must not abort the handler and leave a drag half-armed.
  try {
    el.setPointerCapture?.(event.pointerId)
  } catch {
    /* no active pointer with that id — carry on without capture */
  }
}

function onChipPointerMove(event) {
  if (!chipDrag || event.pointerId !== chipDrag.id) return
  const el = chipRow.value
  if (!el) return

  const dx = event.clientX - chipDrag.startX
  chipDrag.moved = Math.max(chipDrag.moved, Math.abs(dx))
  // A couple of pixels of jitter is a click, not a drag. Only commit past that,
  // so a plain click on a chip never leaves the row looking grabbed.
  if (chipDrag.moved < 3) return

  event.preventDefault()
  el.scrollLeft = chipDrag.startScroll - dx
  el.classList.add('chips-scroll--dragging')
}

function onChipPointerUp(event) {
  if (!chipDrag || event.pointerId !== chipDrag.id) return

  if (chipDrag.moved > 4) suppressClick = true

  // Cleared *before* the capture release below. It used to run last, and
  // `releasePointerCapture` throws if the pointer is already gone — which left
  // `chipDrag` set and `suppressClick` leaking into the next genuine click,
  // quietly eating it.
  chipDrag = null

  const el = chipRow.value
  el?.classList.remove('chips-scroll--dragging')
  try {
    el?.releasePointerCapture?.(event.pointerId)
  } catch {
    /* already released */
  }
}

/** Capture phase, so it runs before the chip's own click handler. */
function onChipRowClick(event) {
  if (!suppressClick) return
  suppressClick = false
  event.preventDefault()
  event.stopPropagation()
}

/**
 * The mouse wheel, mapped onto the row's horizontal axis while the cursor is
 * over it.
 *
 * A wheel only reports `deltaY`, so a horizontal strip is unreachable with one
 * unless something translates it. `deltaMode` is normalised because some
 * platforms report lines rather than pixels, which would otherwise make the
 * row crawl.
 *
 * The part that matters is what happens at the ends. The gesture is only
 * consumed while the row can still move that way; once it is pinned to a limit
 * the wheel is handed straight back to the page. Without that, hovering the
 * chips would trap the reader — the page would not scroll, and the row would not
 * move either, so the only way past it was to move the mouse somewhere else.
 */
function onChipWheel(event) {
  const el = chipRow.value
  if (!el) return

  // Pinch-to-zoom arrives as a ctrl-modified wheel. Never touch it.
  if (event.ctrlKey) return
  // Shift+wheel already scrolls a horizontal container natively. Handling it
  // here as well would scroll it twice as fast as the gesture asks for.
  if (event.shiftKey) return

  const max = el.scrollWidth - el.clientWidth
  if (max <= 0) return

  const dy = event.deltaY * (event.deltaMode === 1 ? 16 : 1)
  // Already horizontal — a trackpad swipe or a sideways wheel. Leave it be.
  if (Math.abs(dy) <= Math.abs(event.deltaX)) return

  const atStart = el.scrollLeft <= 0
  const atEnd = el.scrollLeft >= max - 1
  if ((dy < 0 && atStart) || (dy > 0 && atEnd)) return

  event.preventDefault()
  el.scrollLeft += dy
}

/** Keep the log from growing without bound if someone taps every question. */
const MAX_MESSAGES = 12

/**
 * How long the three dots stay up before any text appears.
 *
 * The pause is a `setTimeout`, not a network call — it exists so tapping a
 * question reads as a reply rather than a page swap. A second is roughly how
 * long a person takes to decide the question was accepted before starting to
 * read.
 */
const ANSWER_DELAY_MS = 1000

/** Per-character reveal rate, and the floor and ceiling on the total. */
const PER_CHAR_S = 0.011
const MIN_STREAM_MS = 400
const MAX_STREAM_MS = 2000

/** Pending answer timers, and the reveal loop's own state. */
let pending = []
let streamRaf = 0
let shown = 0

/**
 * The bot-side bubble.
 *
 * Written once because it appears in three places — the greeting, every answer,
 * and the typing indicator — and a chat where the indicator is a different shape
 * from the message that replaces it reads as a glitch rather than as a beat.
 *
 * `bg-n-50` sits one step off the panel's `bg-paper`, so it reads as a bubble
 * without competing with the question's `bg-n-100`: filled on the right, one
 * step lighter on the left, and the avatars and alignment say which is which.
 */
const BOT_BUBBLE =
  'max-w-[16rem] rounded-[10px] bg-n-50 px-3 py-2 text-[0.8125rem] leading-[1.6] text-n-700'

/**
 * Pin the log to the newest message.
 *
 * Called on both halves of an exchange — when the question is echoed, and again
 * when the answer arrives — so the newest line is always the one on screen.
 *
 * `logEl` must stay bound to a real element, not a component. See the comment on
 * the scroller in the template: a template ref on `<TransitionGroup>` resolves to
 * the component instance, and assigning `scrollTop` to that does nothing at all,
 * silently.
 */
function scrollToLatest() {
  nextTick(() => {
    const el = logEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

/**
 * Resolve a question's answer.
 *
 * Normally a plain string, but it may be a function for anything that has to be
 * true at the moment it is asked rather than when the file was written — the
 * current time, for instance. A hardcoded clock in the data file would be wrong
 * the instant it shipped.
 */
function answerFor(question) {
  return typeof question.answer === 'function' ? question.answer() : question.answer
}

/**
 * Type an answer out, one character at a time.
 *
 * Time-based rather than frame-based, so the answer takes the same wall-clock
 * duration whatever the frame rate — a loop that revealed one character per
 * frame would type four times faster on a 120Hz screen than on a 60Hz one.
 *
 * The duration is capped. The longest answer here is roughly 300 characters, and
 * at a readable per-character rate that is over three seconds of watching; past
 * the cap the rate rises instead, because an answer that takes four seconds to
 * finish stops reading as typing and starts reading as a stall.
 *
 * `entry` is created with `reactive()`, and that is load-bearing rather than
 * decorative. This loop assigns `entry.text` on every frame. `messages` is a
 * `ref`, so the array is a proxy and each element is wrapped when the template
 * reads it - but assigning to the raw handle goes around the setter, so no
 * dependency is notified and nothing re-renders. The answer then appeared in a
 * single jump at the end, when `streaming.value = false` happened to trigger a
 * render for its own reasons. Every sample taken during a reveal was either
 * empty or the whole string.
 */
function streamAnswer(entry, full) {
  const chars = [...full]
  // The `* 1000` is the whole bug this line used to have. `PER_CHAR_S` is
  // seconds per character, so `chars.length * PER_CHAR_S` comes out in seconds -
  // 638 characters is 7.018, not 7018 - and was then compared against two
  // bounds that are in milliseconds. `Math.max(400, 7.018)` is 400, so every
  // single answer typed out in exactly `MIN_STREAM_MS` and `MAX_STREAM_MS` was
  // dead code: a 638-character answer was delivered in 400ms, which is not
  // typing, it is a jump cut. Measured before the fix, every reveal finished in
  // 401ms regardless of length.
  const duration = Math.min(MAX_STREAM_MS, Math.max(MIN_STREAM_MS, chars.length * PER_CHAR_S * 1000))
  const started = performance.now()

  const step = () => {
    const progress = Math.min(1, (performance.now() - started) / duration)
    const count = Math.floor(progress * chars.length)

    if (count !== shown) {
      shown = count
      entry.text = chars.slice(0, count).join('')
      scrollToLatest()
    }

    if (progress >= 1) {
      entry.text = full
      streaming.value = false
      // Cleared last: the caret should vanish in the same render that completes
      // the text, never one frame early or one frame late.
      streamingId.value = null
      scrollToLatest()
      return
    }

    streamRaf = requestAnimationFrame(step)
  }

  shown = 0
  streamRaf = requestAnimationFrame(step)
}

function ask(question) {
  // Busy for the whole exchange — the dots *and* the reveal. Letting a second
  // question through mid-reveal would start two loops writing to the same message.
  if (typing.value || streaming.value) return

  messages.value.push({ id: question.id + messages.value.length, from: 'me', text: question.chip })
  typing.value = true
  scrollToLatest()

  pending.push(
    window.setTimeout(() => {
      // Phase one ends, phase two begins: the dots clear and the text starts.
      typing.value = false

      const entry = reactive({
        id: question.id + messages.value.length,
        from: 'bot',
        text: '',
      })
      messages.value = [...messages.value, entry].slice(-MAX_MESSAGES)
      scrollToLatest()

      streaming.value = true
      streamingId.value = entry.id
      streamAnswer(entry, answerFor(question))
    }, ANSWER_DELAY_MS),
  )
}

function toggle() {
  open.value = !open.value
  if (open.value) scrollToLatest()
}

function close() {
  open.value = false
  nextTick(() => launcherEl.value?.focus())
}

/** Escape works from anywhere inside the widget, not only the message log. */
function onKeydown(event) {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    close()
  }
}

/**
 * Keeps the wheel inside the panel while the cursor is over it.
 *
 * The log is a scroll container, but the header and the question row are not,
 * so a wheel over either fell straight through to the document and the whole
 * page slid out from under the cursor — which reads as the chat being broken
 * rather than as a scroll region.
 *
 * So the rule is stated at the panel, where the region actually is:
 *
 * · the cursor is over the log → the log scrolls, natively
 * · the log is spent, or the cursor is anywhere else → refused
 *
 * Swallowing rather than chaining is the point. Handing a spent gesture back to
 * the document would give the page the movement that was just refused here, so
 * there would be no way to tell the two apart. The trade-off is deliberate: when
 * there is nothing left to scroll, the wheel does nothing at all under the
 * cursor, and the page is scrolled by moving the pointer off the panel.
 */
function onPanelWheel(event) {
  // Pinch-to-zoom is a ctrl-modified wheel and is never ours to consume.
  if (event.ctrlKey) return
  // The question row already used this gesture for its own horizontal scroll.
  if (event.defaultPrevented) return

  const log = logEl.value
  const target = event.target

  if (log && target instanceof Node && (target === log || log.contains(target))) {
    const max = log.scrollHeight - log.clientHeight
    const canScroll =
      max > 1 && (event.deltaY > 0 ? log.scrollTop < max - 1 : log.scrollTop > 0)

    // The log is the scroll container under the cursor, so let it take the
    // gesture natively. Once it is spent the gesture has to be refused rather
    // than handed on, or the document inherits the movement refused here.
    if (canScroll) return
    event.preventDefault()
    return
  }

  event.preventDefault()
}

/**
 * Bound by hand rather than as `@wheel`, because the handler has to be able to
 * call `preventDefault` and so the listener cannot be passive.
 */
function bindPanelWheel() {
  const panel = panelEl.value
  if (!panel) return
  panel.removeEventListener('wheel', onPanelWheel)
  panel.addEventListener('wheel', onPanelWheel, { passive: false })
  bindChipWheel()
}

function unbindPanelWheel() {
  panelEl.value?.removeEventListener('wheel', onPanelWheel)
  unbindChipWheel()
}

function bindChipWheel() {
  const el = chipRow.value
  if (!el) return
  el.removeEventListener('wheel', onChipWheel)
  el.addEventListener('wheel', onChipWheel, { passive: false })
}

function unbindChipWheel() {
  chipRow.value?.removeEventListener('wheel', onChipWheel)
}

document.addEventListener('keydown', onKeydown)

watch(open, async (isOpen) => {
  if (!isOpen) return
  // Land on the first question so a keyboard visitor can ask straight away.
  await nextTick()
  firstChipEl.value?.focus()
  bindPanelWheel()
})

onBeforeUnmount(() => {
  pending.forEach(window.clearTimeout)
  // The reveal loop outlives the component unless it is explicitly cancelled.
  window.cancelAnimationFrame(streamRaf)
  unbindPanelWheel()
  chipRow.value?.classList.remove('chips-scroll--dragging')
  chipDrag = null
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <!--
    Sits under the mobile menu (z-50) and the lightbox (z-70).

    `inset-x-0` plus padding, rather than anchoring with `right-*` and sizing the
    panel in `vw`. `100vw` is the width *including* a classic scrollbar, so
    `calc(100vw - 1.5rem)` was 15px wider than the space actually available on a
    desktop browser, and because the panel is right-anchored that 15px came out
    of the left edge instead: it measured `left: -3px` at a 375px viewport, so
    three pixels of the panel hung off the side of the screen. A fixed element
    spanning `left: 0` to `right: 0` already excludes the scrollbar, so
    constraining the width by percentage here is exact.

    Known tradeoff: between roughly 768px and 1100px the content column ends
    within ~30px of the viewport edge, so this 48px launcher overlaps the right
    margin of project rows and of the footer. It cannot be offset clear — there
    is no room left to give it. Only the circle's left cap reaches the content,
    it moves with the scroll, and the container is pointer-events-none so only
    the button itself captures clicks. Every floating chat widget behaves this
    way; avoiding it entirely would need a layout change.
  -->
  <div
    class="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 px-3 lg:bottom-6 lg:left-auto lg:right-6 lg:px-0"
  >
    <!--
      This column is the thing that has to fit the screen, not the panel.

      It holds the panel *and* the launcher row, and the whole column is pinned
      `bottom-0.75rem` (1.5rem from `lg`). So a panel that grows with its
      conversation pushes the column upward past the top of the viewport, and
      because the panel is the first child the part that goes missing is its own
      header - avatar, name, and the close button:

        667 x 375 landscape   column 391px   top -21   header 35% gone, close button off-screen
        844 x 390 landscape   column 391px   top -13   header 20% gone, close button at y=3
        740 x 360 landscape   column 377px   top -29   header 47% gone, close button off-screen

      Capping the column is what fixes it, rather than capping the panel. The
      panel's own available height depends on the launcher row's 48px, which is
      a size this file would otherwise have to restate and keep in step; capping
      the column lets the flex algorithm hand the panel exactly what is left
      after the launcher, so the two cannot drift apart.

      `justify-end` keeps the launcher at the bottom when the column does have
      spare room, so the panel sits directly above it rather than the column
      growing downward and pushing the launcher toward the edge.
    -->
    <div class="mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[22rem] flex-col items-end justify-end lg:mx-0">
    <Transition name="chat-panel">
      <!--
        Mobile-first sizing, and it is a `min()` rather than a media query
        because the constraint is the viewport width, not a breakpoint: full
        width less the gutters on a phone, a comfortable column from about 380px
        up, and never wider than 22rem so the bubbles keep a readable measure on
        a large display.

        The height is capped against `100dvh` rather than `100vh`. The layout
        viewport is taller than a phone screen once the browser's URL bar is in
        play, so a panel sized to it puts the questions below the fold.

        The panel carries `max-h` as well, and it is the panel that needs it
        rather than the log inside it. The log was already capped, but the panel
        is bottom-anchored, so a capped log that still overflowed simply pushed
        the *panel* upward and the panel was free to grow without limit. On a
        phone held sideways that put its own header off the top of the screen:

          667 x 375   panel top -21px   header 35% cut off   close button off-screen
          844 x 390   panel top -13px   header 20% cut off   close button at y=3

        Both are landscape phones, which is exactly where height is scarcest and
        the conversation is longest at the same time. Worse, both still measured
        as fitting while the panel was empty - the log's cap only bites once
        there is enough text to reach it, so a check on the default state says
        everything is fine and only a real exchange finds it.

        `calc(100dvh - 1.5rem)` on the wrapper above is what stops the panel
        running off the top; `min-h-0` here is what lets it actually give way
        when that cap bites. A flex item defaults to `min-height: auto`, which
        refuses to shrink below its content - so without this the log would keep
        its full height, the wrapper cap would be exceeded anyway, and the header
        would go off-screen exactly as before. The two have to be paired.
      -->
      <div
        v-if="open"
        ref="panelEl"
        role="dialog"
        aria-label="Ask about Jayzee"
        class="chat-panel pointer-events-auto mb-3 flex min-h-0 w-[min(22rem,calc(100vw-1.5rem))] max-w-full flex-col overflow-hidden rounded-[14px] border border-line bg-paper shadow-[0_18px_44px_-26px_rgba(10,10,10,0.4)]"
      >
        <!-- header -->
        <header class="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
          <ChatAvatar size="md" />

          <div class="min-w-0 flex-1">
            <p class="truncate text-[0.8125rem] font-medium leading-tight tracking-[-0.01em]">
              {{ profile.fullName }}
            </p>
            <p class="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] leading-tight text-n-500">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-[#22c55e]" aria-hidden="true"></span>
              Online
              <!--
                Labelled with the timezone rather than left bare. An unlabelled
                clock on a portfolio is ambiguous: a visitor in another country
                cannot tell whether they are looking at their own time or his.
              -->
              <span class="text-n-300" aria-hidden="true">·</span>
              <span class="tabular-nums">{{ time }}</span>
              <span class="text-n-400">{{ zone }}</span>
            </p>
          </div>

          <button
            type="button"
            class="-mr-1 p-1 text-n-400 hover:text-ink"
            aria-label="Close the assistant"
            @click="close"
          >
            <svg viewBox="0 0 24 24" fill="none" class="h-4 w-4" aria-hidden="true">
              <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <!--
          The conversation.

          The scroller is a plain div, deliberately, and the TransitionGroup
          sits inside it as nothing but layout. It used to be the other way
          round, with `ref="logEl"` on the TransitionGroup — and a template ref
          on a component resolves to the *component instance*, not to its root
          element. So `scrollTop` was being assigned to a proxy object and the
          log never moved: it sat at scrollTop 0 with 598px of content below the
          fold, with nothing in the console to show for it. The scroll container
          has to be a real element for a ref to reach it.

          `max-h` rather than `flex-1`: the panel is not a fixed-height box, so
          with one short exchange it is as tall as the content and sits on the
          launcher rather than floating in a void above it.

          `min-h-0` is load-bearing and was missing. A flex item defaults to
          `min-height: auto`, which refuses to shrink below its content, so the
          `max-h` above could never actually bite: the element grew to whatever
          the conversation needed and the *panel* absorbed the difference. With
          the panel now capped against the viewport (see its own class), this is
          what lets the log give the space back instead of pushing the header off
          the top of the screen.
        -->
        <div
          ref="logEl"
          class="min-h-0 max-h-[min(19rem,46dvh)] overflow-y-auto overscroll-contain px-4 py-4"
        >
          <TransitionGroup tag="div" name="chat-msg" class="flex flex-col gap-4">
            <!-- greeting -->
            <div key="greeting" class="flex items-start gap-2.5">
              <ChatAvatar class="mt-1.5" />
              <p :class="BOT_BUBBLE">
                Hi — I'm {{ profile.firstName }}. Pick a question and I'll answer it.
              </p>
            </div>

            <div
              v-for="message in messages"
              :key="message.id"
              class="flex"
              :class="message.from === 'me' ? 'justify-end' : 'items-start gap-2.5'"
            >
              <!-- bot -->
              <template v-if="message.from === 'bot'">
                <ChatAvatar class="mt-1.5" />
                <!--
                  No whitespace between the text and the caret: a template
                  newline here would render as a space and put a gap in the
                  middle of the word being typed.
                -->
                <p :class="BOT_BUBBLE">
                  {{ message.text }}<span
                    v-if="message.id === streamingId"
                    class="chat-caret"
                    aria-hidden="true"
                  ></span>
                </p>
              </template>

              <!-- the question, echoed back -->
              <p
                v-else
                class="max-w-[16rem] rounded-[10px] bg-n-100 px-3 py-2 text-[0.8125rem] leading-[1.55] text-n-800"
              >
                {{ message.text }}
              </p>
            </div>

            <!--
              Typing indicator, in the same bubble the answer will land in.

              Same `BOT_BUBBLE`, same alignment, same avatar offset — so the dots
              visibly *become* the reply rather than one block being swapped for
              another. The dots keep their own tight padding because they need to
              sit on the text baseline, not be centred in it.
            -->
            <div v-if="typing" key="typing" class="flex items-start gap-2.5">
              <ChatAvatar class="mt-1.5" />
              <p :class="[BOT_BUBBLE, 'flex items-center']">
                <span class="flex items-center gap-1" aria-label="Jayzee is typing">
                  <span class="dot h-1 w-1 rounded-full bg-n-400"></span>
                  <span class="dot h-1 w-1 rounded-full bg-n-400"></span>
                  <span class="dot h-1 w-1 rounded-full bg-n-400"></span>
                </span>
              </p>
            </div>
          </TransitionGroup>
        </div>

        <!--
                    Question chips — this replaces a text input entirely.

          A single horizontal row that swipes, not a vertical stack. Seven
          full-width rows made the panel far taller than the conversation in it,
          which is the wrong balance: the chips are a launcher, not the content,
          and they were pushing the actual messages off screen.

          Three details that make a horizontal scroller feel intentional rather
          than broken:

          · The scroll area stays inside the panel's padding. It originally
            bled with `-mx-4 px-4` so a chip could slide under the rounded
            corner — except the panel is `overflow-hidden` for those corners, so
            15px of the first chip was clipped off and hit-testing over it
            returned the panel. The bleed bought a peek and cost a chip.
          · The scrollbar is hidden. A visible 8px bar under a row of bordered
            chips looks like a bug, and on a touch device it is a scroll target
            nobody aims for.
          · `overscroll-behavior-x: contain` stops a horizontal flick from being
            handed to the message log above it.

          Two ways in, because neither one covers the other. The wheel is
          translated onto the horizontal axis while the cursor is over the row,
          and the row also drags with the pointer. Keyboard users are not
          stranded either: the chips are buttons, so arrowing along them scrolls
          them into view, and the first one receives focus when the panel opens.
        -->
        <div class="shrink-0 border-t border-line pb-3.5 pt-3.5">
          <p class="meta mb-2.5 px-4 text-n-400">Ask me</p>
          <div
            ref="chipRow"
            class="chips-scroll flex gap-2 overflow-x-auto px-4"
            @pointerdown="onChipPointerDown"
            @pointermove="onChipPointerMove"
            @pointerup="onChipPointerUp"
            @pointercancel="onChipPointerUp"
            @click.capture="onChipRowClick"
          >
            <button
              v-for="(question, i) in chat"
              :key="question.id"
              :ref="i === 0 ? (el) => (firstChipEl = el) : undefined"
              type="button"
              class="group flex shrink-0 items-center gap-2 whitespace-nowrap border border-line px-3 py-2.5 text-left text-[0.8125rem] leading-tight text-n-600 transition-colors hover:border-n-400 hover:text-ink disabled:opacity-40"
              :disabled="typing || streaming"
              @click="ask(question)"
            >
              <span>{{ question.chip }}</span>
              <svg
                viewBox="0 0 16 16"
                class="h-3 w-3 shrink-0 text-n-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-n-500"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2.5 8H13M9 4L13 8L9 12"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

      </div>
    </Transition>

    <!-- launcher -->
    <div class="pointer-events-auto flex justify-end">
      <button
        ref="launcherEl"
        type="button"
        class="grid h-12 w-12 place-items-center rounded-full border border-line bg-paper text-ink shadow-[0_10px_28px_-16px_rgba(10,10,10,0.45)] transition-colors hover:bg-n-50"
        :aria-label="open ? 'Close assistant' : 'Open assistant'"
        :aria-expanded="open"
        @click="toggle"
      >
        <Transition name="chat-icon" mode="out-in">
          <svg
            v-if="!open"
            key="open"
            viewBox="0 0 24 24"
            fill="none"
            class="h-[18px] w-[18px]"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M4 5.5h16v10H10l-4.5 4v-4H4z M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"
            />
          </svg>
          <svg
            v-else
            key="close"
            viewBox="0 0 24 24"
            fill="none"
            class="h-[18px] w-[18px]"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
          </svg>
        </Transition>
      </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
  The question row.

  Firefox and the standards track both take `scrollbar-width: none`; the
  WebKit/Blink pseudo-element covers the rest. Without both, a visible bar sits
  directly under a row of bordered chips.
*/
.chips-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
  /* A horizontal flick must not be handed to the message log above it. */
  overscroll-behavior-x: contain;
  /* Room for the chip focus ring, which would otherwise be clipped. */
  padding-block: 2px;
  /*
     `grab` is the affordance. Without it the row gives no hint that it moves at
     all, and a visitor with a mouse has no other way of finding out short of
     trying. It does not affect touch, which keeps the native swipe.
  */
  cursor: grab;

  /*
     Must match `px-4`, and it is not cosmetic.

     Snap positions and focus scrolling are both measured from the scrollport's
     start edge, while the chips sit 16px in from it. Without this the browser
     resolved the first chip's start-aligned snap to `scrollLeft: 16`, so the row
     rested with the first chip flush against the panel border and no left inset
     — and any focus landing in the row yanked it 16px out of alignment.

     Pairing the two insets keeps `scrollLeft: 0` the natural start, and lets the
     last chip stop with the same 16px on its right as the first has on its left.
  */
  scroll-padding-inline: 1rem;
}

.chips-scroll--dragging {
  cursor: grabbing;
  /* Stop the drag selecting every chip label it passes over. */
  user-select: none;
}

.chips-scroll::-webkit-scrollbar {
  display: none;
}

/*
  No scroll snapping on this row, which was a deliberate call after measuring it.

  Snapping was here so a touch flick would land cleanly on a chip. The measured
  snap positions are 1 / 138 / 245 / 365 / 488 / 613 / 739 — 110 to 138px apart —
  so proximity snap re-pulled any scroll that finished more than half a chip
  away from the nearest snap line. The consequences were not cosmetic:

  · a Firefox wheel notch is 53px, which is inside that dead zone, so the very
    first notch did nothing at all and the row looked broken
  · line-mode deltas did nothing
  · any slow trackpad drag moved a few pixels and sprang back

  The wheel is the primary input on a desktop, so it gets a 1:1 mapping and free
  positioning. Touch still decelerates natively, and the row is only 42px tall,
  so a flick landing between chips costs nothing.
*/

/*
  Pinned so the panel grows out of the launcher button in the corner below it,
  rather than scaling from its own centre.
*/
.chat-panel {
  transform-origin: bottom right;
}

/* Out faster than in — see the note in the script. */
/*
  Open and close at the same speed, on the same curve.

  It used to open in 260ms and close in 180ms with `ease-in`, on the reasoning
  that a dismissal should get out of the way. On a panel that now carries a full
  conversation that reads as the panel being snatched away mid-gesture rather than
  as it closing - especially when it is opened and closed repeatedly, which is
  exactly what someone is doing while they are trying the questions out. One
  duration, one curve, both directions.
*/
.chat-panel-enter-active,
.chat-panel-leave-active {
  transition:
    opacity 240ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
.chat-panel-enter-from,
.chat-panel-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}

/* Messages arrive rather than blinking into existence. */
.chat-msg-enter-active {
  transition:
    opacity 220ms ease,
    transform 220ms cubic-bezier(0.32, 0.72, 0, 1);
}
.chat-msg-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

/*
  The launcher glyph swaps. `mode="out-in"` in the template means the two never
  overlap, so a half-faded pair cannot appear mid-rotation. The leaving glyph
  is taken out of flow so it cannot nudge the button while it fades.
*/
.chat-icon-enter-active,
.chat-icon-leave-active {
  transition:
    opacity 160ms ease,
    transform 220ms cubic-bezier(0.32, 0.72, 0, 1);
}
.chat-icon-leave-active {
  position: absolute;
}
.chat-icon-enter-from {
  opacity: 0;
  transform: rotate(-70deg) scale(0.7);
}
.chat-icon-leave-to {
  opacity: 0;
  transform: rotate(70deg) scale(0.7);
}

/*
  The caret, shown at the end of an answer while it is being typed.

  This is what makes the reveal read as *typing* rather than as text simply
  getting longer — the same cue a real cursor gives. Without it the eye has
  nothing to anchor to and the growth just looks like a loading glitch.

  `steps(1)` on the opacity rather than a smooth fade: a cursor that eases in and
  out looks like a breathing pill, not a caret. A hard on/off at a steady 1s is
  what a terminal actually does.
*/
.chat-caret {
  display: inline-block;
  width: 1.5px;
  height: 0.95em;
  margin-left: 2px;
  vertical-align: -0.14em;
  background: currentColor;
  animation: chat-caret-blink 1s steps(1) infinite;
}

@keyframes chat-caret-blink {
  0%,
  50% {
    opacity: 1;
  }
  50.01%,
  100% {
    opacity: 0;
  }
}

/* The typing dots, staggered so they read as a pulse. */
.dot {
  animation: chat-dot 1.1s ease-in-out infinite;
}
.dot:nth-child(2) {
  animation-delay: 0.15s;
}
.dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes chat-dot {
  0%,
  60%,
  100% {
    opacity: 0.25;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-2px);
  }
}
</style>