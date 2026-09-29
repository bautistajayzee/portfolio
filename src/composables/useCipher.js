import { ref } from 'vue'

/**
 * The cipher effect: a title sits scrambled, then resolves left to right as
 * each position locks onto its real character.
 *
 * This is the same architecture as `useTypewriter`, and for the same reason.
 * The effect this replaces was written as `@keyframes` animating the `content`
 * property, which is **Chromium-only** — Firefox does not support animating
 * `content` at all, and Safari only recently. That presents as permanently
 * scrambled text on a page where the title should be, and there is nothing in
 * the console to explain it. A rAF loop writing `textContent` is the same fix
 * the masthead needed, applied to the same slot.
 *
 * Three properties this is careful about, all of them earned:
 *
 * · **The title rests visible and correct.** Nothing is scrambled until the
 *   effect actually starts, so with JavaScript off — or if fonts never load, or
 *   if rAF is throttled to death — the title is simply the title.
 * · **Widths are pinned from the browser, before anything moves.** See
 *   `pinWidths`; this is the whole reason the effect does not reflow.
 * · **A guard settles the title** if the loop never completes, so a stalled
 *   frame can never leave a section heading as gibberish.
 */
export function useCipher(getText, options = {}) {
  const {
    duration = 700,
    glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*<>',
    /** How far a position may drift from the decode wave. */
    jitter = 0.34,
    fontWait = 1400,
    guardSlack = 900,
  } = options

  const cellEls = ref([])

  let raf = 0
  let guard = 0
  let origin = 0
  let token = 0

  /** Per-cell progress at which that position locks onto its real character. */
  let locks = []
  let chars = []

  const setCell = (i, el) => {
    if (cellEls.value[i] === el) return
    cellEls.value[i] = el
  }

  /**
   * One random glyph.
   *
   * Indexes the *glyph set*, deliberately: `ch.charAt(n)` would index the cell's
   * own single character and return `''` for every position but zero, which
   * blanks the title instead of scrambling it.
   */
  function scramble() {
    return glyphs.charAt(Math.floor(Math.random() * glyphs.length))
  }

  /**
   * Freeze every cell at the width the real text already gave it.
   *
   * The reference implementation this is based on uses a monospace face, where
   * every glyph is identical in width and a scramble cannot reflow anything.
   * These titles are proportional, so a random glyph is a different width from
   * the character it replaces — and the whole word would breathe for the
   * duration of the effect, which on a heading that large reads as a wobble
   * rather than a decode.
   *
   * The widths come from `getBoundingClientRect` on each cell *before* the
   * scramble starts, meaning they are the browser's own advance widths for the
   * real text, letter-spacing and kerning included. Pinning them is therefore
   * lossless: the settled title occupies exactly the same space it did before
   * the effect ran, so nothing snaps when it lands.
   */
  function pinWidths() {
    for (const el of cellEls.value) {
      if (!el) continue
      const w = el.getBoundingClientRect().width
      if (w > 0) el.style.width = `${w}px`
    }
  }

  /**
   * Lay out the decode wave.
   *
   * Positions lock in order, each with a little randomness, so the resolution
   * crosses the word rather than snapping all at once. The spread is kept
   * inside `duration` deliberately — a title that is still scrambling when the
   * animation has finished looks broken, not clever.
   */
  function plan() {
    const n = chars.length || 1
    locks = chars.map((_, i) => {
      const wave = n === 1 ? 0 : i / (n - 1)
      return Math.min(0.97, 0.12 + wave * 0.6 + Math.random() * jitter)
    })
  }

  /** Show the real title and stop touching it. Also the failure path. */
  function settle() {
    window.cancelAnimationFrame(raf)
    raf = 0
    window.clearTimeout(guard)
    guard = 0

    for (const [i, el] of cellEls.value.entries()) {
      if (!el) continue
      el.textContent = chars[i] ?? el.textContent
      el.classList.remove('cipher-cell--on')
      el.style.width = ''
    }
  }

  /** Scramble immediately, so the first painted frame is already gibberish. */
  function scrambleAll() {
    for (const [i, el] of cellEls.value.entries()) {
      if (!el) continue
      const ch = chars[i]
      // A space stays a space. Scrambling one turns "Tech Stack" into a word
      // with a glyph where the gap should be, and the gap is load-bearing.
      el.textContent = ch === ' ' ? ' ' : scramble()
      el.classList.add('cipher-cell--on')
    }
  }

  function tick() {
    const t = (performance.now() - origin) / 1000
    const p = Math.min(1, t / (duration / 1000))

    for (const [i, el] of cellEls.value.entries()) {
      if (!el) continue
      const ch = chars[i]
      if (ch === undefined) continue

      if (p >= locks[i]) {
        if (el.classList.contains('cipher-cell--on')) {
          el.textContent = ch
          el.classList.remove('cipher-cell--on')
        }
      } else {
        el.textContent = scramble()
      }
    }

    if (p >= 1) {
      settle()
      return
    }

    raf = requestAnimationFrame(tick)
  }

  /**
   * The font shorthand the title is actually rendered in.
   *
   * Read back off a live cell rather than hardcoded, for the same reason
   * `useTypewriter` does it: the effect must not run until the real face has
   * arrived, or the title scrambles, resolves, and then reflows when the
   * webfont lands — which is precisely the bug that made the masthead look
   * like it was typing in two different typefaces.
   */
  function facesNeeded() {
    const sample = cellEls.value.find(Boolean)
    if (!sample) return []
    const cs = getComputedStyle(sample)
    const face = cs.font || `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    return [face]
  }

  function fontsReady() {
    if (!document.fonts || typeof document.fonts.check !== 'function') return true
    const faces = facesNeeded()
    if (!faces.length) return true

    try {
      // The real string is passed deliberately: these faces are unicode-range
      // subsets, and against its default sample text `check()` reports a loaded
      // face as missing.
      return faces.every((face) => document.fonts.check(face, getText()))
    } catch {
      return true
    }
  }

  function waitForFonts() {
    if (fontsReady()) return Promise.resolve(true)
    if (!document.fonts) return Promise.resolve(true)

    const text = getText()

    return new Promise((resolve) => {
      let done = false
      const finish = (value) => {
        if (done) return
        done = true
        window.clearTimeout(timer)
        resolve(value)
      }
      const timer = window.setTimeout(() => finish(false), fontWait)

      Promise.all(facesNeeded().map((face) => document.fonts.load(face, text).catch(() => {})))
        .then(() => document.fonts.ready)
        .then(() => finish(fontsReady()), () => finish(false))
    })
  }

  /**
   * The only way the effect ever begins.
   *
   * Called repeatedly — the title replays every time it scrolls back into view —
   * so this has to be safe to enter mid-flight. Two things make that true:
   *
   * · The in-flight run is cancelled up front. Without that, a replay leaves
   *   the previous loop running and two loops write `textContent` into the same
   *   cells, which fights and settles on a half-scrambled title.
   * · `token` guards the await, so a component that unmounts mid-wait — or a
   *   third trigger firing while fonts are still loading — cannot start a loop
   *   over the top of the two it just stopped.
   */
  async function start() {
    const mine = ++token

    const wasRunning = raf !== 0
    window.cancelAnimationFrame(raf)
    window.clearTimeout(guard)
    raf = guard = 0

    const ready = await waitForFonts()
    if (mine !== token) return

    // Fonts never turned up. A legible heading beats a cipher.
    if (!ready) return settle()

    // Clean slate between runs. This is on the microtask queue when the fonts
    // are already cached, so it is never painted — it exists for the case
    // where the wait was long enough for a cancelled run to freeze mid-scramble.
    if (wasRunning) settle()

    chars = [...getText()]
    pinWidths()
    plan()
    scrambleAll()

    origin = performance.now()
    raf = requestAnimationFrame(tick)

    // If that first frame never arrives, show the title rather than gibberish.
    guard = window.setTimeout(settle, duration + guardSlack)
  }

  function stop() {
    token += 1
    window.cancelAnimationFrame(raf)
    window.clearTimeout(guard)
    raf = guard = 0
    settle()
  }

  return { cellEls, setCell, start, stop, settle }
}
