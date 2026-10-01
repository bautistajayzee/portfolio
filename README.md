# Portfolio

A personal site for **Jayzee G. Bautista** — Information Technology student at
NCST, Dasmariñas, Cavite. Nine sections, one accent colour, no framework
furniture. Vue 3 + Tailwind CSS v4, built as a static bundle.

```bash
npm install
npm run dev        # vite dev server
npm run build      # -> dist/
npm run preview    # serve the built bundle
node scripts/audit-data.mjs   # content consistency check (exits 1 on failure)
```

---

## What is actually in the box

| dependency | why |
|---|---|
| `vue` | the whole app |
| `tailwindcss` + `@tailwindcss/vite` | all styling; no CSS framework, no component library |
| `gsap` | ScrollTrigger only — section drift, hero parallax, scroll progress |
| `@upstash/redis` | storage behind the presence function. **Functions only** — see [Deploy](#deploy) |

There is no router, no state library, no UI kit, and no HTTP client. Every page
of the site is in one document and navigation is anchor-based.

### Source map

```
src/
  App.vue                  shell: rail, mobile nav, footer, chat, lightbox
  main.js
  style.css                tokens, both themes, the reduced-motion block
  data/portfolio.js        ALL content. Nothing else holds copy.
  lib/datetime.js          timezone + every date format, in one place
  composables/
    useSmoothScroll.js     anchor handling, the scroll tween, GSAP registration
    useScrollMotion.js     section-number drift, hero parallax
    useReveal.js           one shared IntersectionObserver for reveals
    useTypewriter.js       hero masthead typing
    useCipher.js           section-title cipher
    useClock.js            live clock, Manila
    useViewers.js          presence count, polls the function
    useTheme.js            system / light / dark
  components/
    layout/                SideNav, ContactRail, MobileNav, PageFooter
    sections/              one per section, plus ProjectRow
    ui/                    SectionHead, TypeTitle, SplitName, ProfileImage,
                           ThemeSwitch, ChatWidget, ChatAvatar, LetterComposer,
                           Lightbox, Rule, ScrollProgress
  directives/reveal.js
api/viewers.js                 presence endpoint (Redis sorted set)
vercel.json                    build config + security headers for Vercel
netlify.toml                   the same headers, for a future Netlify deploy
scripts/audit-data.mjs         content consistency check
scripts/audit-headers.mjs      what vercel.json actually sends, per path
scripts/audit-viewers.mjs      drives the presence function against a Redis shim
scripts/make-icons.mjs         favicon.svg -> the PNGs a phone home screen needs
public/                        favicon, 3 PNG icons, og image, manifest,
                               robots.txt, profile photo, resume, screenshots
```

---

## Decisions worth knowing about

Most of these exist because the obvious version was quietly broken.

**The masthead types from a `requestAnimationFrame` loop, not CSS keyframes.**
The original was `@keyframes` animating `clip-path`, which shipped, reported
itself as attached, and never played. `useTypewriter.js` writes `clip-path` per
frame instead. Same reason the section titles use `useCipher.js` for the same
job.

**Nothing types until the real fonts have arrived.** The webfonts are served
with `display=swap`, so a naive implementation types the name out in a fallback
face and then reflows it when the real one lands — the name visibly changes
underneath you. Both typewriters wait on `document.fonts.check()`, with a
timeout, and fall back to just showing the text.

**Section titles cipher, the hero typewriter.** Two different effects on
purpose: the hero is one event on load, the titles are a per-section beat as you
scroll.

**The cipher pins its own cell widths before it moves.** The effect it replaced
was monospace, where every glyph is the same width and nothing can reflow. These
titles are proportional, so a random glyph is a different width from the
character it replaces and the word visibly wobbles. `useCipher.js` measures each
cell with `getBoundingClientRect` *before* the scramble starts and pins it, so
the settled title occupies exactly the space it did before.

**Smooth scroll is hand-written.** Lenis was used, then removed. `useSmoothScroll.js`
runs its own rAF tween; `html { scroll-behavior: smooth }` is the no-JS fallback.
The three bugs that came with Lenis are documented in the comments on
`onAnchorClick` and `refreshScroll`.

**Motion is not gated on `prefers-reduced-motion`.** The brief is that it plays
regardless of the OS setting. This was the source of a long, wrong diagnosis:
the stylesheet carried a blanket `* { animation-duration: 0.01ms !important }`,
and `0.01ms` is what `getComputedStyle` reports as `1e-05s`. That looks exactly
like a browser whose timeline is frozen and it was mistaken for one for a long
time. **If an animation ever reports a `1e-05s` duration here, look for a rule
neutralising it before suspecting the browser.**

**One timezone, one format module.** Cavite is UTC+8 with no daylight saving.
`lib/datetime.js` holds the zone and every format string; the rail clock, the
chat header and the assistant's reply to "What time is it?" all read from it, so
they cannot disagree.

**The contact composer does not send.** There is no backend and no third-party
form service. The letter is assembled into a `mailto:` and a Gmail compose URL —
both real anchors, so cmd-click works and the href is inspectable. The visitor's
mail app opens with the letter written and the recipient visible, and they press
send there. Messages cap at 1000 characters because browsers start truncating
`mailto:` around 2000.

**Content has one source of truth, and it is not automatic.** `data/portfolio.js`
holds everything. The hero and Contact both render from `social`, so a handle
changed there appears in both. The chat answers are **hand-written strings and
are not derived from the data** — change a fact in the data and you must change
the answer too. `scripts/audit-data.mjs` exists to catch the case where you
forget, and it also asserts the resume filename never reaches visible copy.

---

## Design system

Tokens live at the top of `style.css`. The neutral ramp is **inverted** in dark
mode — `n-50` becomes the darkest surface, `n-950` the lightest — so every class
in the codebase keeps its meaning across themes without a single component
knowing which is active.

The accent is **defined per theme against its own paper**, because one colour
cannot serve both:

| | light | dark | on paper |
|---|---|---|---|
| paper | `#ffffff` | `#0b0b0d` | — |
| accent | `#116e4d` | `#93e9be` | 6.25:1 / 13.71:1 |

`#93e9be` on the white light page is **1.43:1** — a hole, not a colour. Hence the
deepened light value, which is the same hue family taken down far enough to
clear 6:1.

Type is Instrument Sans (display and body), Instrument Serif italic (the
masthead's second line only), and IBM Plex Mono for `.meta`. The Google Fonts
request is trimmed to what is actually set — the sans italic axis and the mono
500 were both downloaded and never used.

The quiet end of the grey ramp is deliberately compressed. `n-300` and `n-400`
used to sit at 1.48:1 and 2.48:1 on white — real WCAG AA failures across 145
elements. Because `n-300` is the lighter of the two and the paper is white, a
lighter colour always scores worse, so the lightness gap had to go rather than
the legibility. They are now 4.63:1 and 4.76:1 in light, 4.95:1 and 4.75:1 in
dark. Hierarchy in that region comes from size, weight and the accent, never
from contrast alone.

---

## Deploy

**Vercel**, from `vercel.json`: build command, output directory, and the security
headers — including a CSP whose script hash is computed from the built output,
with the recompute command written next to it.

```bash
npm run build     # also runs scripts/audit-headers.mjs via postbuild
vercel deploy --prod
```

`scripts/audit-headers.mjs` runs after every build, including a host's, and
fails it if the CSP hash no longer matches `dist/index.html`. A stale hash does
not break the page — it stops the one inline script that sets the theme before
first paint, so the symptom is a white flash on a dark-theme load and a CSP
error in the console. Failing the build is a much better way to find out than
shipping it.

**The presence function needs a Redis store.** Install the Redis integration from
the [Vercel Marketplace](https://vercel.com/marketplace?category=storage&search=redis);
it provides `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Those are the names the
old `@vercel/kv` client read, which is why they are used rather than the
`UPSTASH_REDIS_*` variant the library also accepts — `@vercel/kv` is deprecated
and the integration kept its variable names when it was rebranded.

**Without those variables the site still deploys and still works.** The endpoint
answers 503, the client reads that as "nobody is here", and the badge is simply
absent. It is the only feature on the site with an external dependency, and it
is built so that being wrong about it costs one small flourish and nothing else.

The function keeps presence in one Redis sorted set scored by last-seen time,
pruned past a 90s TTL on every write, so it cannot accumulate litter and does not
depend on a clean disconnect. Sorted set rather than a JSON object because
`ZADD`/`ZCARD`/`ZREMRANGEBYSCORE` are single server-side commands: the previous
JSON version read the whole map, modified it in JavaScript and wrote it back,
which is a read-modify-write across a network hop where two simultaneous
heartbeats raced and one visitor silently vanished. It stores a random per-tab id
and a timestamp. Nothing identifying. See `SECURITY.md`.

`scripts/audit-viewers.mjs` exercises all of that — heartbeat, refresh, leave,
TTL prune, cross-origin refusal, malformed input — against a local stand-in for
the Upstash REST API, so the real `@upstash/redis` client is doing the calling.
`vite preview` cannot do this: it serves `dist/` and has no notion of a
serverless function, so locally the endpoint is simply missing and the absence
looks exactly like success from the browser.

### Netlify

`netlify.toml` is kept with the same headers, so the Netlify path works whenever
that account has production deploys again. It currently does not — the team is
on operational credits, which keep an existing deploy online but cannot pay for
a new one.

One thing is missing there and only there: `netlify/functions/viewers.js` and
`@netlify/blobs` are gone, replaced by `api/viewers.js` and Redis, because Blobs
is a Netlify product that exists nowhere else. So a Netlify deploy 404s on
`/api/viewers` and the badge does not render. Nothing breaks.

If Netlify becomes the host again, the badge is the only thing to restore, and
it should be restored as a Netlify function rather than by reverting the client —
`useViewers` treats any failure as "no badge", so it needs no change at all.

---

## Known trade-offs

Honest list, not a to-do list.

- **The contact composer does not deliver mail**, by design. See above.
- **Three of six projects have no screenshot**, so their rows are bare Figma
  links. Exporting PNGs to `public/` is the only thing that changes this.
- **The resume PDF says "studentager".** A typo inside a binary PDF; it needs
  editing in the source document.
- **Project screenshots are 1919px wide** for a lightbox capped near 1400. They
  are only fetched when opened, so it costs nothing on load, but they are
  oversized for what is drawn.
- **`og:image` is omitted.** There is no share image; pointing at a path that
  does not resolve gives a broken thumbnail, which is worse than none.
