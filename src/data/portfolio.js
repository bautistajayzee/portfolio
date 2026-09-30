/**
 * All site content lives here.
 * To add a project, append an object to `projects` — the layout handles
 * itself. Nothing else needs to change.
 */

import { formatSpokenDate, formatSpokenTime } from '../lib/datetime.js'

const FIRST_NAME = 'Jayzee'
const LAST_NAME = 'Bautista'

export const profile = {
  firstName: FIRST_NAME,
  middleInitial: 'G.',
  lastName: LAST_NAME,
  fullName: 'Jayzee G. Bautista',
  /**
   * The mobile lockup: first name plus the surname's initial.
   *
   * Derived rather than typed out, so it cannot drift from the name above it if
   * either part is ever corrected. The top bar and the mobile menu share it —
   * they used to say "Bautista" alone, which identifies the site by surname only
   * and reads as an error on a lockup rather than as a mark of authorship.
   *
   * The desktop rail keeps the full name; at 168px of usable width there is room
   * for it, and the rail is not space-constrained the way a phone is.
   */
  shortName: `${FIRST_NAME} ${LAST_NAME.charAt(0)}.`,
  role: 'IT student & aspiring IT professional',
  location: 'Cavite, Philippines',
  school: 'Dasmariñas, Cavite',
  photo: '/Bautista.jpg',
  email: 'jayzeegbautista@gmail.com',
}

/** Drives the side rail, the mobile menu, and the section numbering. */
export const sections = [
  { id: 'home', index: '01', label: 'Home' },
  { id: 'about', index: '02', label: 'About' },
  { id: 'education', index: '03', label: 'Education' },
  { id: 'experience', index: '04', label: 'Experience' },
  { id: 'skills', index: '05', label: 'Skills' },
  { id: 'stack', index: '06', label: 'Tech Stack' },
  { id: 'projects', index: '07', label: 'Projects' },
  { id: 'resume', index: '08', label: 'Resume' },
  { id: 'contact', index: '09', label: 'Contact' },
]

/**
 * The hero's link row — short names separated by slashes, not full addresses.
 *
 * Only real, reachable destinations. The GitHub handle is the one on the LMS
 * repository's remote, not a guess; the Instagram and LinkedIn addresses were
 * given directly.
 * `contact` is an in-page anchor, so it goes through the same smooth-scroll
 * handler as the side rail. Email is not here, but it is still on the side
 * rail, in Contact and in the assistant, so nothing became unreachable by
 * dropping it.
 *
 * Single source of truth for both places it renders: the hero prints the whole
 * list, and Contact filters it down to the `http` entries so the `#contact`
 * anchor does not show up there as a link to itself. Add a profile here and it
 * appears in both. The assistant's answers are hand-written and are NOT derived
 * from this, so they have to be updated alongside it.
 */
export const social = [
  { label: 'instagram', href: 'https://instagram.com/jayzbau' },
  { label: 'contact', href: '#contact' },
  { label: 'github', href: 'https://github.com/bautistajayzee' },
  { label: 'linkedin', href: 'https://www.linkedin.com/in/jayzeegbautista/' },
]

export const about = {
  lead: 'I like things that are clear. A layout that explains itself, a program that does one job properly, a poster where you can feel the decision behind it.',
  body: [
    "I'm an Information Technology student at the National College of Science and Technology, and I'm working toward becoming an IT professional. Most of what I know so far, I learned by making something and then fixing what broke.",
    'Before that I spent four years doing freelance graphic design and video editing. Client briefs taught me to read a requirement carefully, ask the obvious question early, and hit a deadline without the quality slipping. That habit transfers more than I expected.',
    "Right now I'm focused on the fundamentals — programming, systems, and databases — while keeping the design side of my work alive through freelance projects.",
  ],
  /** Small facts listed beside the prose on wide screens. */
  facts: [
    { label: 'Discipline', value: 'Information Technology' },
    { label: 'School', value: 'NCST — Dasmariñas' },
    { label: 'Also does', value: 'Graphic design · Video' },
    { label: 'Seeking', value: 'Entry-level IT roles' },
  ],
}

export const education = [
  {
    period: '2024 — Present',
    title: 'Bachelor of Science in Information Technology',
    institution: 'National College of Science and Technology',
    detail: 'Dasmariñas, Cavite · STEM strand',
    note: 'Coursework across programming, systems analysis, networking, and database management, alongside a continuing freelance practice in design.',
  },
  {
    period: '2021 — 2024',
    title: 'Senior High School',
    institution: 'Tropical Innovative School of Excellence, Inc.',
    detail: 'Tagaytay City, Cavite',
  },
  {
    period: '2018 — 2021',
    title: 'Junior High School',
    institution: 'Alternative Learning System',
    detail: 'Gen. Mariano Alvarez, Cavite',
  },
  {
    period: '2017 — 2018',
    title: 'Junior High School',
    institution: 'Holy Family Academy',
    detail: 'Gen. Mariano Alvarez, Cavite',
  },
  {
    period: '2011 — 2017',
    title: 'Elementary through High School',
    institution: 'Victorious Christian Montessori',
    detail: 'Cavite',
  },
]

/**
 * The resume, served straight out of `public/`.
 *
 * The URL below is hand-written rather than encoded, and that is deliberate.
 * Only the spaces are percent-encoded. The comma has to stay a literal `,`:
 * sending `%2C` makes both the Vite dev server and `vite preview` miss the file
 * and fall through to the SPA fallback, so the buttons quietly open the
 * homepage instead of the PDF. Verified against both servers.
 *
 * A comma is a legal sub-delimiter in a URI path, so this form is also correct
 * on a plain static host (Netlify, GitHub Pages, Apache, nginx).
 */
export const resume = {
  title: 'Curriculum Vitae',
  url: '/Bautista,%20Jayzee%20G.%20(RESUME).pdf',
  /**
   * Never shown on the page — it is a filename, not a heading. Kept only to pin
   * the `download` attribute, so the file lands on the visitor's disk with its
   * real name rather than a percent-encoded one.
   */
  filename: 'Bautista, Jayzee G. (RESUME).pdf',
  size: '70 KB',
  updated: '2026',
  note: 'A one-page PDF — the same document recruiters get. Opens in the browser’s own PDF viewer, or downloads straight to the device; nothing is embedded on this page.',
}

export const experience = [
  {
    period: '2016 — 2022',
    title: 'Freelance Graphic Designer & Video Editor',
    organisation: 'Self-employed · Fiverr · Upwork',
    summary:
      'Worked directly with clients on design and video, mostly for small businesses and student organisations.',
    points: [
      { label: 'Design', detail: 'Created graphic designs based on client requirements — layouts, posters, and brand assets.' },
      { label: 'Video', detail: 'Edited videos following client requirements, from raw footage to a finished cut.' },
      { label: 'Working', detail: 'Communicated with clients by message and met deadlines without dropping the quality.' },
    ],
  },
]

/**
 * The tool inventory, grouped the way a reader actually scans for it.
 *
 * Every entry here is something I have actually used on a real project — no
 * filler. A name is only worth listing if I could be asked about it in an
 * interview and answer with specifics, which is a stricter bar than "I have
 * watched a tutorial on it".
 *
 * Thin categories are left thin on purpose. An empty row reads as honest; a
 * padded one reads as a claim, and padding is what makes these lists worthless.
 *
 * Two classification rules, because the boundaries are what make a stack list
 * useful or decorative:
 *
 * · **An item sits where it is used, not where it is written.** Eloquent is
 *   Laravel's ORM and it is backend work, so listing it under Database made a
 *   data-access layer read like a storage engine — and put MySQL and MariaDB,
 *   the things that actually hold the rows, in a category with something that
 *   only talks to them.
 * · **A name has to be verifiable here or it does not go in.** Bootstrap was
 *   dropped from Frontend because nothing on this site used it: no dependency,
 *   no CDN tag, no class in the markup. Every project on this page is Vue with
 *   Tailwind, so listing a CSS framework that appears nowhere would be a claim
 *   about capability rather than a record of it.
 *
 * Within Frontend, Chart.js and Tabulator stay on the strength of the projects
 * above — the point-of-sale dashboard charts sales and its records are a grid —
 * not on anything in this repository, which is the point: the stack describes
 * the work, not this one page.
 */
export const techStack = [
  {
    label: 'Languages',
    items: ['JavaScript', 'PHP', 'SQL', 'HTML', 'CSS'],
  },
  {
    label: 'Frontend',
    items: ['Vue 3', 'Tailwind CSS', 'Vite', 'GSAP', 'Chart.js', 'Tabulator'],
  },
  {
    label: 'Backend',
    items: ['PHP 8', 'Laravel 13', 'Laravel Fortify', 'Blade', 'Eloquent', 'PDO', 'PHPMailer', 'PayMongo'],
  },
  {
    label: 'Database',
    items: ['MySQL', 'MariaDB'],
  },
  {
    label: 'Design',
    items: ['Figma', 'Photoshop', 'Illustrator', 'Canva', 'Premiere Pro', 'After Effects'],
  },
  {
    label: 'Tools & Platforms',
    items: [
      'Git',
      'GitHub',
      'VS Code',
      'Composer',
      'Node.js',
      'PHPUnit',
      'Laravel Pint',
      'XAMPP',
      'Apache',
      'InfinityFree',
      'Netlify',
      'Cloudflare',
      'ngrok',
      'Namecheap',
    ],
  },
  {
    label: 'AI',
    items: ['ChatGPT', 'Claude', 'Gemini', 'GitHub Copilot', 'Cursor', 'Cline', 'OpenCode', 'OpenRouter'],
  },
]

export const skills = [
  {
    name: 'Graphic Design',
    detail: 'Layout, composition, typography, and colour — building to a brief rather than to a template.',
  },
  {
    name: 'Video Editing',
    detail: 'Cutting for pace, tightening a story, and finishing a file that holds up when the client plays it back.',
  },
  {
    name: 'Computer Literacy',
    detail: 'Confident across operating systems, office tooling, file handling, and the unglamorous parts of the workflow.',
  },
  {
    name: 'Active Listening',
    detail: 'Reading what a client actually wants before I start making anything. It is the cheapest way to avoid rework.',
  },
]

/**
 * Add a project by appending to this list.
 *
 * `preview`   a screenshot, opened full-size in a lightbox by the VIEW button.
 * `previewAlt`  describe the screenshot for screen readers.
 * `href`      a live link. Leave null if there isn't one — projects that only
 *             run locally lean on `preview` instead.
 */
export const projects = [
  {
    title: 'This Portfolio',
    meta: ['Web', 'Vue · Tailwind CSS'],
    year: '2026',
    featured: true,
    description:
      'The page you are reading. A deliberate study in typography, spacing, and leaving things out - rebuilt from scratch with no UI library and no component kit. Smooth scrolling is left entirely to the browser; GSAP drives only the scroll-linked motion, and the reveal on the name, the progress rule, and the drifting section numbers are all hand-tuned.',
    href: null,
  },
  {
    title: 'Vegan Brew',
    meta: ['Point of Sale', 'PHP · MySQL · JavaScript'],
    year: '2025',
    description:
      'A point-of-sale system for a vegan coffee shop. Cashiers ring up orders on a counter screen; stock is decremented inside a database transaction and every movement is logged. Admins manage the catalogue, staff accounts, and date-ranged sales reports with charts and CSV export.',
    href: null,
    preview: '/vegan-brew.jpg',
    previewAlt:
      'The Vegan Brew landing page, showing a dark green hero reading “Experience the Art of Vegan Coffee” over a photograph of a café interior, with Explore Menu and Learn More buttons.',
    previewCaption: 'Vegan Brew — public landing page',
  },
  {
    title: 'SHS Enrollment System',
    meta: ['Enrollment System', 'PHP · MySQL'],
    year: '2026',
    description:
      'An enrollment system for a private senior high school, in plain PHP and MySQL. Applicants apply online, upload their requirements, and track the application by reference number as the registrar moves it through a five-stage pipeline with server-enforced gates. Cashiers assess fees with voucher deductions, take PayMongo or cash, and issue numbered receipts.',
    href: null,
    preview: '/Senior_High_School_Enrollment.jpg',
    previewAlt:
      'The SHS Enrollment System landing page. A navigation bar reads Home, Start Application, Track Application, Contact. Below it, a badge announces that applications for school year 2026-2027 are open, over a hero headed “Your Future Starts Here” with Start Application and Track Application buttons, a short note about applying online and using a reference number, and a row of three figures: 4 academic strands, 100% DepEd aligned, voucher subsidy accepted.',
    previewCaption: 'SHS Enrollment System — public landing page',
  },
  {
    title: 'IT Learning Hub',
    meta: ['Learning Platform', 'Laravel · MySQL'],
    year: '2026',
    description:
      'A self-hosted course platform for IT material, built on Laravel. Courses break into modules and lessons carrying text, code, PDF, and video; students work through them, sit the quiz at the end, and a certificate unlocks on completion. Free courses are open to anyone who enrolls, paid ones run through PayMongo.',
    href: null,
    preview: '/IT_Learning_Hub.jpg',
    previewAlt:
      'The IT Learning Hub landing page in dark mode. A globe mark and title sit above a theme toggle and menu button. The hero reads “Learn IT by building the skills the work asks for” over text about courses in information technology, programming, web development and cybersecurity, with Browse courses and Sign in buttons, and a row of four figures: 2 free courses, 3 paid courses, 62 lessons, and 17 quizzes. Course cards continue below.',
    previewCaption: 'IT Learning Hub — public landing page',
  },
  {
    title: 'Komiks',
    meta: ['Online Comic Store', 'UI/UX Design · Figma'],
    year: '2026',
    description:
      'A UI/UX design for an online comic store, laid out in Figma rather than in code — the stage where a change to the layout costs a drag instead of a rebuild. The file is public, so the screens can be opened and looked at directly rather than taken on trust.',
    // A live public link, so the row gets the external affordance rather than a
    // screenshot lightbox. The `t=` share-tracking parameter is dropped;
    // `node-id` is kept so the link lands on the frame. The Figma file name is
    // "GARMINO-BAUTISTA-LAB-1" — the link has to match it, the title need not.
    href: 'https://www.figma.com/design/d6zsqxJEd2p68LhrSq8wkR/GARMINO-BAUTISTA-LAB-1?node-id=1-2',
  },
  {
    title: 'GoPeso',
    meta: ['Online Banking App', 'UI/UX Design · Figma'],
    year: '2026',
    description:
      'A UI/UX design for an online banking mobile app, worked out in Figma rather than in code. On a phone-sized screen the argument for designing first is at its strongest: reordering a flow costs a drag, where afterwards it costs a rewrite. The file is public, so the screens can be opened and looked at directly.',
    // As above: `t=` is Figma's share-tracking token and is dropped, and the
    // file name is "BAUTISTA_JAYZEE_BSIT31A1" — the link has to match it, the
    // title need not.
    href: 'https://www.figma.com/design/0qxjUMFrh0Q5LgU9KEBrvC/BAUTISTA_JAYZEE_BSIT31A1?node-id=0-1',
  },
]

export const contact = {
  heading: 'Let’s work together.',
  lead: 'Open to entry-level IT roles, freelance design and video work, or anything that involves a deadline and a problem worth solving.',
  details: [
    { label: 'Email', value: profile.email, href: `mailto:${profile.email}` },
    { label: 'Based in', value: 'Gen. Mariano Alvarez, Cavite', href: null },
  ],
}

/**
 * Preset questions for the chat widget.
 *
 * There is no language model behind this — it is a fixed list, and every
 * answer below is written from the data further up this file. If you change a
 * fact here, change it in the answer too.
 */
export const chat = [
  {
    id: 'who',
    chip: 'Who are you?',
    answer:
      "I'm Jayzee G. Bautista — an Information Technology student at the National College of Science and Technology in Dasmariñas, Cavite. I work across programming, graphic design, and problem-solving, and I'm working toward an entry-level IT role.",
  },
  {
    id: 'skills',
    chip: 'My Skills',
    answer:
      "Four things I trained on first: graphic design, video editing, computer literacy, and active listening. The design and video side came from four years of freelance client work, and it still runs — the Figma work on Komiks and GoPeso is the same instinct turned on interfaces. I've since been building full-stack web systems on top of them: plain PHP and MySQL for the enrollment and point-of-sale work, and Laravel for the learning platform.",
  },
  {
    id: 'stack',
    chip: 'Tech Stack',
    answer:
      "Mostly PHP and JavaScript. On the front end that means Vue and Tailwind, with GSAP for scroll-linked motion. On the back end it's plain PHP and MySQL for the enrollment and point-of-sale work, and Laravel for the learning platform. For design it's Figma, alongside Photoshop, Illustrator and Canva. I work in VS Code with Git and GitHub, host on Netlify and InfinityFree behind Cloudflare, and I've been building with AI tools throughout — ChatGPT, Claude, Gemini, GitHub Copilot, Cursor, Cline and OpenCode.",
  },
  {
    id: 'experience',
    chip: 'Experience',
    answer:
      'From 2016 to 2022 I worked freelance as a graphic designer and video editor, mostly through Fiverr and Upwork. I built designs to client briefs, edited video to spec, and communicated by message to hit deadlines without the quality slipping.',
  },
  {
    id: 'projects',
    chip: 'My Projects',
    answer:
      'Six so far. This portfolio — the page you are reading — is Vue and Tailwind CSS, with GSAP for the scroll-linked motion and the smooth scrolling written by hand. Vegan Brew is a point-of-sale system for a vegan coffee shop, in plain PHP and MySQL. The SHS Enrollment System carries applicants through review, assessment, and fee collection for a private high school, and IT Learning Hub is a Laravel platform with lessons, quizzes, and certificates. The other two are UI/UX design rather than code: Komiks, an online comic store, and GoPeso, an online banking mobile app. Both Figma files are public, so you can open them.',
  },
  {
    id: 'contact',
    chip: 'Contact Me',
    answer:
      "Email is easiest — jayzeegbautista@gmail.com, and I reply to it fastest. I am in Gen. Mariano Alvarez, Cavite. I'm also on Instagram as @jayzbau, GitHub as bautistajayzee, and LinkedIn as jayzeegbautista, and there is a one-page resume you can view or download in the Resume section above.",
  },
  {
    id: 'now',
    chip: 'What time is it?',
    /*
      A function, not a string. `ChatWidget` calls it at the moment the chip is
      pressed, so the answer cannot go stale — the clock in the panel header and
      the clock in this answer are read from the same instant.
    */
    answer: () => {
      const now = new Date()

      return `It is ${formatSpokenTime(now)} in Manila — ${formatSpokenDate(now)}, my timezone. Cavite is Philippine Standard Time, UTC+8, with no daylight saving, so there is no seasonal shift to plan around. If you are converting it to your own time, email me and I'll work around your hours.`
    },
  },
]
