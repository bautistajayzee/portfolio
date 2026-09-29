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
| `@netlify/blobs` | storage behind the Netlify presence function. **Functions only** — see [Deploy](#deploy) |

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
    layout/                SideNav, MobileNav, PageFooter
    sections/              one per section, plus ProjectRow
    ui/                    SectionHead, TypeTitle, SplitName, ProfileImage,
                           ThemeSwitch, ChatWidget, ChatAvatar, LetterComposer,
                           Lightbox, Rule, ScrollProgress
  directives/reveal.js
netlify/functions/viewers.js   presence endpoint (Blobs store)
scripts/audit-data.mjs         content consistency check
public/                        favicon, profile photo, resume PDF, 3 screenshots
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
masthead's second line only), and IBM Plex Mono for `.meta`.

---

## Deploy

Static. `netlify.toml` declares the build and the function directory.

**The presence function only deploys through the CLI or a linked Git repo.**
Dragging `dist/` into the browser drops `netlify/functions/`, the badge quietly
does not appear, and the console shows a 404 on `/api/viewers` — that is the
graceful path, not a fault.

```bash
netlify deploy --prod
```

The function keeps a presence map in Netlify Blobs as one JSON object, pruned on
every heartbeat past a 90s TTL, so it cannot accumulate litter and does not
depend on a clean disconnect. It stores a random per-tab id and a timestamp.
Nothing identifying. Requires no third-party account.

---

## Known trade-offs

Honest list, not a to-do list.

- **The grey ramp fails WCAG AA on small metadata.** `.meta` is 11px and sits on
  `n-400`, which is 2.48:1 on the light page and 4.18:1 on the dark one. 112
  elements use it. `n-300` — the *inactive* section numbers — is 1.48:1. This is
  a deliberate "quiet metadata" language, but it is a real failure and cannot be
  fixed without making the page busier. Raising the low end of the ramp is the
  only lever.
- **The contact composer does not deliver mail**, by design. See above.
- **Three of six projects have no screenshot**, so their rows are bare Figma
  links with no preview.
- **`SCHOOL_INVENTORY.jpg`** sits unreferenced at the repo root. Not shipped —
  it is outside `public/` — but it is dead weight in the repository.
- **The resume PDF says "studentager".** A typo in the source document.
