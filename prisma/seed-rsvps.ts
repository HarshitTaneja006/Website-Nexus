import { PrismaClient } from '@prisma/client'

/**
 * Seed lively RSVP + subscriber data so the ops ledger / wire counters look
 * alive in demos. Idempotent-ish: RSVPs are unique per (event,email), and the
 * subscriber emails are clearly demo-only. Run: bun prisma/seed-rsvps.ts
 */
const db = new PrismaClient()

const people = [
  ['Aarav Menon', 'aarav.menon@vitstudent.ac.in'],
  ['Diya Sharma', 'diya.sharma@vitstudent.ac.in'],
  ['Ishaan Iyer', 'ishaan.iyer@vitstudent.ac.in'],
  ['Meera Krishnan', 'meera.krishnan@vitstudent.ac.in'],
  ['Rohan Patel', 'rohan.patel@vitstudent.ac.in'],
  ['Sneha Rao', 'sneha.rao@vitstudent.ac.in'],
  ['Vikram Nair', 'vikram.nair@vitstudent.ac.in'],
  ['Ananya Bose', 'ananya.bose@vitstudent.ac.in'],
  ['Karthik Subramanian', 'karthik.s@vitstudent.ac.in'],
  ['Zoya Fernandes', 'zoya.f@vitstudent.ac.in'],
  ['Aditya Verma', 'aditya.verma@vitstudent.ac.in'],
  ['Nithya Raman', 'nithya.raman@vitstudent.ac.in'],
]

async function main() {
  const events = await db.event.findMany({ select: { id: true, slug: true, startsAt: true }, orderBy: { startsAt: 'asc' } })
  if (events.length === 0) throw new Error('no events - run the main seed first')

  let added = 0
  // spread people across events deterministically (i*7 modulo spreading)
  for (let i = 0; i < people.length; i++) {
    const [name, email] = people[i]
    const ev = events[(i * 7) % events.length]
    const r = await db.rsvp.upsert({
      where: { eventId_email: { eventId: ev.id, email } },
      update: {},
      create: { eventId: ev.id, name, email },
    })
    added++
    void r
  }

  const subs = [
    'linus.t@vitstudent.ac.in',
    'ada.lovelace@vitstudent.ac.in',
    'grace.hopper@vitstudent.ac.in',
    'alan.turing@vitstudent.ac.in',
    'margaret.h@vitstudent.ac.in',
  ]
  for (const email of subs) {
    await db.subscriber.upsert({ where: { email }, update: {}, create: { email } })
  }

  const totals = await Promise.all([db.rsvp.count(), db.subscriber.count()])
  console.log(`rsvps seeded: ${added} (total ${totals[0]}), subscribers total ${totals[1]}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
