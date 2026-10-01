<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
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
 * It exists so clicking a chip reads as a response rather than a page swap.
 *
 * Three motion decisions, all of them about not cutting:
 *
 * · **The panel scales out of the launcher.** `transform-origin` is pinned to
 *   bottom-right so it grows from the button that summoned it rather than
 *   from its own centre.
 * · **Minimise collapses, it does not `v-if` away.** The body is a
 *   `1fr → 0fr` grid row, which animates to the content's natural height with
 *   no hardcoded pixel maximum to drift out of sync. It also keeps the chips
 *   mounted, so expanding does not rebuild the list and drop focus. That means
 *   the collapsed content is still in the document, so it carries `inert` —
 *   `overflow: hidden` clips without removing anything from the tab order, and
 *   keyboard focus would otherwise walk into content of zero height.
 * · **Closing is faster than opening.** 180ms out, 260ms in. A dismissal the
 *   viewer did not ask for should get out of the way; an arrival they did ask
 *   for is worth watching.
 *
 * No `prefers-reduced-motion` gate, matching the scroll and the typewriter —
 * these are short opacity and transform changes, not movement through space.
 * There *was* one on the typing dots here, and a blanket reset elsewhere that
 * collapsed every duration on the site to 0.01ms. Both are gone; see the note at
 * the bottom of `style.css`.
 */

const open = ref(false)
const minimised = ref(false)
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
const minimiseEl = ref(null)

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
 * That is the failure mode this handler exists to avoid.
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

/** Keep the log from growing without bound if someone taps every chip. */
const MAX_MESSAGES = 12

/**
 * How long the three dots stay up before any text appears.
 *
 * The pause is a `setTimeout`, not a network call — it exists so clicking a chip
 * reads as a reply rather than a page swap. A second is roughly how long a
 * person takes to decide the question was accepted before starting to read.
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
 */
function streamAnswer(entry, full) {
  const chars = [...full]
  const duration = Math.min(MAX_STREAM_MS, Math.max(MIN_STREAM_MS, chars.length * PER_CHAR_S))
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
  // chip through mid-reveal would start two loops writing to the same message.
  if (typing.value || streaming.value) return

  messages.value.push({ id: question.id + messages.value.length, from: 'me', text: question.chip })
  typing.value = true
  scrollToLatest()

  pending.push(
    window.setTimeout(() => {
      // Phase one ends, phase two begins: the dots clear and the text starts.
      typing.value = false

      const entry = {
        id: question.id + messages.value.length,
        from: 'bot',
        text: '',
      }
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
  if (open.value) {
    minimised.value = false
    scrollToLatest()
  }
}

function close() {
  open.value = false
  nextTick(() => launcherEl.value?.focus())
}

/**
 * Collapse or restore the conversation.
 *
 * Focus follows to the minimise button when collapsing. Without that, someone
 * who tabbed into the question list and then minimised would leave focus
 * inside content that is now `height: 0` and invisible — the keyboard would
 * appear to be lost.
 */
function toggleMinimised() {
  minimised.value = !minimised.value
  if (minimised.value) nextTick(() => minimiseEl.value?.focus())
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
 * `overscroll-contain` on the log already handles the log, but only the log. The
 * header and the question row are not scroll containers, so a wheel there fell
 * straight through to the document and the whole page slid out from under the
 * cursor — the panel would sit still while the site moved behind it, which reads
 * as the chat being broken rather than as a scroll region.
 *
 * So the rule is stated at the panel, where the region actually is:
 *
 * · the cursor is over the log  →  the log scrolls, natively
 * · the log is spent, or the cursor is anywhere else in the panel  →  refused
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
    // than handed on, or the document inherits the movement that was refused
    // here.
    if (canScroll) return
    event.preventDefault()
    return
  }

  /*
    Everywhere else in the panel — the header, the question row, the padding —
    there is no scroll container under the cursor at all, so the browser's
    default action for a wheel is to move the document.

    That first version of this guard asked whether the log had room rather than
    where the event landed, so hovering the header let the page slide whenever
    the conversation happened to be long enough to scroll. Asking about the
    target instead is what actually closes it: the header is not inside the log,
    so there is nothing here to scroll, and the page does not move.
  */
  event.preventDefault()
}

/**
 * Bound by hand rather than as `@wheel`, for two reasons: the handlers must be
 * able to call `preventDefault`, so the listeners cannot be passive; and neither
 * the row nor the panel exists until the panel opens, so the binding has to
 * follow the open state rather than the component's lifetime.
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

    Known tradeoff: between roughly 768px and 1100px the content column ends
    within ~30px of the viewport edge, so this 48px launcher overlaps the right
    margin of project rows and of the footer. It cannot be offset clear — there
    is no room left to give it. Only the circle's left cap reaches the content,
    it moves with the scroll, and the container is pointer-events-none so only
    the button itself captures clicks. Every floating chat widget behaves this
    way; avoiding it entirely would need a layout change.
  -->
  <div
    class="pointer-events-none fixed z-40 bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] lg:bottom-6 lg:right-6"
  >
    <Transition name="chat-panel">
      <!--
        The phone.

        A bezel, a screen, and then the panel that was already here, unchanged:
        same header, same log, same chips, same minimise, same wheel
        containment, same Escape, same focus. The mockup is a wrapper, not a
        rewrite, because every one of those behaviours is load-bearing and had
        already been reasoned about.

        The bezel is `bg-n-900` rather than black so it tracks the theme - on the
        light theme a true black frame reads as a hole punched in the page. The
        screen keeps `bg-paper`, which is what makes the content inside it look
        like a display rather than a card.

        Sizing is the load-bearing part. `21rem` wide is the panel's old width
        and the bezel costs 10px, so the screen is a shade narrower - it has to
        be, or the frame would push the panel out past the viewport on a 360px
        device. The height is capped against `100dvh` for the same reason the
        menu is: the layout viewport is taller than the screen on a phone, and a
        panel sized to it puts the question row below the fold.

        `aria-hidden` on the bezel and the status bar. The status bar shows a
        clock that is already in the panel header three lines below it, and
        `aria-hidden` stops a screen reader announcing the same time twice.
      -->
      <div
        v-if="open"
        ref="panelEl"
        role="dialog"
        aria-label="Ask about Jayzee"
        class="chat-panel pointer-events-auto mb-3 w-[min(21.5rem,calc(100vw-1.25rem))] max-w-full rounded-[2.25rem] bg-n-900 p-[5px] shadow-[0_18px_44px_-26px_rgba(10,10,10,0.5)]"
      >
        <div class="relative flex max-h-[min(40rem,calc(100dvh-5.5rem))] flex-col overflow-hidden rounded-[1.85rem] bg-paper">
          <!-- Dynamic Island -->
          <div class="absolute left-1/2 top-[7px] z-10 h-[1.4rem] w-[4.5rem] -translate-x-1/2 rounded-full bg-n-950" aria-hidden="true"></div>

          <!--
            Status bar. Signal, wifi and battery are drawn as shapes rather than
            characters: an emoji or a glyph from a symbol font renders at a
            different weight on every platform, and this is a decorative frame
            around a real interface, not an operating system.
          -->
          <div
            class="flex shrink-0 items-center justify-between px-6 pb-1 pt-2 text-n-700"
            aria-hidden="true"
          >
            <span class="text-[0.6875rem] font-medium tabular-nums leading-none">{{ time }}</span>
            <span class="flex items-center gap-1">
              <svg viewBox="0 0 18 12" class="h-[9px] w-[13px]" fill="currentColor">
                <rect x="0" y="8" width="3" height="4" rx="1" opacity="0.9" />
                <rect x="5" y="5.5" width="3" height="6.5" rx="1" opacity="0.9" />
                <rect x="10" y="3" width="3" height="9" rx="1" opacity="0.9" />
                <rect x="15" y="0.5" width="3" height="11.5" rx="1" opacity="0.35" />
              </svg>
              <svg viewBox="0 0 16 12" class="h-[9px] w-[12px]" fill="currentColor">
                <path d="M8 10.6 5.9 8.4a3 3 0 0 1 4.2 0L8 10.6Z" />
                <path d="M8 6.2c1.5 0 2.9.6 3.9 1.6l1.3-1.4A7 7 0 0 0 8 4.3a7 7 0 0 0-5.2 2.1l1.3 1.4A5.2 5.2 0 0 1 8 6.2Z" opacity="0.85" />
                <path d="M8 2.2c2.6 0 5 1 6.8 2.7l1.2-1.3A11 11 0 0 0 8 .2 11 11 0 0 0 0 3.6l1.2 1.3A9.9 9.9 0 0 1 8 2.2Z" opacity="0.6" />
              </svg>
              <svg viewBox="0 0 26 12" class="h-[9px] w-[19px]" fill="none">
                <rect x="0.7" y="0.7" width="21" height="10.6" rx="3" stroke="currentColor" stroke-width="1.1" opacity="0.45" />
                <rect x="2.4" y="2.4" width="14" height="7.2" rx="1.6" fill="currentColor" />
                <path d="M23.4 4.2v3.6a2 2 0 0 0 0-3.6Z" fill="currentColor" opacity="0.45" />
              </svg>
            </span>
          </div>

          <!-- header -->
          <header class="flex items-center gap-3 border-b border-line px-4 py-3">
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
              ref="minimiseEl"
              type="button"
              class="-mr-1 p-1 text-n-400 hover:text-ink"
              :aria-label="minimised ? 'Expand conversation' : 'Minimise'"
              :aria-expanded="!minimised"
              @click="toggleMinimised"
            >
              <svg viewBox="0 0 24 24" fill="none" class="h-4 w-4" aria-hidden="true">
                <path
                  :d="minimised ? 'M12 5v14M5 12h14' : 'M5 12h14'"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </header>

          <!--
            The conversation collapses on minimise rather than unmounting.

            A single `1fr → 0fr` grid row animates to the content's own height,
            so there is no hardcoded pixel maximum here to fall out of step with
            the copy. It also keeps the chips mounted, so expanding does not
            rebuild the list — which would otherwise drop keyboard focus.
          -->
          <div class="chat-body" :class="{ 'chat-body--closed': minimised }">
            <div class="chat-body__inner" :inert="minimised || undefined">
              <!--
                The scroller is a plain div, deliberately, and the TransitionGroup
                sits inside it as nothing but layout.

                It used to be the other way round, with `ref="logEl"` on the
                TransitionGroup — and a template ref on a component resolves to the
                *component instance*, not to its root element. So `scrollTop` was
                being assigned to a proxy object and the log never moved: it sat at
                scrollTop 0 with 598px of content below the fold, with nothing in
                the console to show for it. The scroll container has to be a real
                element for a ref to reach it.
              -->
              <div
                ref="logEl"
                class="max-h-[min(19rem,52vh)] overflow-y-auto overscroll-contain px-4 py-4"
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

                  Same `BOT_BUBBLE`, same alignment, same avatar offset — so the
                  dots visibly *become* the reply rather than one block being
                  swapped for another. The dots keep their own tight padding because
                  they need to sit on the text baseline, not be centred in it.
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
                full-width rows made the panel 300px taller than the conversation
                in it, which is the wrong balance: the chips are a launcher, not
                the content, and they were pushing the actual messages off screen.

                Three details that make a horizontal scroller feel intentional
                rather than broken:

                · The scroll area stays inside the panel's padding. It originally
                  bled with `-mx-4 px-4` so a chip could slide under the rounded
                  corner — except the panel is `overflow-hidden` for those corners,
                  so 15px of the first chip was clipped off and hit-testing over it
                  returned the panel. The bleed bought a peek and cost a chip.
                · The scrollbar is hidden. A visible 8px bar under a row of bordered
                  chips looks like a bug, and on a touch device it is a scroll
                  target nobody aims for.
                · `overscroll-behavior-x: contain` stops a horizontal flick from
                  being handed to the message log above it.

                Two ways in, because neither one covers the other. The wheel is
                translated onto the horizontal axis while the cursor is over the
                row, and the row also drags with the pointer. Keyboard users are not
                stranded either: the chips are buttons, so arrowing along them
                scrolls them into view, and the first one receives focus when the
                panel opens.
              -->
              <div class="border-t border-line pb-3.5 pt-3.5">
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
                      class="h-3.5 w-3.5 shrink-0 text-n-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-n-500"
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
          </div>

          <!--
            Home indicator. Overlaid rather than given its own row: it is a
            frame detail, and padding the chip row out to clear it would move
            the control the panel exists to offer.
          -->
          <div class="absolute bottom-[7px] left-1/2 z-10 h-[4px] w-[7rem] -translate-x-1/2 rounded-full bg-n-950/80" aria-hidden="true"></div>
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
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Transition>
      </button>
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
.chat-panel-enter-active {
  transition:
    opacity 260ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 260ms cubic-bezier(0.32, 0.72, 0, 1);
}
.chat-panel-leave-active {
  transition:
    opacity 180ms ease-in,
    transform 180ms ease-in;
}
.chat-panel-enter-from,
.chat-panel-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.97);
}

/*
  The minimise collapse.

  One row in a grid, animating `1fr -> 0fr`. Because `fr` resolves against the
  content's natural height, the transition lands on the exact height it should
  with no hardcoded maximum to keep in sync with the copy. `min-height: 0` on
  the child is required — a grid item's default `min-height: auto` refuses to
  shrink below its content, and the whole thing silently fails to collapse.
*/
.chat-body {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
.chat-body--closed {
  grid-template-rows: 0fr;
}
.chat-body__inner {
  min-height: 0;
  overflow: hidden;
  transition: opacity 200ms ease;
}
.chat-body--closed .chat-body__inner {
  opacity: 0;
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
