import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const day = 24 * 60 * 60 * 1000
const now = Date.now()

const events = [
  {
    slug: 'nexus-hack-5.0',
    title: 'NEXUS HACK 5.0',
    description:
      'Our flagship 36-hour hackathon. 200+ builders, real industry problem statements, cloud compute clusters & AI credits, and a prize pool worth ₹1L. Ships demo or it didn\'t happen.',
    category: 'HACKATHON',
    venue: 'Tech Park Auditorium, VIT Chennai',
    startsAt: new Date(now + 12 * day),
    endsAt: new Date(now + 13 * day + 12 * 60 * 60 * 1000),
    tags: 'hackathon,fullstack,cloud,ai',
    featured: true,
    posterUrl: 'https://placehold.co/800x1000/07111f/60a5fa?text=NEXUS+HACK+5.0',
    registrationLink: 'https://example.com/register/nexus-hack-5',
  },
  {
    slug: 'intro-to-transformers',
    title: 'Transformers, From Scratch',
    description:
      'A hands-on code-along: attention, positional encoding and a working mini-GPT in 200 lines of Python. Bring a laptop, leave with a trained model.',
    category: 'WORKSHOP',
    venue: 'AI Lab, CB Block',
    startsAt: new Date(now + 4 * day + 18 * 60 * 60 * 1000),
    tags: 'ai/ml,python,pytorch',
    featured: false,
    posterUrl: 'https://placehold.co/800x1000/07111f/60a5fa?text=TRANSFORMERS',
  },
  {
    slug: 'cloud-native-sunday',
    title: 'Cloud Native Sunday: K8s Playground',
    description:
      'Spin up a cluster, deploy a service, break it, fix it. A chill Sunday session for anyone curious about containers and orchestration.',
    category: 'WORKSHOP',
    venue: 'Cloud Lab, CD Block',
    startsAt: new Date(now + 9 * day + 10 * 60 * 60 * 1000),
    tags: 'cloud,docker,kubernetes',
    featured: false,
    posterUrl: 'https://placehold.co/800x1000/07111f/60a5fa?text=K8S+PLAYGROUND',
    registrationLink: 'https://example.com/register/cloud-native-sunday',
  },
  {
    slug: 'fullstack-showdown',
    title: 'Full-Stack DevShowdown',
    description:
      'Real-time frontend and backend speed build. 4 hours to architect, code and ship a full-stack product with live webhooks and websocket feeds.',
    category: 'COMPETITION',
    venue: 'Computing Lab 3 + Online',
    startsAt: new Date(now + 20 * day + 19 * 60 * 60 * 1000),
    tags: 'web,fullstack,typescript,realtime',
    featured: false,
    posterUrl: 'https://placehold.co/800x1000/07111f/60a5fa?text=DEV+SHOWDOWN',
  },
  {
    slug: 'android-from-zero',
    title: 'Android From Zero: Jetpack Compose',
    description:
      'Build and ship your first Android app in one evening. Compose fundamentals, state, and a splash of Material 3.',
    category: 'WORKSHOP',
    venue: 'Mobile Lab, CB Block',
    startsAt: new Date(now - 6 * day + 18 * 60 * 60 * 1000),
    tags: 'mobile,kotlin,compose',
    featured: false,
    posterUrl: 'https://placehold.co/800x1000/07111f/60a5fa?text=ANDROID+ZERO',
  },
  {
    slug: 'founders-firechat',
    title: 'Founders FireChat: Building in India',
    description:
      'Alumni founders on what actually happens after the demo day — funding, failure, and shipping for a billion users. Open Q&A.',
    category: 'TALK',
    venue: 'Seminar Hall A',
    startsAt: new Date(now - 15 * day + 17 * 60 * 60 * 1000),
    tags: 'startups,community,talk',
    featured: false,
    posterUrl: 'https://placehold.co/800x1000/07111f/60a5fa?text=FIRECHAT',
  },
  {
    slug: 'open-source-sprint',
    title: 'Open Source Ship Sprint',
    description:
      'Three days, open PRs, real impact. Building Rust/Go CLI utilities, optimizing open web libraries, and getting code merged into major repos.',
    category: 'BUILD',
    venue: 'Software Foundry Lab',
    startsAt: new Date(now - 30 * day),
    endsAt: new Date(now - 27 * day),
    tags: 'opensource,rust,devtools,cli',
    featured: false,
    posterUrl: 'https://placehold.co/800x1000/07111f/60a5fa?text=OPEN+SOURCE+SPRINT',
  },
]

async function main() {
  for (const e of events) {
    await db.event.upsert({
      where: { slug: e.slug },
      update: {
        posterUrl: e.posterUrl,
        registrationLink: e.registrationLink ?? null,
      },
      create: e,
    })
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
