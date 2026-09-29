/**
 * Presence: how many people have this page open right now.
 *
 * A viewer counter is shared, live state, so it cannot live in the browser —
 * each visitor's client only ever knows about itself. This is the server half:
 * a Netlify Function that keeps a set of live visitors in Netlify Blobs and
 * reports the size.
 *
 * How presence works here:
 *
 * · The page generates a random id once per tab and POSTs a heartbeat. This
 *   function stamps it with the current time.
 * · Any heartbeat older than `TTL` is dropped on the next write. Nobody needs to
 *   disconnect cleanly — a closed laptop lid looks exactly like someone who
 *   left, and cleans itself up within the TTL.
 * · `?leave=1` removes a single id immediately, sent as a `sendBeacon` on
 *   `pagehide` so closing the tab is reflected at once instead of after the TTL.
 *
 * Why one blob and not one blob per visitor: a per-visitor key needs listing,
 * deleting, and can leak entries if a write fails. One JSON map is a single
 * read-modify-write, self-pruning on every heartbeat, and cannot accumulate
 * litter. The trade is that two simultaneous heartbeats can race and lose one
 * entry — so the count can dip by one under a burst. For a badge that reads
 * "1 person viewing now", that is not worth a distributed lock.
 */

/** How long a visitor counts as present without a fresh heartbeat. */
const TTL_MS = 90_000

/** One blob holding `{ [visitorId]: lastSeenMs }`. */
const KEY = 'presence.json'

/**
 * Coerce whatever is in the blob into a clean map of id -> timestamp.
 *
 * The store is shared and long-lived, so it is not necessarily something this
 * function wrote — a bad shape must degrade to "nobody is here" rather than
 * throwing and taking the endpoint down.
 */
function parse(raw) {
  if (!raw) return {}

  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return {}
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}

  const live = {}
  for (const [id, seen] of Object.entries(data)) {
    if (typeof seen === 'number' && Number.isFinite(seen)) live[id] = seen
  }
  return live
}

/**
 * Drop anyone who has stopped sending heartbeats.
 *
 * @param {Record<string, number>} live
 * @param {number} now
 * @param {string} [keep] an id to preserve regardless of age
 */
function prune(live, now, keep) {
  for (const [id, seen] of Object.entries(live)) {
    if (id === keep) continue
    if (now - seen > TTL_MS) delete live[id]
  }
  return live
}

/** 60s minimum, so a proxied response is never cached at the edge. */
const CACHE_HEADERS = {
  'cache-control': 'no-store, max-age=0',
  'content-type': 'application/json',
}

export default async (request) => {
  // Same-origin Function call from the site. Without this, anyone could POST
  // here and inflate the count — the number would be a toy.
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin && host) {
    let allowed = false
    try {
      allowed = new URL(origin).host === host
    } catch {
      allowed = false
    }
    if (!allowed) {
      return new Response(JSON.stringify({ count: 0 }), { status: 403, headers: CACHE_HEADERS })
    }
  }

  const { getStore } = await import('@netlify/blobs')
  const url = new URL(request.url)
  const leaving = url.searchParams.get('leave') === '1'

  let id = ''
  if (leaving) {
    id = url.searchParams.get('id') || ''
  } else {
    try {
      const body = await request.json()
      id = typeof body?.id === 'string' ? body.id : ''
    } catch {
      id = ''
    }
  }

  // A visitor id is an opaque random string and nothing else. Refuse anything
  // long enough to be somebody trying to store a payload in here.
  if (!id || id.length > 64) {
    return new Response(JSON.stringify({ count: 0 }), { status: 400, headers: CACHE_HEADERS })
  }

  /*
    Ambient credentials, deliberately.

    `getStore` only treats `siteID`/`token` as an override when *both* are
    truthy; otherwise it derives the site from the invocation context. Passing
    `process.env.NETLIFY_AUTH_TOKEN` therefore looks like a credential
    requirement the function does not have — that variable exists for
    `netlify dev`, not in production — and if it ever *were* set it would flip
    the function onto a different auth path. Naming the store is the whole of it.
  */
  const store = getStore({ name: 'viewers' })
  const now = Date.now()

  const existing = parse(await store.get(KEY, { type: 'json' }).catch(() => null))

  // Prune first, then apply this request. On the way in, keep our own entry so a
  // heartbeat refreshes rather than being judged against its own timestamp.
  const live = prune(existing, now, leaving ? undefined : id)

  if (leaving) {
    delete live[id]
  } else {
    live[id] = now
  }

  await store.setJSON(KEY, live)

  const count = Object.keys(live).length

  return new Response(JSON.stringify({ count }), { status: 200, headers: CACHE_HEADERS })
}

export const config = { path: '/api/viewers' }
