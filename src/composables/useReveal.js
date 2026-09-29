/**
 * One IntersectionObserver for the whole page.
 *
 * Every scroll-triggered element on the site shares this single observer.
 * It watches, fires once, and stops watching — so the page never accumulates
 * callbacks as you scroll through it.
 */

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

let observer = null

function getObserver() {
  if (observer) return observer
  if (typeof IntersectionObserver === 'undefined') return null

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-revealed')
        observer.unobserve(entry.target) // fire once, then stop watching
      }
    },
    {
      // start revealing a little before the element reaches the fold
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.05,
    },
  )

  return observer
}

export function revealElement(el, delay = 0) {
  if (!el) return

  el.classList.add('reveal')
  // Opt-in for the hairline draw-in. Added here rather than in the markup so
  // that a page with no JavaScript at all still shows every rule at full
  // width, instead of leaving the section dividers invisible.
  if (el.querySelector('.rule')) el.classList.add('draw')
  if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`)

  const io = getObserver()

  // No observer support, or the visitor asked for less motion:
  // show everything immediately rather than hiding it forever.
  if (!io || reducedMotion()) {
    el.classList.add('is-revealed')
    return
  }

  io.observe(el)
}
