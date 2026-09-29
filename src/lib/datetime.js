/**
 * Every date and time on this site, in one place.
 *
 * The timezone and these format strings were originally written out twice — once
 * in `useClock` and once inline in the assistant's answer to "What time is it?".
 * Two copies of a timezone is how a page ends up showing the panel clock in one
 * zone and the assistant's answer in another, and it is the same shape of mistake
 * as the Contact mailto that used to be hardcoded next to `profile.email`.
 *
 * `Intl` is used rather than string assembly so the output follows the visitor's
 * own locale data where that matters, and so nobody has to handle the
 * Philippine calendar by hand.
 */

/**
 * The owner's timezone. Cavite observes Philippine Standard Time year round —
 * no daylight saving — which is why the assistant can promise a fixed UTC+8.
 */
export const ZONE = 'Asia/Manila'

/** Shown next to the time, because an unlabelled clock is an ambiguous one. */
export const ZONE_LABEL = 'Manila'

/**
 * Display form, for the rail and the chat header: `01:57 PM`.
 *
 * Zero-padded on purpose. With `tabular-nums` the box never changes width, so
 * the clock does not nudge the layout as the digits change. `en-US` is used here
 * and only here, because it is the locale that renders the day period as uppercase
 * `PM` — `en-GB` gives a lowercase `pm`, which is correct for that locale and
 * wrong for this site's mono labels.
 */
export function formatClockTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/** Rail date line: `Wed, 30 Sept 2026`. */
export function formatClockDate(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/**
 * Prose form, for the assistant's answer: `1:57 PM` and
 * `Wednesday, 30 September 2026`.
 *
 * Unpadded hour, because "It is 01:57 PM" reads like a departure board rather
 * than a sentence. Display and prose deliberately differ here — this one is read,
 * not scanned.
 */
export function formatSpokenTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export function formatSpokenDate(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
