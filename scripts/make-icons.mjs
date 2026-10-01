/**
 * Rasterise the favicon into the PNGs that some platforms insist on.
 *
 * Why any of this exists
 *
 * `favicon.svg` covers the browser tab. It does not cover the two places a
 * phone will look for an icon and find nothing:
 *
 * · **iOS home screen.** Safari's "Add to Home Screen" reads
 *   `<link rel="apple-touch-icon">` and ignores the SVG entirely. With no such
 *   link it screenshots the page instead, so the icon on someone's home screen
 *   is a thumbnail of the hero photograph. That is the gap this closes.
 * · **Android / installed web app.** Those read a web manifest, and a manifest
 *   without icons is worse than no manifest, so 192 and 512 come along too.
 *
 * Why the corners differ
 *
 * `apple-touch-icon.png` is drawn square on purpose. iOS applies its own mask
 * with its own corner radius, so a pre-rounded icon ends up double-rounded and
 * visibly narrower than every other app on the screen. The manifest icons keep
 * the rounded square, because Android's legacy launcher path does not mask.
 *
 * Regenerating is rarely needed - the PNGs are committed - but the icon has to
 * stay derivable from one source rather than being hand-edited per platform.
 *
 * Needs sharp, which is deliberately not a dependency of this project:
 *
 *   npm install --no-save sharp && node scripts/make-icons.mjs
 *
 * Run: node scripts/make-icons.mjs
 */

import { writeFileSync, readFileSync } from 'node:fs'

let sharp
try {
  ;({ default: sharp } = await import('sharp'))
} catch {
  console.error('make-icons: sharp is not installed.')
  console.error('  npm install --no-save sharp && node scripts/make-icons.mjs')
  console.error('  The committed PNGs in public/ are the deliverable; this only regenerates them.')
  process.exit(1)
}

const src = readFileSync('public/favicon.svg', 'utf8')

/**
 * The same artwork, with the outer corner radius scaled to the output size.
 *
 * No other change is needed. The background rect is already an opaque
 * `fill="#0a0a0a"` covering the whole 32-unit box, so setting its radius to 0
 * for the iOS icon produces a fully square, fully opaque PNG - which is what
 * iOS composites cleanly. An earlier version of this script also tried to strip
 * transparency and ended up emitting `fill` twice, which is not valid SVG and
 * was rejected by the parser. There was nothing to strip.
 *
 * The strokes are not scaled: the source is a 32-unit viewBox rendered at each
 * size, the paths carry their own units, and the proportion is already correct.
 */
function icon({ size, radius }) {
  const scaled = src
    .replace(/rx="7"/, `rx="${((radius / size) * 32).toFixed(3)}"`)
    .replace(/width="32" height="32"/, `width="${size}" height="${size}"`)
  return sharp(Buffer.from(scaled), { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer()
}

const TARGETS = [
  { file: 'public/apple-touch-icon.png', size: 180, radius: 0, why: 'iOS home screen', square: true },
  { file: 'public/icon-192.png', size: 192, radius: 42, why: 'Android home screen', square: false },
  { file: 'public/icon-512.png', size: 512, radius: 112, why: 'installed app / splash', square: false },
]

console.log('icon rasterisation\n')

let bad = 0
for (const t of TARGETS) {
  const buf = await icon(t)
  writeFileSync(t.file, buf)
  const meta = await sharp(buf).metadata()
  const wrongSize = meta.width !== t.size || meta.height !== t.size
  if (wrongSize) bad++
  console.log(
    `  ${t.file.padEnd(30)} ${String(meta.width).padStart(4)}x${meta.height}  ` +
      `${(buf.length / 1024).toFixed(1).padStart(6)} KB  alpha=${String(meta.hasAlpha).padEnd(5)}  ${t.why}`,
  )
}

/*
 * The one property that cannot be eyeballed from here: whether the iOS icon is
 * actually opaque. A transparent-cornered apple-touch-icon is composited by iOS
 * against black, so it ships looking like a dark square with dark corners rather
 * than the intended rounded monogram. Assert it rather than assume it, because
 * the generator would otherwise report success either way.
 */
{
  const { data, info } = await sharp('public/apple-touch-icon.png')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let transparent = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) transparent++
  const pct = (transparent / (info.width * info.height)) * 100
  if (pct > 0) {
    bad++
    console.log(`\n  FAIL  apple-touch-icon has ${pct.toFixed(1)}% transparent pixels; iOS composites those against black`)
  } else {
    console.log(`\n  apple-touch-icon is fully opaque (0 of ${info.width * info.height} pixels transparent)`)
  }
}

if (bad) {
  console.log(`\nFAIL  ${bad} problem(s)`)
  process.exit(1)
}
console.log('wrote 3 files to public/')