import { ref } from 'vue'

/**
 * The typing engine, used by the hero masthead.
 *
 * A `requestAnimationFrame` loop writes `clip-path` onto each line, one
 * character per step. No CSS animation and no keyframes — see the note in
 * `style.css` for why that approach was walked back from.
 *
 * The section titles used to share this, and now use `useCipher.js` instead.
 * They resolve out of scrambled glyphs rather than being cropped in; that
 * effect cannot be expressed as a `clip-path`, because a crop hides characters
 * that are already spelled out correctly underneath it.
 *
 * The line is revealed by cropping the glyphs, not by sliding a coloured panel
 * across them. A panel would have to match the page background exactly, which
 * means hardcoding a colour that has to be kept correct in both themes by hand;
 * `clip-path` needs no colour at all, so it is correct in both for free.
 *
 * Five properties this is careful about, each one bought with a bug:
 *
 * · **The text rests visible.** The hidden state is only ever applied by this
 *   script, so with JavaScript off the name is simply there.
 * · **A guard reveals everything** if the loop never finishes, so a throttled
 *   or paused rAF can never leave the text stuck behind a clip.
 * · **Timing derives from character count**, so speed is even regardless of
 *   word length and no retuning is needed when the copy changes.
 * · **Nothing types until the real fonts have arrived.** See `waitForFonts`.
 * · **The clock is ours.** `performance.now()`, not the timestamp rAF passes in.
 */
export function useTypewriter(getLines, options = {}) {
  const {
    perChar = 0.075,
    betweenLines = 0.18,
    firstDelay = 0.2,
    blinkMs = 530,
    fontWait = 1400,
    caret = true,
    persistCaret = true,
    guardSlack = 1200,
  } = options

  /** One entry per line, filled by `setLine` from a function ref. */
  const lineEls = ref([])

  /**
   * A plain variable, deliberately not a `ref`.
   *
   * The caret lives inside a `v-for`, and Vue collects template refs inside a
   * `v-for` into an **array** rather than binding them singly. A `ref` here
   * would therefore hold an array, `.style` would be undefined, and the very
   * first frame would throw — killing the loop and leaving the text clipped
   * shut, with the error buried in the console. A function ref avoids it.
   */
  let caretEl = null

  let raf = 0
  let guard = 0
  let blinker = 0
  let origin = 0
  let token = 0

  const setLine = (i, el) => {
    if (lineEls.value[i] === el) return
    lineEls.value[i] = el
  }

  const setCaret = (el) => {
    caretEl = el
  }

  /** Per-line plan: how many characters, how long it takes, when it starts. */
  function plan() {
    let at = firstDelay

    return getLines().map((line) => {
      const chars = [...line].length || 1
      const duration = chars * perChar
      const entry = { chars, duration, delay: at, endsAt: at + duration }
      at = entry.endsAt + betweenLines
      return entry
    })
  }

  function totalMs(steps) {
    const last = steps[steps.length - 1]
    return (last ? last.endsAt : firstDelay) * 1000
  }

  /** Drop the caret away, with a fade rather than a hard cut. */
  function dismissCaret() {
    if (!caretEl) return
    caretEl.classList.add('type-caret--fade')
    caretEl.style.opacity = '0'
    window.clearInterval(blinker)
    blinker = 0
  }

  function startBlinking() {
    if (!caretEl) return
    window.clearInterval(blinker)
    caretEl.style.left = '100%'
    blinker = window.setInterval(() => {
      if (caretEl) caretEl.style.opacity = caretEl.style.opacity === '0' ? '1' : '0'
    }, blinkMs)
  }

  /**
   * The animation is over. Stop the loop and put the caret where it belongs.
   *
   * With `persistCaret: false` the caret fades once the text is finished, so a
   * page of eight titles does not leave eight cursors blinking at rest.
   */
  function finish() {
    window.cancelAnimationFrame(raf)
    raf = 0
    window.clearTimeout(guard)
    guard = 0

    if (!caretEl) return
    if (persistCaret) startBlinking()
    else dismissCaret()
  }

  /** Show everything and stop touching it. The failure path. */
  function settle() {
    window.cancelAnimationFrame(raf)
    raf = 0
    window.clearInterval(blinker)
    blinker = 0

    for (const el of lineEls.value) {
      if (el) el.style.clipPath = ''
    }

    if (caretEl) {
      caretEl.style.left = '100%'
      if (persistCaret) caretEl.style.opacity = '1'
      else dismissCaret()
    }
  }

  /** Hide everything, so a replay starts from nothing. */
  function hide() {
    for (const el of lineEls.value) {
      if (el) el.style.clipPath = 'inset(0 100% 0 0)'
    }
    if (caretEl) {
      caretEl.style.opacity = '0'
      caretEl.style.left = '0'
    }
  }

  function tick() {
    // `performance.now()` rather than the timestamp rAF hands over. The argument
    // is normally the same value, but it is the one input here the host
    // controls, and if it ever repeats or stalls the animation stalls with it.
    // Owning the clock means a bad frame can only ever cost a frame.
    const t = (performance.now() - origin) / 1000
    const steps = plan()
    const last = steps[steps.length - 1]

    for (const [i, step] of steps.entries()) {
      const el = lineEls.value[i]
      if (!el) continue

      const local = t - step.delay
      let shown
      if (local <= 0) shown = 0
      else if (local >= step.duration) shown = step.chars
      else shown = Math.floor((local / step.duration) * step.chars)

      el.style.clipPath = `inset(0 ${(1 - shown / step.chars) * 100}% 0 0)`
    }

    // The caret rides the last line, and only appears once that line starts.
    const c = caretEl
    if (c && last) {
      const local = t - last.delay
      if (local < 0) {
        c.style.opacity = '0'
      } else {
        c.style.opacity = '1'
        const shown = Math.min(
          last.chars,
          Math.floor((local / last.duration) * last.chars),
        )
        c.style.left = `${(shown / last.chars) * 100}%`
      }
    }

    if (t >= last.endsAt) {
      finish()
      return
    }

    raf = requestAnimationFrame(tick)
  }

  /**
   * The font shorthand each line is actually rendered in.
   *
   * Read back off the element rather than hardcoded. The masthead is set in a
   * semibold sans with a serif italic second line, the section titles in a
   * medium sans — asking each element what it actually wants means this stays
   * correct when the typography changes, and it means a title never types
   * itself out in a face it is not displayed in.
   */
  function facesNeeded() {
    const faces = new Set()
    for (const el of lineEls.value) {
      if (!el) continue
      const cs = getComputedStyle(el)
      faces.add(cs.font || `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`)
    }
    return [...faces]
  }

  function fontsReady() {
    if (!document.fonts || typeof document.fonts.check !== 'function') return true

    const text = getLines().join('')
    const faces = facesNeeded()
    if (!faces.length) return true

    try {
      // The real string is passed deliberately. These fonts are served as
      // unicode-range subsets, and against its default sample text `check()`
      // reports a loaded face as missing — which would burn the full timeout on
      // every single load.
      return faces.every((face) => document.fonts.check(face, text))
    } catch {
      return true
    }
  }

  /**
   * Resolve `true` once the faces are loaded, `false` if they never arrive.
   *
   * Faces are requested by name rather than waiting passively on
   * `document.fonts.ready`, because `ready` also waits on faces this text never
   * uses — the mono, the italic sans — and would stall the animation behind
   * downloads that cannot affect it.
   *
   * The timeout is the important half. If Google Fonts is slow, blocked, or the
   * visitor is offline, this settles `false` and the caller reveals the text
   * untyped in whatever font is available. That is the right outcome: text that
   * types itself out in the wrong typeface and then reflows mid-sentence is
   * worse than text that simply appears.
   */
  function waitForFonts() {
    if (fontsReady()) return Promise.resolve(true)
    if (!document.fonts) return Promise.resolve(true)

    const text = getLines().join('')

    return new Promise((resolve) => {
      let done = false
      const finish = (value) => {
        if (done) return
        done = true
        window.clearTimeout(timer)
        resolve(value)
      }
      const timer = window.setTimeout(() => finish(false), fontWait)

      Promise.all(
        facesNeeded().map((face) => document.fonts.load(face, text).catch(() => {})),
      )
        .then(() => document.fonts.ready)
        .then(() => finish(fontsReady()), () => finish(false))
    })
  }

  function play() {
    window.cancelAnimationFrame(raf)
    window.clearTimeout(guard)
    window.clearInterval(blinker)

    hide()

    origin = performance.now()
    raf = requestAnimationFrame(tick)

    // If that first frame never arrives, show the text rather than hide it.
    guard = window.setTimeout(settle, totalMs(plan()) + guardSlack)
  }

  /**
   * The only way the animation ever begins.
   *
   * `token` guards the await: if the component unmounts, or a replay is
   * triggered while the fonts are still loading, the older wait resolves into a
   * no-op rather than starting a second loop over the top of the first.
   */
  async function start() {
    const mine = ++token

    hide()

    const ready = await waitForFonts()
    if (mine !== token) return

    // Fonts never turned up. Content beats choreography.
    if (!ready) return settle()

    play()
  }

  function stop() {
    token += 1
    window.cancelAnimationFrame(raf)
    window.clearTimeout(guard)
    window.clearInterval(blinker)
    raf = guard = blinker = 0
  }

  return { lineEls, setLine, setCaret, start, stop, settle, caret }
}
