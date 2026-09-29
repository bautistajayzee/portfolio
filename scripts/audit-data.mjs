// Deploy-readiness audit. Reads the data module and checks it against itself,
// so a fact changed in one place and not another shows up as a failure.
// Run: node scripts/audit-data.mjs
import { readFileSync } from 'node:fs'
import {
  profile, sections, social, about, education, experience, skills,
  techStack, projects, resume, contact, chat,
} from '../src/data/portfolio.js'

const fails = []
const warns = []
const fail = (m) => fails.push(m)
const warn = (m) => warns.push(m)

const text = JSON.stringify({ profile, about, education, experience, skills, techStack, projects, resume, contact, chat })
const answers = chat.map((q) => q.answer).join('\n')

// --- shape -----------------------------------------------------------------
for (const key of ['firstName', 'email', 'photo', 'role', 'location', 'school']) {
  if (!profile[key]) fail(`profile.${key} is empty`)
}
if (profile.phone || profile.phoneHref) fail('profile still carries a phone field — should have been removed')

if (sections.length !== 9) fail(`expected 9 sections, found ${sections.length}`)
sections.forEach((s, i) => {
  if (s.index !== String(i + 1).padStart(2, '0')) fail(`section ${s.id} index is ${s.index}, expected ${String(i + 1).padStart(2, '0')}`)
})

// --- contact / social consistency -----------------------------------------
const mailtoSet = new Set(contact.details.filter((d) => d.href?.startsWith('mailto:')).map((d) => d.href))
if (mailtoSet.size !== 1) fail(`contact has ${mailtoSet.size} distinct mailto hrefs`)
for (const href of mailtoSet) {
  if (href !== `mailto:${profile.email}`) fail(`contact mailto "${href}" does not match profile.email`)
}
if (contact.details.some((d) => d.label.toLowerCase() === 'phone')) fail('contact still lists a Phone row')

// every assistant answer must name the real channels, not stale ones
if (!answers.includes(profile.email)) fail('no chat answer mentions the current email')
if (/jayzeeb65/.test(answers)) fail('a chat answer still quotes the OLD email')
if (/968\s?554|685546997/.test(answers)) fail('a chat answer still quotes the phone number')
if (/2018\s*—\s*2022/.test(text)) fail('the old 2018-2022 experience range survives somewhere')

for (const item of social.filter((s) => s.href.startsWith('http'))) {
  const handle = item.label.toLowerCase()
  if (handle === 'linkedin' && !answers.includes('jayzeegbautista')) fail('LinkedIn added to social but not to any chat answer')
  if (handle === 'github' && !answers.includes('bautistajayzee')) fail('GitHub handle missing from chat answers')
  if (handle === 'instagram' && !answers.includes('jayzbau')) fail('Instagram handle missing from chat answers')
}

// --- resume ---------------------------------------------------------------
if (resume.filename !== 'Bautista, Jayzee G. (RESUME).pdf') fail(`resume.filename is "${resume.filename}"`)
const encoded = resume.url
if (!/^https?:/.test(encoded)) {
  if (encodeURI(' ').replace(/%20/g, ' ').length && !encoded.includes('%20')) fail(`resume.url is not correctly encoded: ${encoded}`)
}
// The filename must never reach visible copy — only the `download` attribute.
if (resume.filename) {
  const consumers = ['ResumeSection.vue', 'ContactSection.vue', 'HomeSection.vue']
  // eslint-disable-next-line no-undef
  for (const f of consumers) {
    try {
      const src = readFileSync(new URL(`../src/components/sections/${f}`, import.meta.url), 'utf8')
      if (/caption=\{resume\.filename\}|\{\{[^}]*resume\.filename[^}]*\}\}/.test(src)) {
        fail(`${f} renders resume.filename as visible copy`)
      }
    } catch { /* file absent is fine */ }
  }
}

// --- projects -------------------------------------------------------------
projects.forEach((p) => {
  if (!p.title) fail('a project has no title')
  if (p.preview && !/^\/[^ ]+\.(jpg|jpeg|png|webp|avif)$/i.test(p.preview)) fail(`project "${p.title}" preview path looks wrong: ${p.preview}`)
  if (p.link && !/^https:\/\//.test(p.link)) fail(`project "${p.title}" link is not https: ${p.link}`)
  if (p.link && /[?&]t=/.test(p.link)) fail(`project "${p.title}" link still carries the share-tracking param`)
})
const withPreview = projects.filter((p) => p.preview).length
warn(`${projects.length} projects, ${withPreview} with a screenshot (the rest are bare Figma links)`)

// --- chat -----------------------------------------------------------------
chat.forEach((q, i) => {
  if (!q.id) fail(`chat question ${i} has no id`)
  if (typeof q.answer !== 'string' && typeof q.answer !== 'function') fail(`chat "${q.id}" answer is neither string nor function`)
  if (typeof q.answer === 'string' && !q.answer.trim()) fail(`chat "${q.id}" answer is blank`)
  const ids = chat.map((x) => x.id)
  if (new Set(ids).size !== ids.length) fail('duplicate chat ids')
})
const hasTimeQuestion = chat.some((q) => typeof q.answer === 'function')
if (!hasTimeQuestion) warn('no dynamic (function) chat answer — the clock question may have gone missing')

// --- stray content --------------------------------------------------------
// Scoped to `experience`, not the whole document: `2018` is a legitimate
// education date and flagging it globally produced a false positive.
if (/2018\s*—\s*2022/.test(JSON.stringify(experience))) fail('experience still carries the old 2018-2022 range')
for (const bad of ['lorem', 'TODO', 'FIXME', 'placeholder', 'XXX', 'studentager']) {
  if (new RegExp(bad, 'i').test(text)) fail(`suspicious content found: "${bad}"`)
}

console.log(`projects: ${projects.length}`)
console.log(`techStack: ${techStack.length} groups, ${techStack.reduce((n, g) => n + g.items.length, 0)} items`)
console.log(`education: ${education.length}  experience: ${experience.length}  chat: ${chat.length}`)
console.log('')
for (const w of warns) console.log(`  WARN  ${w}`)
for (const f of fails) console.log(`  FAIL  ${f}`)
console.log('')
console.log(fails.length ? `${fails.length} FAILURE(S)` : 'data audit passed')
process.exit(fails.length ? 1 : 0)
