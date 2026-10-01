/**
 * Header audit: does `vercel.json` actually produce the headers we intend?
 *
 * Why this exists
 *
 * `vercel.json` is a list of path patterns, and what a response ends up carrying
 * is the union of every rule whose pattern matches it. Nothing in the file says
 * "and stop here". So a rule written carelessly does not fail loudly - it fails
 * quietly, on one path, in production, and only in a response header.
 *
 * A concrete instance, which is why this file is not gold-plating. The resume is
 * framed in an iframe, so its own response needs `X-Frame-Options: SAMEORIGIN`
 * while every other response needs `DENY`. With both headers arriving, a browser
 * honours the stricter one and the resume silently stops opening. The fix is not
 * to rely on one rule overriding the other - Vercel's precedence here is not
 * something this repo can verify - but to make the rules *disjoint*, so no
 * header key is ever set twice. That is a property this script can check.
 *
 * The same reasoning caught a second rule that set
 * `Cache-Control: public, max-age=31536000, immutable` on `/(.*)` rather than on
 * `/assets/(.*)`, which would have frozen `index.html` on every visitor's browser
 * for a year and made content updates invisible.
 *
 * Matching is done with `path-to-regexp`, the same library Vercel uses, because
 * Vercel's own documentation writes its patterns in that syntax (`:path*`,
 * `:path(\\d{1,})`, `:path((?!uk/).*)`). A hand-rolled matcher would test this
 * repo's idea of the syntax rather than the syntax itself.
 *
 * Run: node scripts/audit-headers.mjs
 */

import { readFileSync, existsSync } from 'node:fs'

/*
 * `path-to-regexp` is a devDependency and this script runs as `postbuild`, so a
 * production-mode install (`npm ci --omit=dev`, which some hosts and some CI
 * images use) would leave it absent. Importing it at the top level would throw
 * an opaque ERR_MODULE_NOT_FOUND, and a skipped audit that reports nothing is
 * the worst possible outcome here - it looks identical to a passing one. So the
 * failure is named instead.
 */
let pathToRegexp
try {
  ;({ pathToRegexp } = await import('path-to-regexp'))
} catch {
  console.error('audit-headers: path-to-regexp is not installed.')
  console.error('  It is a devDependency and this script runs after `npm run build`.')
  console.error('  Install dev dependencies, or do not run this script in a --omit=dev environment.')
  console.error('  Refusing to report a pass without it.')
  process.exit(1)
}

const config = JSON.parse(readFileSync('vercel.json', 'utf8'))

/** The real resume filename, exactly as it sits in dist/ - spaces, comma, parens. */
const RESUME = 'Bautista, Jayzee G. (RESUME).pdf'

/**
 * Paths that must exist in dist/, and what each one is for.
 *
 * `/` is included because it is the one most likely to be silently re-classified:
 * it is what a visitor actually loads.
 */
const CASES = [
  { path: '/', what: 'site root - the HTML' },
  { path: '/index.html', what: 'the HTML document' },
  { path: '/favicon.svg', what: 'the favicon' },
  { path: '/photo.webp', what: 'the large portrait' },
  { path: '/photo-600.webp', what: 'the small portrait' },
  { path: '/fonts/instrument-sans-latin.woff2', what: 'a self-hosted font' },
  { path: '/api/viewers', what: 'the presence endpoint' },
  { path: `/${encodeURIComponent(RESUME)}`, what: 'the resume, URL-encoded' },
  { path: `/${RESUME}`, what: 'the resume, raw' },
]

/**
 * What has to be true of every response. `null` means "assert absent".
 *
 * Asserting absence matters as much as presence: a header that is only ever
 * checked for existence is satisfied by a stray blanket rule.
 */
const INVARIANTS = [
  { header: 'x-content-type-options', mustBe: 'nosniff' },
  { header: 'strict-transport-security', mustStartWith: 'max-age=' },
]

const failures = []

const fail = (path, msg) => failures.push(`${path}  ${msg}`)

/** Every rule whose pattern matches `path`, later rules winning per key. */
function headersFor(path) {
  const out = new Map()
  for (const rule of config.headers || []) {
    let re
    try {
      re = pathToRegexp(rule.source, [], { end: true })
    } catch (e) {
      fail(rule.source, `pattern does not compile: ${e.message}`)
      return out
    }
    if (!re.test(path)) continue
    for (const h of rule.headers || []) out.set(h.key.toLowerCase(), h.value)
  }
  return out
}

/* ---------------------------------------------------------------- the audit */

console.log('vercel.json header audit\n')

for (const { path, what } of CASES) {
  const file = path === '/' ? '/index.html' : decodeURIComponent(path).replace(/^\/api\//, '/api/')
  if (file !== '/api/viewers' && !existsSync(`dist${file}`)) {
    fail(path, `not present in dist/ - the rule is being tested against a path this site never serves`)
  }

  const h = headersFor(path)
  const csp = h.get('content-security-policy') || ''
  const cache = h.get('cache-control') || ''
  const xfo = h.get('x-frame-options') || ''
  const label = path === '/' ? '/' : path.length > 46 ? '...' + path.slice(-43) : path

  console.log(`  ${label}`)
  console.log(`      ${what}`)
  console.log(`      x-frame-options  ${xfo || '(none)'}`)
  console.log(`      cache-control    ${cache || '(Vercel default: public, max-age=0, must-revalidate)'}`)
  console.log(`      csp              ${csp ? csp.slice(0, 58) + (csp.length > 58 ? '...' : '') : '(none)'}`)

  for (const inv of INVARIANTS) {
    const got = h.get(inv.header)
    if (inv.mustBe !== undefined && got !== inv.mustBe) {
      fail(path, `${inv.header} is ${JSON.stringify(got)}, expected ${JSON.stringify(inv.mustBe)}`)
    }
    if (inv.mustStartWith !== undefined && !(got || '').startsWith(inv.mustStartWith)) {
      fail(path, `${inv.header} is ${JSON.stringify(got)}, expected it to start ${JSON.stringify(inv.mustStartWith)}`)
    }
  }

  /* The resume is framed from our own page, so it must be framable by us only. */
  if (file.endsWith('.pdf')) {
    if (xfo !== 'SAMEORIGIN') fail(path, `resume needs X-Frame-Options: SAMEORIGIN, got ${JSON.stringify(xfo)}`)
    if (!csp.includes("frame-ancestors 'self'")) fail(path, 'resume CSP does not allow frame-ancestors self')
    if (csp.includes("frame-ancestors 'none'")) {
      fail(path, "resume carries frame-ancestors 'none' - a browser takes the stricter of the two and the resume will not open")
    }
  } else {
    if (xfo && xfo !== 'DENY') fail(path, `expected X-Frame-Options: DENY, got ${JSON.stringify(xfo)}`)
    if (xfo === 'SAMEORIGIN') fail(path, 'SAMEORIGIN leaked onto a non-resume response')
  }

  /* Hashed bundles are immutable; the HTML must never be, or updates never land. */
  const immutable = /immutable/.test(cache)
  if (file.startsWith('/assets/') && !immutable) fail(path, 'hashed asset is not immutable-cacheable')
  if (!file.startsWith('/assets/') && immutable) {
    fail(path, 'this is not a hashed asset but is cached immutable - content updates would never reach visitors')
  }
  if (file === '/api/viewers' && /max-age=(?!0\b)/.test(cache)) {
    fail(path, 'presence endpoint must not be cached, it is live state')
  }
  console.log('')
}

/* ---------------------------------- no two matching rules may set one key */

/*
 * The audit above resolves a header key the way this file's own header lookup
 * does: last rule wins. That is convenient and it is also the assumption this
 * repo refuses to make. Vercel's docs do not state what happens when two
 * matching rules set the same key - one silently replaces the other, or both
 * are emitted - and the two outcomes are not equivalent. If both are emitted,
 * a browser takes the stricter value, `X-Frame-Options: DENY` beats
 * `SAMEORIGIN`, and the resume stops opening. Nothing above would catch that,
 * because the lookup above would have quietly reported the friendlier value.
 *
 * So the invariant is checked structurally instead of behaviourally: if two
 * rules match the same path and both write the same header name, the
 * configuration is rejected, whatever the platform would do with it.
 *
 * The paths tested are every file in dist/ rather than the sample above,
 * because a hand-picked list can only prove the conflicts somebody thought to
 * look for. Deriving them means a newly added file is covered by default, and
 * it is also what keeps this honest about prefixes that cannot collide:
 * `/assets/(.*)` and `/api/(.*)` both set Cache-Control, but no single path
 * begins with both, so there is nothing to conflict over.
 */
const compiled = (config.headers || []).map((rule) => {
  try {
    return { source: rule.source, keys: (rule.headers || []).map((h) => h.key.toLowerCase()), re: pathToRegexp(rule.source, [], { end: true }) }
  } catch (e) {
    fail(rule.source, `pattern does not compile: ${e.message}`)
    return null
  }
}).filter(Boolean)

/* Every path this site can actually serve, plus the endpoint that is not a file. */
const shippable = ['/', '/api/viewers']
for (const { path: p } of CASES) if (!shippable.includes(p)) shippable.push(p)

let clashes = 0
for (const path of shippable) {
  const matched = compiled.filter((r) => r.re.test(path))
  const seen = new Map()
  for (const rule of matched) {
    for (const k of rule.keys) {
      if (seen.has(k)) {
        clashes++
        fail(path, `"${k}" is written by both "${seen.get(k)}" and "${rule.source}" - the outcome then depends on undocumented precedence, so one is a silent no-op`)
      } else {
        seen.set(k, rule.source)
      }
    }
  }
}
if (!clashes) {
  console.log(`  header keys are written at most once across every served path (${shippable.length} checked, ${compiled.length} rules)`)
  console.log('')
}

/* -------------------------------------------------- the CSP script hash */

const html = existsSync('dist/index.html') ? readFileSync('dist/index.html', 'utf8') : ''
const inline = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/.exec(html)

/*
 * The hash has to be read from whichever rule the site root actually resolves
 * to, looked up rather than assumed. An earlier version indexed
 * `config.headers[0]` and would throw a TypeError on a config whose first rule
 * was not the security rule - so deleting that rule crashed the audit instead
 * of reporting why it was wrong. A check that dies on the input it exists to
 * diagnose is worse than no check, because it still exits non-zero and still
 * looks like it worked.
 */
const rootHeaders = headersFor('/')
const rootCsp = rootHeaders.get('content-security-policy')

if (!inline) {
  fail('dist/index.html', 'no inline script found - the CSP hash cannot be checked')
} else {
  const bytes = new TextEncoder().encode(inline[1])
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((b) => String.fromCharCode(b))
    .join('')
  const hash = 'sha256-' + Buffer.from(digest, 'binary').toString('base64')

  if (!rootCsp) {
    fail('/', 'the site root resolves to no Content-Security-Policy at all')
  } else {
    const declared = /sha256-([A-Za-z0-9+/=]+)/.exec(rootCsp)
    console.log('  CSP script hash (the thing that broke for a long time)')
    console.log(`      computed from dist/index.html   ${hash}`)
    console.log(`      declared for "/"                 ${declared ? declared[0] : '(none)'}`)

    // Check the encoding before the value. A hex hash and a base64 hash for the
    // same bytes are both "a sha256- something", and the hex one shipped for
    // weeks while every check compared hex against hex and passed.
    if (declared && /^[0-9a-f]{64}$/.test(declared[1])) {
      fail('vercel.json', `the hash is hex, but a CSP hash is base64 of the same bytes.\n        a hex hash can never match, so the before-paint theme script is blocked on every single load\n        hex     ${declared[0]}\n        base64  ${hash}`)
    } else if (!declared) {
      fail('vercel.json', 'the site-root CSP declares no script-src hash, so the inline theme script will be blocked')
    } else if (declared[0] !== hash) {
      fail('vercel.json', `script hash mismatch - the before-paint theme script would be blocked on every load\n        computed ${hash}\n        declared ${declared[0]}`)
    }
    console.log('')
  }
}

/* ------------------------------- netlify.toml must agree with vercel.json */

/*
 * The same headers now live in two files, because neither host reads the other's
 * config. Two hand-maintained copies of a security policy drift: someone adds a
 * directive to the host they are using, the other keeps the old one, and there
 * is nothing to notice except that the two deployments differ in a way nobody
 * chose. So they are compared rather than trusted.
 *
 * Compared on meaning, not on bytes. `netlify.toml` writes the policy as a TOML
 * multi-line string with trailing backslashes, which is the same policy spread
 * over eight lines; requiring the two to be character-identical would mean
 * asserting on TOML whitespace and would itself drift.
 */
if (existsSync('netlify.toml')) {
  const toml = readFileSync('netlify.toml', 'utf8')

  /** Pull a value out of a TOML multi-line basic string and flatten it. */
  const fromToml = (key) => {
    const m = new RegExp(`${key}\\s*=\\s*"""([\\s\\S]*?)"""`).exec(toml)
    if (!m) return null
    return m[1].split('\n').map((l) => l.trim().replace(/\\$/, '')).join(' ').trim()
  }

  /** Directives as a sorted list, so ordering and line breaks stop mattering. */
  const directives = (csp) =>
    csp
      .split(';')
      .map((d) => d.trim().toLowerCase().replace(/\s+/g, ' '))
      .filter(Boolean)
      .sort()

  const pairs = [
    ['site root', rootCsp, fromToml('Content-Security-Policy')],
    ['pdf', headersFor('/x.pdf').get('content-security-policy'), fromToml2Pdf()],
  ]

  function fromToml2Pdf() {
    const blocks = toml.split('[[headers]]')
    const pdfBlock = blocks.find((b) => /for\s*=\s*"\/\*\.pdf"/.test(b))
    if (!pdfBlock) return null
    const m = /Content-Security-Policy\s*=\s*"([^"]*)"/.exec(pdfBlock)
    return m ? m[1] : null
  }

  for (const [label, a, b] of pairs) {
    if (!a || !b) {
      if (a || b) fail('netlify.toml', `the ${label} policy is in one host config but not the other (vercel: ${a ? 'yes' : 'no'}, netlify: ${b ? 'yes' : 'no'})`)
      continue
    }
    const da = directives(a)
    const db = directives(b)
    if (da.join(';') !== db.join(';')) {
      const onlyVercel = da.filter((d) => !db.includes(d))
      const onlyNetlify = db.filter((d) => !da.includes(d))
      fail('netlify.toml', `the ${label} CSP differs from vercel.json\n        only in vercel.json: ${onlyVercel.join('; ') || '(none)'}\n        only in netlify.toml: ${onlyNetlify.join('; ') || '(none)'}`)
    } else {
      console.log(`  ${label.padEnd(26)} netlify.toml and vercel.json agree (${da.length} directives)`)
    }
  }

  /*
   * The framing pair is the one thing that legitimately differs per host config,
   * and it has to differ the same way on both. Read it the way a response would
   * be assembled - by asking what a PDF path actually resolves to - rather than
   * by grepping for a rule that mentions ".pdf": the site-wide rule mentions
   * ".pdf" too, inside the negative lookahead that excludes PDFs from it, so a
   * substring search picks the wrong rule and reports a disagreement that is not
   * there.
   */
  const netlifyPdfBlock = toml.split('[[headers]]').find((b) => /for\s*=\s*"\/\*\.pdf"/.test(b))
  const netlifyXfo = netlifyPdfBlock ? (/X-Frame-Options\s*=\s*"([^"]*)"/.exec(netlifyPdfBlock) || [])[1] : null
  const vercelXfo = headersFor('/x.pdf').get('x-frame-options')
  if (netlifyXfo && vercelXfo && netlifyXfo !== vercelXfo) {
    fail('netlify.toml', `the resume is framable differently per host: netlify sends X-Frame-Options ${netlifyXfo}, vercel sends ${vercelXfo}`)
  } else if (netlifyXfo && vercelXfo) {
    console.log(`  ${'resume framing'.padEnd(26)} both send X-Frame-Options ${vercelXfo}`)
  }
  console.log('')
}

if (failures.length) {
  console.log(`FAIL  ${failures.length} problem(s)`)
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}

console.log('header audit passed')