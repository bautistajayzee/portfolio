import { gsap, ScrollTrigger, prefersReducedMotion } from './useSmoothScroll.js'

/**
 * Motion tied to scroll *position* rather than to an element arriving.
 *
 * The `v-reveal` system already handles one-shot entrances. This is the other
 * half — things that drift continuously as a section passes, which is what
 * makes a flat editorial page feel like it has depth instead of just appearing.
 *
 * Two rules for everything in here:
 *
 * · Slow. Nothing here is fast enough to pull the eye off the type. The whole
 *   point of the design is that the words come first.
 * · Reversible and non-destructive. A scrubbed tween has no start state to get
 *   stuck in — if it never runs, the element is exactly where the stylesheet
 *   put it. That is why the hairline draw-in is done in CSS instead.
 */
export function initScrollMotion() {
  if (prefersReducedMotion()) return
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  /**
   * The small section number drifts up as its section travels through the
   * viewport. A 20px move over a whole screen of scrolling is barely a
   * movement — it just stops the number reading as painted-on.
   */
  const drift = (targets, from, to, trigger) => {
    gsap.fromTo(
      targets,
      { yPercent: from },
      {
        yPercent: to,
        ease: 'none',
        scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: 0.5 },
      },
    )
  }

  for (const section of document.querySelectorAll('[data-section]')) {
    const index = section.querySelector('header .meta')
    if (index) drift(index, 12, -12, section)
  }

  /**
   * The big statement in the hero holds still while the page moves around it,
   * which reads as depth rather than as the text sliding past.
   */
  const statement = document.querySelector('#home p')
  if (statement) {
    gsap.fromTo(
      statement,
      { yPercent: 0 },
      {
        yPercent: 10,
        ease: 'none',
        scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom top', scrub: 0.6 },
      },
    )
  }
}
