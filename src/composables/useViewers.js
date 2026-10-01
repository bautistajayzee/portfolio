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
 *
 * Nothing here identifies anybody: the id is a random string generated in the
 * tab, and the server stores it only as a member of a sorted set scored by
 * time, pruned after the TTL. No IP, no user agent, no personal data.
 */

/** Beating more often than this wastes function invocations for no gain. */
const HEARTBEAT_MS = 30_000

export function useViewers(endpoint = '/api/viewers') {
  /** `null` means "we do not know", which is different from zero. */
  const count = ref(null)

  let sessionId = ''
  let timer = 0

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
      count.value = typeof data?.count === 'number' ? data.count : null
    } catch {
      // No function deployed, offline, or blocked. Showing a stale number would
      // be worse than showing none.
      count.value = null
    }
  }

  function leave() {
    if (!sessionId) return
    const url = `${endpoint}?leave=1&id=${encodeURIComponent(sessionId)}`
    navigator.sendBeacon?.(url)
  }

  onMounted(() => {
    sessionId = uuid()
    beat()
    timer = window.setInterval(beat, HEARTBEAT_MS)

    window.addEventListener('pagehide', leave)
  })

  onBeforeUnmount(() => {
    window.clearInterval(timer)
    window.removeEventListener('pagehide', leave)
  })

  /** `"1 person viewing now"` / `"3 people viewing now"`. */
  const label = () => (count.value === 1 ? 'person viewing now' : 'people viewing now')

  return { count, label }
}
