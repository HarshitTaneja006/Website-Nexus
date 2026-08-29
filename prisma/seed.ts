import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const day = 24 * 60 * 60 * 1000
const now = Date.now()

const events = [
  {
    slug: 'nexus-hack-5.0',
    title: 'NEXUS HACK 5.0',
    description:
      'Our flagship 36-hour hackathon. 200+ builders, real industry problem statements, hardware lab access, and a prize pool worth ₹1L. Ships demo or it didn\'t happen.',
    category: 'HACKATHON',
    venue: 'Tech Park Auditorium, VIT Chennai',
    startsAt: new Date(now + 12 * day),
    endsAt: new Date(now + 13 * day + 12 * 60 * 60 * 1000),
    tags: 'hackathon,fullstack,hardware,48h',
    featured: true,
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
  },
  {
    slug: 'cyber-night-ctf',
    title: 'CyberNight CTF',
    description:
      'Jeopardy-style capture the flag. Web, crypto, forensics and rev — beginner friendly boxes alongside sweaty ones. Teams of up to 3.',
    category: 'COMPETITION',
    venue: 'Security Lab + Online',
    startsAt: new Date(now + 20 * day + 19 * 60 * 60 * 1000),
    tags: 'cybersecurity,ctf,linux',
    featured: false,
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
  },
  {
    slug: 'rover-build-sprint',
    title: 'Rover Build Sprint',
    description:
      'Three days, one autonomous rover. Chassis, vision, and a line-following finale on the campus track.',
    category: 'BUILD',
    venue: 'Robotics Bay',
    startsAt: new Date(now - 30 * day),
    endsAt: new Date(now - 27 * day),
    tags: 'robotics,embedded,cv',
    featured: false,
  },
]

async function main() {
  for (const e of events) {
    await db.event.upsert({
      where: { slug: e.slug },
      update: {},
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
