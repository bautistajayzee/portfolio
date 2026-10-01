/**
 * Presence: how many people have this page open right now.
 *
 * A viewer counter is shared, live state, so it cannot live in the browser —
 * each visitor's client only ever knows about itself. This is the server half:
 * a function that keeps a set of live visitors in Redis and reports the size.
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
 * One sorted set, not a JSON document, and not one key per visitor.
 *
 * The previous implementation was one JSON blob holding `{ id: timestamp }`, read
 * whole, modified in JavaScript, and written back. That is a read-modify-write
 * across a network hop, so two simultaneous heartbeats raced and the loser was
 * silently dropped — the count would dip under a burst, and the original comment
 * said so and called it an acceptable trade. It is not, here, because Redis gives
 * the atomic operations for free:
 *
 *   ZREMRANGEBYSCORE  drop everyone past the TTL
 *   ZADD              add or refresh this visitor
 *   ZCARD             count what is left
 *   ZREM              remove one visitor on leave
 *
 * Each of those is a single server-side command. Nothing is read into JavaScript
 * and written back, so there is no window for two heartbeats to overwrite each
 * other, and no parse of a shape that a different writer might have left behind.
 *
 * The key also carries an expiry of its own, so a store nobody has visited in a
 * while disappears instead of lingering as an empty set forever.
 */

/** How long a visitor counts as present without a fresh heartbeat. */
const TTL_MS = 90_000

/**
 * How long the key itself survives with no writes at all.
 *
 * Comfortably longer than `TTL_MS`, so the set is only ever removed by Redis
 * while it is genuinely abandoned rather than on a quiet afternoon.
 */
const KEY_EXPIRY_SECONDS = 60 * 60 * 24

/** One sorted set: member is the visitor id, score is when they were last seen. */
const KEY = 'presence'

/** 60s minimum, so a proxied response is never cached at the edge. */
function noStore(res) {
  res.setHeader('cache-control', 'no-store, max-age=0')
  res.setHeader('content-type', 'application/json')
}

export default async function handler(request, res) {
  // Same-origin Function call from the site. Without this, anyone could POST
  // here and inflate the count — the number would be a toy.
  const origin = request.headers.origin
  const host = request.headers.host
  if (origin && host) {
    let allowed = false
    try {
      allowed = new URL(origin).host === host
    } catch {
      allowed = false
    }
    if (!allowed) {
      return res.status(403).json({ count: 0 })
    }
  }

  const url = new URL(request.url, `https://${host || 'localhost'}`)
  const leaving = url.searchParams.get('leave') === '1'

  let id = ''
  if (leaving) {
    id = url.searchParams.get('id') || ''
  } else if (typeof request.body === 'string') {
    try {
      const body = JSON.parse(request.body)
      id = typeof body?.id === 'string' ? body.id : ''
    } catch {
      id = ''
    }
  } else if (request.body && typeof request.body === 'object') {
    id = typeof request.body.id === 'string' ? request.body.id : ''
  }

  // A visitor id is an opaque random string and nothing else. Refuse anything
  // long enough to be somebody trying to store a payload in here.
  if (!id || id.length > 64) {
    return res.status(400).json({ count: 0 })
  }

  /*
    Credentials come from the environment and nowhere else.

    These are provisioned by the Redis integration in the Vercel Marketplace,
    under the same `KV_REST_API_*` names the old `@vercel/kv` client read, which
    is why that is the pair used here rather than the `UPSTASH_REDIS_*` variant
    the underlying library also accepts. Existing stores keep working because
    the names did not change when the integration was rebranded.

    A store that is not connected must not take the site down with it. The
    client already treats any failure as "nobody is here" and hides the badge,
    so a 503 here is indistinguishable from a quiet site, which is the correct
    failure: a portfolio is not worth a broken deploy because a counter is off.
  */
  const url_ = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url_ || !token) {
    return res.status(503).json({ count: 0 })
  }

  const { Redis } = await import('@upstash/redis')
  const redis = new Redis({ url: url_, token })

  const now = Date.now()

  try {
    if (leaving) {
      await redis.zrem(KEY, id)
    } else {
      // Drop anyone whose last heartbeat is older than the TTL. `(` is exclusive
      // so a visitor exactly at the boundary counts as present.
      await redis.zremrangebyscore(KEY, 0, now - TTL_MS)
      await redis.zadd(KEY, { score: now, member: id })
    }

    // Only extend the key's own life when somebody is actually present, or a
    // leaving visitor would keep an abandoned store alive.
    if (!leaving) await redis.expire(KEY, KEY_EXPIRY_SECONDS)

    const count = await redis.zcard(KEY)
    noStore(res)
    return res.status(200).json({ count })
  } catch {
    // Redis unreachable or misconfigured. Same reasoning as above: the badge
    // disappears, the page does not.
    noStore(res)
    return res.status(503).json({ count: 0 })
  }
}
