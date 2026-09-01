import { PrismaClient } from '@prisma/client'

/**
 * Backfills run-of-show schedules (JSON) for every event.
 * Idempotent: sets `schedule` on every event by slug every run.
 * Run: bun prisma/seed-schedules.ts
 */
const db = new PrismaClient()

export const schedules: Record<string, Array<{ time: string; title: string; detail?: string }>> = {
  'nexus-hack-5.0': [
    { time: 'DAY 0 · 18:00', title: 'Team check-in + cloud access', detail: 'ID badges issued, compute cluster credentials & AI credits activated.' },
    { time: 'DAY 1 · 09:00', title: 'Opening ceremony', detail: 'Keynote from faculty advisors + problem statements revealed live.' },
    { time: 'DAY 1 · 10:30', title: 'Hacking begins', detail: '36 hours on the clock. Architecture and code review desk open continuously.' },
    { time: 'DAY 1 · 14:00', title: 'Workshop: ship-first git', detail: 'Optional crash session — branches, PRs and demo-driven commits.' },
    { time: 'DAY 1 · 22:00', title: 'Midnight chai + bug hunt', detail: 'Caffeine protocol active. Fun mini-prize for the cleanest API design.' },
    { time: 'DAY 2 · 09:00', title: 'Checkpoint reviews', detail: 'Each team gets a 5-min mentor walkthrough — blockers destroyed.' },
    { time: 'DAY 2 · 18:00', title: 'Code freeze + demos', detail: '3 minutes per team in front of the industry jury. Demo or it didn\'t happen.' },
    { time: 'DAY 2 · 21:30', title: 'Awards + closing', detail: '₹1L prize pool, category awards, NEXUS core announcements.' },
  ],
  'intro-to-transformers': [
    { time: '17:30', title: 'Doors + env check', detail: 'Confirm your Python venv + PyTorch install before we start.' },
    { time: '17:45', title: 'Attention, intuitively', detail: 'Queries, keys and values — built up from a dictionary analogy.' },
    { time: '18:20', title: 'Code-along: mini-GPT', detail: '200 lines from tokenizer to training loop. Follow at your own pace.' },
    { time: '19:10', title: 'Positional encoding lab', detail: 'Why order matters — sinusoidal vs learned, visualized.' },
    { time: '19:45', title: 'Show your loss curve', detail: 'Lightning demos from attendees + wrap-up resources.' },
  ],
  'cloud-native-sunday': [
    { time: '10:00', title: 'Coffee + cluster warm-up', detail: 'kind/minikube up and running on every laptop.' },
    { time: '10:30', title: 'Pods, deployments, services', detail: 'Deploy a tiny API, then deliberately break it in three ways.' },
    { time: '11:45', title: 'ConfigMaps + secrets', detail: 'Twelve-factor the right way — no more hard-coded env vars.' },
    { time: '12:30', title: 'Chaos round', detail: 'Kill pods on purpose, watch self-healing do its thing.' },
  ],
  'fullstack-showdown': [
    { time: '19:00', title: 'Architecture spec reveal', detail: 'API contract, schema requirements + benchmark criteria announced.' },
    { time: '19:15', title: 'Sprint start', detail: '4 hours on the clock. Build frontend UI, backend services and live sockets.' },
    { time: '22:00', title: 'Load test checkpoint', detail: 'Automated test suite fires 500 req/s at each team\'s endpoints.' },
    { time: '23:30', title: 'Live demo showdown', detail: 'Teams present their working products live on screen.' },
  ],
  'android-from-zero': [
    { time: '18:00', title: 'Compose state of mind', detail: 'Composable functions, recomposition and state hoisting.' },
    { time: '18:40', title: 'Build: task tracker app', detail: 'List, add, complete — your first full Compose screen.' },
    { time: '19:30', title: 'Material 3 polish pass', detail: 'Theming, dark palette and motion defaults in 10 minutes.' },
    { time: '20:00', title: 'Ship it (sideload)', detail: 'APK build + install on your own phone.' },
  ],
  'founders-firechat': [
    { time: '17:00', title: 'Arrivals + informal networking', detail: 'Chai, coffee and founder bingo (yes, really).' },
    { time: '17:30', title: 'Panel: after the demo day', detail: 'Funding realities, first hires, and shipping for a billion users.' },
    { time: '18:15', title: 'Open Q&A', detail: 'Ask anything — cap-table math to cold emails.' },
    { time: '18:50', title: 'Hallway track', detail: 'Stick around; most value happens off-stage.' },
  ],
  'open-source-sprint': [
    { time: 'DAY 1 · 09:00', title: 'Issue triage & scoping', detail: 'Teams select open source issues, set up dev environments & fork repos.' },
    { time: 'DAY 2 · 10:00', title: 'Core implementation & tests', detail: 'Write implementations, run test suites and benchmark performance.' },
    { time: 'DAY 3 · 14:00', title: 'PR reviews & upstream submission', detail: 'Senior maintainers review PRs; live merge celebration.' },
  ],
}

async function main() {
  let updated = 0
  for (const [slug, schedule] of Object.entries(schedules)) {
    const res = await db.event.updateMany({
      where: { slug },
      data: { schedule: JSON.stringify(schedule) },
    })
    updated += res.count
  }
  console.log(`schedules backfilled on ${updated} events`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
