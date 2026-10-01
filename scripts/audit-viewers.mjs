/**
 * Presence endpoint audit: does `api/viewers.js` actually work?
 *
 * Why this file exists
 *
 * The function was rewritten for this host and had never been run. Shipping it
 * unexercised would repeat the pattern that has cost this project the most -
 * code that reads correct, passes every static check, and only turns out to be
 * wrong on a deployed request. `vite preview` will not help either: it serves
 * `dist/` and has no idea a serverless function exists, so locally the endpoint
 * is simply absent and the client quietly hides the badge. Absence looks like
 * success from the browser.
 *
 * So the handler is driven directly here, and the Redis calls are not mocked.
 * A local HTTP server speaks enough of the Upstash REST protocol to answer them,
 * which means the real `@upstash/redis` client constructs the real requests,
 * against an in-memory sorted set with the same ordering and pruning rules. What
 * is under test is the code that ships, not a hand-written idea of it.
 *
 * What is NOT under test, and is worth being honest about:
 *
 * · Vercel's own `res.status(...).json(...)` helpers. They are provided by the
 *   platform, and the shim here mimics them. The handler's use of them is
 *   ordinary documented `@vercel/node` usage.
 * · Real Redis behaviour. The shim implements ZADD/ZREM/ZCARD/
 *   ZREMRANGEBYSCORE/EXPIRE with correct semantics, but Redis is Redis.
 *
 * Run: node scripts/audit-viewers.mjs
 */

import { createServer } from 'node:http'

let failures = []
const fail = (msg) => failures.push(msg)
const ok = (cond, msg) => {
  if (!cond) fail(msg)
  return cond
}

/* ------------------------------------- a stand-in for the Upstash REST API */

/** key -> Map(member -> score), which is what a sorted set actually is. */
const zsets = new Map()
const exps = new Map()
const commandLog = []

const zset = (k) => {
  if (!zsets.has(k)) zsets.set(k, new Map())
  return zsets.get(k)
}

function applyCommand(argv) {
  const cmd = String(argv[0] || '').toUpperCase()
  const key = argv[1]
  commandLog.push(cmd)

  switch (cmd) {
    case 'ZREMRANGEBYSCORE': {
      // ZREMRANGEBYSCORE key min max - min/max arrive as numbers or as
      // exclusive strings such as "(1234567".
      const parse = (v) => (typeof v === 'string' && v.startsWith('(') ? { v: Number(v.slice(1)), excl: true } : { v: Number(v), excl: false })
      const min = parse(argv[2])
      const max = parse(argv[3])
      const m = zset(key)
      for (const [member, score] of [...m]) {
        const aboveMin = score > min.v || (score === min.v && !min.excl)
        const belowMax = score < max.v || (score === max.v && !max.excl)
        if (aboveMin && belowMax) m.delete(member)
      }
      return m.size
    }
    case 'ZADD': {
      const spec = argv[2]
      if (spec && typeof spec === 'object') {
        zset(key).set(String(spec.member), Number(spec.score))
      } else {
        // ZADD key score member
        zset(key).set(String(argv[3]), Number(argv[2]))
      }
      return 1
    }
    case 'ZREM': {
      const n = zset(key).delete(String(argv[2]))
      return n ? 1 : 0
    }
    case 'ZCARD':
      return zset(key).size
    case 'EXPIRE':
      exps.set(key, Number(argv[2]))
      return 1
    default:
      throw new Error(`shim received an unhandled command: ${cmd}`)
  }
}

const server = createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    if (!req.headers.authorization) {
      res.writeHead(401, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ error: 'missing Authorization header' }))
    }
    let parsed
    try {
      parsed = JSON.parse(raw || '[]')
    } catch (e) {
      res.writeHead(400, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ error: `bad body: ${e.message}` }))
    }

    /*
     * The client talks to `/pipeline` and sends commands already batched, so
     * every request body is an array of argument arrays and every reply has to
     * be an array of per-command results - it maps over the response before
     * unwrapping. Answering with a bare object makes the client throw
     * `res.map is not a function`, which is worth knowing because that is the
     * error a wrong assumption about this API produces.
     */
    const batches = Array.isArray(parsed[0]) ? parsed : [parsed]

    try {
      const results = batches.map((argv) => ({ result: applyCommand(argv) }))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(results))
    } catch (e) {
      // The handler wraps every Redis call in one try/catch and answers 503, so
      // an unsupported command here would otherwise surface as a bare 503 with
      // no hint which call failed. Report it loudly instead.
      if (process.env.VIEWERS_AUDIT_DEBUG) {
        console.error(`    shim rejected: ${raw}`)
        console.error(`    ${e.message}`)
      }
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
  })
})

await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

/* ------------------------------------------------------------ mock a request */

/** The subset of Vercel's `@vercel/node` response object the handler uses. */
function mockRes() {
  const r = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      r.headers[k.toLowerCase()] = v
      return r
    },
    status(code) {
      r.statusCode = code
      return r
    },
    json(payload) {
      r.body = payload
      return r
    },
  }
  return r
}

let clock = 1_000_000
const withClock = (ms) => {
  const real = Date.now
  Date.now = () => (clock = ms)
  try {
    return ms
  } finally {
    Date.now = real
  }
}

/*
 * The Host has to agree with Origin or the handler's own-origin guard refuses
 * the request - which is the correct behaviour and which the first run of this
 * script proved by having every case return 403. Both are derived from the
 * shim's address so they match by construction; the cross-origin case below
 * overrides only Origin.
 */
const HOST = new URL(base).host
const ORIGIN = `http://${HOST}`

async function call(handler, { method = 'POST', origin = ORIGIN, body = null, url = '/api/viewers' } = {}) {
  const req = {
    method,
    url,
    headers: { origin, host: HOST },
    body,
  }
  const res = mockRes()
  await handler(req, res)
  return res
}

const realNow = Date.now
const at = (ms) => {
  Date.now = () => ms
}
const restoreClock = () => {
  Date.now = realNow
}

/* ------------------------------------------------------------------- run it */

const { default: handler } = await import('../api/viewers.js')

console.log('presence endpoint audit\n')

/* 1. With no store connected the endpoint must refuse, not crash. */
delete process.env.KV_REST_API_URL
delete process.env.KV_REST_API_TOKEN
{
  const res = await call(handler, { body: JSON.stringify({ id: 'a' }) })
  ok(res.statusCode === 503, `no store connected: expected 503, got ${res.statusCode}`)
  ok(res.body?.count === 0, `no store connected: expected count 0, got ${JSON.stringify(res.body)}`)
  console.log(`  no store connected        503, badge hides            ${res.statusCode === 503 ? 'OK' : 'FAIL'}`)
}

/* 2. With a store connected, heartbeats accumulate and leaving removes one. */
process.env.KV_REST_API_URL = base
process.env.KV_REST_API_TOKEN = 'test-token'
{
  const t0 = realNow()
  at(t0)

  const first = await call(handler, { body: JSON.stringify({ id: 'visitor-1' }) })
  ok(first.statusCode === 200, `first heartbeat: expected 200, got ${first.statusCode} ${JSON.stringify(first.body)}`)
  ok(first.body?.count === 1, `first heartbeat: expected count 1, got ${JSON.stringify(first.body)}`)

  at(t0 + 1000)
  const second = await call(handler, { body: JSON.stringify({ id: 'visitor-2' }) })
  ok(second.body?.count === 2, `second heartbeat: expected count 2, got ${JSON.stringify(second.body)}`)

  // A repeat heartbeat from the same tab must refresh, not duplicate.
  at(t0 + 2000)
  const again = await call(handler, { body: JSON.stringify({ id: 'visitor-1' }) })
  ok(again.body?.count === 2, `repeat heartbeat: expected count 2, got ${JSON.stringify(again.body)}`)

  at(t0 + 3000)
  const away = await call(handler, { url: '/api/viewers?leave=1&id=visitor-2' })
  ok(away.body?.count === 1, `leave: expected count 1, got ${JSON.stringify(away.body)}`)

  // Someone past the TTL must be pruned on the next write.
  at(t0 + 3000 + 91_000)
  const late = await call(handler, { body: JSON.stringify({ id: 'visitor-3' }) })
  ok(late.body?.count === 1, `TTL prune: expected count 1 (only visitor-3), got ${JSON.stringify(late.body)}`)

  const cache = away.headers['cache-control'] || ''
  ok(/no-store/.test(cache), `live state must not be cached, got cache-control: ${JSON.stringify(cache)}`)

  console.log(`  heartbeat / refresh       1 -> 2 -> 2               ${again.body?.count === 2 ? 'OK' : 'FAIL'}`)
  console.log(`  leave                     2 -> 1                   ${away.body?.count === 1 ? 'OK' : 'FAIL'}`)
  console.log(`  TTL prune (91s later)     2 -> 1                   ${late.body?.count === 1 ? 'OK' : 'FAIL'}`)
  console.log(`  cache-control              ${cache || '(none)'}`)
}

/* 3. Requests that are not this site's own page must be refused. */
{
  const res = await call(handler, { body: JSON.stringify({ id: 'x' }), origin: 'https://elsewhere.example' })
  ok(res.statusCode === 403, `cross-origin: expected 403, got ${res.statusCode}`)
  ok(res.body?.count === 0, `cross-origin: expected count 0, got ${JSON.stringify(res.body)}`)
  console.log(`  cross-origin POST         403, count stays 0        ${res.statusCode === 403 ? 'OK' : 'FAIL'}`)
}

/* 4. Input handling: the id is an opaque token and nothing else. */
{
  const cases = [
    ['missing id', JSON.stringify({})],
    ['id too long', JSON.stringify({ id: 'x'.repeat(65) })],
    ['malformed JSON', '{not json'],
    ['id not a string', JSON.stringify({ id: { $gt: 0 } })],
  ]
  let good = 0
  for (const [label, body] of cases) {
    const res = await call(handler, { body })
    if (res.statusCode === 400 && res.body?.count === 0) good++
    else fail(`${label}: expected 400 with count 0, got ${res.statusCode} ${JSON.stringify(res.body)}`)
  }
  ok(good === cases.length, `${good}/${cases.length} malformed-input cases handled`)
  console.log(`  malformed input           ${good}/${cases.length} refused with 400   ${good === cases.length ? 'OK' : 'FAIL'}`)

  // A JSON body arriving already parsed is normal on this runtime, so the
  // handler has to accept both shapes. Asserted as a delta, not a literal: by
  // this point the set still holds earlier visitors, and hard-coding the number
  // would encode the order of unrelated tests above.
  const before = zsets.get('presence')?.size ?? 0
  const parsed = await call(handler, { body: { id: 'object-body-visitor' } })
  const added = (zsets.get('presence')?.size ?? 0) - before
  ok(added === 1 && parsed.statusCode === 200, `object body: expected one visitor added and 200, got status ${parsed.statusCode} with delta ${added}`)
  console.log(`  body already parsed       +1 counted, 200            ${added === 1 && parsed.statusCode === 200 ? 'OK' : 'FAIL'}`)
}

/* 5. The commands actually issued should be the ones the design claims. */
{
  commandLog.length = 0
  await call(handler, { body: JSON.stringify({ id: 'command-check' }) })
  const seq = commandLog.join(' ')
  for (const want of ['ZREMRANGEBYSCORE', 'ZADD', 'EXPIRE', 'ZCARD']) {
    ok(seq.includes(want), `expected a ${want} in the command sequence, got: ${seq}`)
  }
  ok(commandLog.indexOf('ZCARD') === commandLog.length - 1, `the count should be read last, got: ${seq}`)
  console.log(`  command sequence          ${seq}`)
}

restoreClock()
// Keep-alive sockets keep libuv alive, and closing the server underneath one
// aborts the process on Windows rather than exiting cleanly.
server.closeAllConnections?.()
server.close()

if (failures.length) {
  console.log(`\nFAIL  ${failures.length} problem(s)`)
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('\npresence endpoint audit passed')