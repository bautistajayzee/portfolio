import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * "N people viewing now" — the client half of `api/viewers.js`.
 *
 * The rules this follows, all of them about not lying:
 *
 * · **`count` stays `null` until the server has actually answered.** Nothing is
 *   guessed, defaulted to 1, or rendered optimistically. Until then the badge
 *   does not exist in the DOM, so a failed function means no badge rather than
 *   a wrong one.
 * · **A failed request hides the badge again.** The endpoint is a serverless
 *   function, so it is absent in the common cases of running `vite dev`, of
 *   deploying `dist/` as bare static files, and of it answering 503 because no
 *   store is connected. Each of those puts `count` back to `null` and the
 *   sidebar closes the gap. The badge is a small true thing, and it is only
 *   allowed to exist when it is known to be true.
 * · **Leaving sends a beacon, not a fetch.** `pagehide` fires when a tab is
 *   closed or a laptop lid shuts, and an in-flight `fetch` is routinely cancelled
 *   there. `sendBeacon` survives it.
 * · **A hidden tab stops beating.** A tab parked in the background is not
 *   watching, and saying otherwise is a claim about somebody's attention that
 *   the site cannot support.
 *
 * Nothing here identifies anybody: the id is a random string generated in the
 * tab, and the server stores it only as a member of a sorted set scored by
 * time, pruned after the TTL. No IP, no user agent, no personal data.
 */

/** Beating more often than this wastes function invocations for no gain. */
const HEARTBEAT_MS = 30_000

/*
  Everything below is module scope on purpose.

  Both the side rail and the mobile nav call this composable, and both are
  mounted at once — one for wide screens, one for narrow, each hidden with a
  media query rather than destroyed. With the session id and the interval held
  per call, one visitor registered twice and the badge was permanently one too
  high; two intervals also meant two heartbeats every 30s. One tab is one
  viewer, so the session, the timer and the endpoint all live here and the
  components below are readers of it.
*/
let sessionId = ''
let timer = 0
let endpoint = '/api/viewers'

/** Every mounted component's `count`, written together on each answer. */
const readers = new Set()

function uuid() {
  // `crypto.randomUUID` needs a secure context. The site is https in
  // production, but `vite dev` on a LAN IP over http is not, so fall back.
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

async function beat() {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: sessionId }),
      // Presence is per-second; any cache would report a stale count.
      cache: 'no-store',
    })

    if (!res.ok) throw new Error(String(res.status))

    const data = await res.json()

    /*
     * Only a response that says presence is working may put a number on the
     * page.
     *
     * `available === true` is required rather than `!== false`. The difference
     * is a server that answers 200 with a bare `{ count: 0 }` and no flag at
     * all, which was measured while checking this change: `available: false`
     * hides the badge, `available: true` shows it, and a missing flag used to
     * fall through to `count = 0` and draw "0 people viewing now". That is the
     * precise failure this file exists to prevent - a confident, false
     * statement about live state - and it survived a fix aimed at exactly that
     * class of bug, which is the part that made it worth removing rather than
     * merely narrowing.
     *
     * The direction of the test is the whole design. Absent evidence of
     * presence, draw nothing; only positive confirmation draws a number. The
     * cost if this is ever too strict is a missing badge, which is silent and
     * harmless. The cost of being too loose is a lie.
     */
    const next = data?.available === true && typeof data?.count === 'number' ? data.count : null
    for (const reader of readers) reader.value = next
  } catch {
    // No function deployed, offline, or blocked. Showing a stale number would
    // be worse than showing none.
    for (const reader of readers) reader.value = null
  }
}

function leave() {
  if (!sessionId) return
  const url = `${endpoint}?leave=1&id=${encodeURIComponent(sessionId)}`
  navigator.sendBeacon?.(url)
}

function onVisibility() {
  if (document.hidden) {
    // Stop beating rather than letting the tab sit in the count until someone
    // reloads. The server's 90s TTL clears it from here; the `pagehide` beacon
    // still handles an actual close.
    window.clearInterval(timer)
    timer = 0
    return
  }

  if (!timer) {
    // Back in view. Beat at once so the number is right on the first frame
    // instead of up to 30s after the tab comes back.
    beat()
    timer = window.setInterval(beat, HEARTBEAT_MS)
  }
}

export function useViewers(path = '/api/viewers') {
  /** `null` means "we do not know", which is different from zero. */
  const count = ref(null)

  onMounted(() => {
    readers.add(count)

    // The first caller opens the session; every later one joins it, so the rail
    // and the nav together still register as a single viewer.
    if (sessionId) return

    endpoint = path
    sessionId = uuid()
    beat()
    timer = window.setInterval(beat, HEARTBEAT_MS)

    window.addEventListener('pagehide', leave)
    document.addEventListener('visibilitychange', onVisibility)
  })

  onBeforeUnmount(() => {
    readers.delete(count)

    // Only the last component standing tears the session down. Unmounting one of
    // the two navs is a resize, not a departure.
    if (readers.size > 0) return

    window.clearInterval(timer)
    timer = 0
    window.removeEventListener('pagehide', leave)
    document.removeEventListener('visibilitychange', onVisibility)
    sessionId = ''
  })

  /** `"1 person viewing now"` / `"3 people viewing now"`. */
  const label = () => (count.value === 1 ? 'person viewing now' : 'people viewing now')

  return { count, label }
}