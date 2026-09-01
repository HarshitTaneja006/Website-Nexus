import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const day = 24 * 60 * 60 * 1000
const now = Date.now()
const DEFAULT_POSTER_BASE = 'https://placehold.co/800x1000/07111f/60a5fa?text='
const DEFAULT_GENERIC_POSTER_URL = `${DEFAULT_POSTER_BASE}EVENT+POSTER`
const posterUrlFor = (title: string) =>
  `${DEFAULT_POSTER_BASE}${encodeURIComponent(title.trim().toUpperCase()).replace(/%20/g, '+')}`

const events = [
  {
    slug: 'v-medithon-25',
    title: 'V-Medithon 25',
    description: '',
    category: 'HACKATHON',
    venue: 'Kamaraj Auditorium',
    startsAt: new Date('2025-09-02'),
    endsAt: new Date('2025-09-03'),
    tags: 'hackathon',
    featured: true,
    posterUrl: null,
    registrationLink: null,
  },
  {
    slug: 'nexus-forum-25',
    title: 'Nexus Forum',
    description: '',
    category: 'PODCAST',
    venue: 'MG Auditorium',
    startsAt: new Date('2025-09-19'),
    endsAt: null,
    tags: 'podcast,community',
    featured: false,
    posterUrl: null,
    registrationLink: null,
  },
  {
    slug: 'introduction-to-machine-learning',
    title: 'Introduction To Machine Learning',
    description: '',
    category: 'WORKSHOP',
    venue: 'Online',
    startsAt: new Date('2025-06-22'),
    endsAt: null,
    tags: 'machine-learning,ai',
    featured: false,
    posterUrl: null,
    registrationLink: null,
  },
  {
    slug: 'Introduction to Deep Learning',
    title: 'Introduction to Deep Learning',
    description: '',
    category: 'WORKSHOP',
    venue: 'Online',
    startsAt: new Date('2025-06-24'),
    endsAt: null,
    tags: 'deep-learning,ai',
    featured: false,
    posterUrl: null,
    registrationLink: null,
  },
  {
    slug: 'code-nexus',
    title: 'Code Nexus',
    description: 'FULLSTACK DEVELOPMENT WORKSHOP',
    category: 'WORKSHOP',
    venue: 'Kamaraj Auditorium',
    startsAt: new Date('2025-08-01'),
    endsAt: null,
    tags: 'fullstack,development,workshop',
    featured: false,
    posterUrl: null,
    registrationLink: null,
  },
  {
    slug: 'decode-x',
    title: 'Decode X',
    description: '',
    category: 'COMPETITION',
    venue: 'AB3 - 501',
    startsAt: new Date('2025-10-31'),
    endsAt: null,
    tags: 'competition',
    featured: false,
    posterUrl: null,
    registrationLink: null,
  },
]

async function main() {
  for (const e of events) {
    await db.event.upsert({
      where: { slug: e.slug },
      update: {
        posterUrl: e.posterUrl ?? posterUrlFor(e.title),
        registrationLink: e.registrationLink ?? null,
      },
      create: {
        ...e,
        posterUrl: e.posterUrl ?? posterUrlFor(e.title),
      },
    })
  }

  // Backfill events created outside this seed, and replace the old generic
  // placeholder, so every event gets a title-specific poster URL.
  const eventsNeedingPosters = await db.event.findMany({
    where: { OR: [{ posterUrl: null }, { posterUrl: DEFAULT_GENERIC_POSTER_URL }] },
    select: { id: true, title: true },
  })
  for (const event of eventsNeedingPosters) {
    await db.event.update({ where: { id: event.id }, data: { posterUrl: posterUrlFor(event.title) } })
  }

  // apply run-of-show schedules (single source of truth: seed-schedules.ts)
  const { schedules } = await import('./seed-schedules')
  for (const [slug, schedule] of Object.entries(schedules)) {
    await db.event.updateMany({ where: { slug }, data: { schedule: JSON.stringify(schedule) } })
  }

  const count = await db.event.count()
  console.log(`seeded events (with schedules), total: ${count}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
