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

document.addEventListener('keydown', onKeydown)

watch(open, async (isOpen) => {
  if (!isOpen) return
  // Land on the first question so a keyboard visitor can ask straight away.
  await nextTick()
  firstChipEl.value?.focus()
})

onBeforeUnmount(() => {
  pending.forEach(window.clearTimeout)
  // The reveal loop outlives the component unless it is explicitly cancelled.
  window.cancelAnimationFrame(streamRaf)
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
      <div
        v-if="open"
        role="dialog"
        aria-label="Ask about Jayzee"
        class="chat-panel pointer-events-auto mb-3 flex w-[min(21rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[12px] border border-line bg-paper shadow-[0_18px_44px_-26px_rgba(10,10,10,0.4)]"
      >
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

              Keyboard users are not stranded: the chips are buttons, so arrowing
              along them scrolls them into view, and the first one still receives
              focus when the panel opens.
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
  Snap each chip to the leading edge, so a flick lands cleanly on a chip rather
  than between two. `proximity` rather than `mandatory` because a chip wider
  than the panel must still be reachable.
*/
.chips-scroll > * {
  scroll-snap-align: start;
  scroll-snap-stop: normal;
}

.chips-scroll {
  scroll-snap-type: x proximity;
}

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
