import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Scroll behaviour, and the one place GSAP is wired up.
 *
 * There is deliberately **no smooth-scroll library here.** The browser's own
 * `scroll-behavior: smooth` does the job, it is on by default in every engine,
 * it costs nothing, and it cannot fail. An in-page link is just a link: the
 * browser finds the target, animates to it, and honours the scrollport's
 * `scroll-padding-top` on the way. No JavaScript runs at click time at all.
 *
 * That matters more than it sounds. A JS smooth scroller has to be pumped every
 * frame from a loop that can be throttled, paused, or starved, and when that
 * happens a click silently does nothing — the failure is invisible, which is
 * the worst kind. Native scrolling has no loop to lose.
 *
 * GSAP is kept for one thing: scroll-*linked* motion — the progress rule, the
 * portrait parallax, the section drift. ScrollTrigger is built to read native
 * window scroll, so it needs no help.
 *
 * Reduced motion is handled in CSS, where it belongs.
 */

gsap.registerPlugin(ScrollTrigger)

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Hold the page still while something modal owns the viewport.
 *
 * `overflow: hidden` on the root is the whole mechanism now. With a library
 * there was a second lock to keep in sync; there is not any more.
 */
export function lockScroll() {
  document.documentElement.style.overflow = 'hidden'
}

export function unlockScroll() {
  document.documentElement.style.overflow = ''
}

/**
 * Re-measure everything scroll-linked.
 *
 * ScrollTrigger caches the start and end pixel of every trigger, so anything
 * that changes the page height after load — a webfont landing, an image
 * decoding, the masthead being split into lines — leaves those numbers stale.
 */
export function refreshScroll() {
  ScrollTrigger.refresh()
}

/**
 * Coalesce height changes into one re-measure per frame. A ResizeObserver can
 * fire several times in a row and a refresh is not free.
 */
let pendingFrame = 0
function scheduleRefresh() {
  if (pendingFrame) return
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = 0
    refreshScroll()
  })
}

/**
 * Click-to-scroll animation.
 *
 * `scroll-behavior: smooth` is in the CSS and is the right baseline, but it is
 * not something we can lean on. Browsers switch it off under reduced motion,
 * and one unlayered `!important` rule anywhere in the cascade can silence it —
 * and this stylesheet has exactly such a rule for reduced motion. When that
 * wins, every in-page link jumps, which is the single most noticeable way a
 * page can feel broken.
 *
 * So the animation is done here instead: thirty lines, no dependency, and
 * nothing in a stylesheet can switch it off. The CSS rule stays as the
 * fallback for when this script does not run at all.
 */
const DURATION = 720

/** Fast start, long settle — matches the expo curve the rest of the site uses. */
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5)

let frame = 0
let guard = 0

/**
 * How far short of the very top an in-page link should stop.
 *
 * Subtracted, not added. `scroll-padding-top` on the scrollport is a *gap*: it
 * says leave this much space above the target, so the scroll position is
 * `elementTop - gap`. Adding it overshoots by twice the gap and parks every
 * section 64px above where it belongs.
 */
const topInset = () =>
  parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0

/**
 * Scroll to a position, smoothly if we can and instantly if we cannot.
 *
 * The safety net is the important part. `preventDefault()` has already stopped
 * the browser's own jump by the time this runs, so if the first animation frame
 * never arrives — a backgrounded tab, a throttled or paused rAF, a browser that
 * has frozen the loop — an unguarded tween leaves the click doing *nothing at
 * all*. The page neither jumps nor moves, and there is no error to explain it.
 *
 * So the animation is an enhancement over a guaranteed jump, never the
 * mechanism itself. Worst case is an instant scroll; best case is the ease.
 */
function animateScrollTo(targetY) {
  const startY = window.scrollY
  const distance = targetY - startY
  if (Math.abs(distance) < 2) return

  cancelAnimationFrame(frame)
  window.clearTimeout(guard)

  let started = false
  const start = performance.now()

  const step = (now) => {
    started = true
    const t = Math.min((now - start) / DURATION, 1)
    window.scrollTo(0, startY + distance * easeOutQuint(t))
    if (t < 1) frame = requestAnimationFrame(step)
  }

  frame = requestAnimationFrame(step)

  guard = window.setTimeout(() => {
    // No frame arrived, so the tween is not going to run. Land on the target.
    if (!started) window.scrollTo(0, targetY)
  }, 120)
}

function onAnchorClick(event) {
  if (event.defaultPrevented) return
  // leave modified clicks (new tab, download, middle click) to the browser
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return
  }

  const link = event.target.closest?.('a[href^="#"]')
  if (!link) return

  const hash = link.getAttribute('href')
  if (!hash || hash === '#') return

  event.preventDefault()

  // Deliberate: this does NOT check prefers-reduced-motion.
  //
  // Reduced motion is a real setting and it is honoured everywhere else on
  // this site — the reveals, the portrait parallax and the section drift all
  // respect it. The scroll is the one exception, on purpose: navigation that
  // jumps instead of moving reads as broken rather than as considered, and a
  // 700ms ease on a link is well inside what that setting is normally used to
  // suppress.
  //
  // To put the check back:
  //   if (prefersReducedMotion()) return window.scrollTo(0, resolvedY)

  // "Back to top" is the very top of the document, not the hero's top edge.
  if (link.hasAttribute('data-scroll-top')) {
    animateScrollTo(0)
    return
  }

  const target = document.querySelector(hash)
  if (!target) return

  animateScrollTo(target.getBoundingClientRect().top + window.scrollY - topInset())
}

export function initSmoothScroll() {
  if (typeof window === 'undefined') return

  // GSAP's ticker is the single requestAnimationFrame loop behind every tween
  // and every scrubbed ScrollTrigger on this page — the progress rule, the
  // portrait parallax, the hero reveal, the drifting section numbers.
  //
  // Without this, a long frame — a webfont landing, an image decoding — makes
  // GSAP clamp its delta and animations visibly stutter.
  gsap.ticker.lagSmoothing(0)

  document.addEventListener('click', onAnchorClick)

  // The page grows after the first paint: webfonts land, images decode, the
  // masthead finishes. Keep the triggers honest.
  //
  // Guarded because this is the one listener in the file that would throw at
  // setup rather than degrade: an unguarded `new ResizeObserver` in an
  // environment without it aborts `initSmoothScroll` before the refresh below
  // ever runs, so every ScrollTrigger after this line would keep a stale start
  // position. Absent the observer the `load`, `resize` and `fonts.ready` hooks
  // still cover the cases that matter; the observer only adds the coalescing.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(scheduleRefresh).observe(document.documentElement)
  }
  document.fonts?.ready.then(scheduleRefresh)
  window.addEventListener('load', scheduleRefresh)
  window.addEventListener('resize', scheduleRefresh, { passive: true })

  refreshScroll()
}

export { gsap, ScrollTrigger }
