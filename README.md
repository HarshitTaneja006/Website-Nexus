# NEXUS - Terminal & Club Operations Hub

<div align="center">

```
 _   _ _______  ___   _ ____  
| \ | | ____\ \/ / | | / ___| 
|  \| |  _|  \  /| | | \___ \ 
| |\  | |___ /  \| |_| |___) |
|_| \_|_____/_/\_\\___/|____/ 
```

**High-performance cyberpunk operations portal and showcase for student tech collectives and hackathons.**

[![Next.js 15](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.x-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Supabase PostgreSQL](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Bun Runtime](https://img.shields.io/badge/Bun-1.3-FBF0DF?style=for-the-badge&logo=bun&logoColor=black)](https://bun.sh/)

[Features](#-key-features) • [Architecture](#-core-architecture--tech-stack) • [Database & RSVP](#-database-schema--rsvp-lifecycle) • [Workflows](#-system-workflows--api-reference) • [Supabase & RLS](#-supabase--row-level-security-rls) • [Quickstart](#-getting-started) • [Deployment](#-deployment-guide)

---

</div>

## ⚡ Project Overview

**NEXUS** is an operations hub designed for student developer collectives, tech clubs, and hackathon organizers. Built around a terminal/HUD aesthetic, NEXUS pairs visual experiences with backend services for event management, attendee RSVPs, recruitment pipelines, and real-time community engagement.

### 🌟 Key Features

- 📟 **Terminal HUD & Boot Sequence**: Immersive CRT/scanline visual presentation with retro boot loader, sound toggles, and interactive command palette (`Cmd+K` / `Ctrl+K`).
- 🎟️ **Real-Time Event RSVPs & Ticket Passes**: Live seat counts, RFC 5322 email validation, automated duplicate suppression, and instant self-service pass lookups.
- 🎨 **ASCII Visual Renderers & Glyph Foundry**: Real-time ASCII webcam stream, custom canvas rasterizers, and text-to-ASCII banner generators.
- 📅 **Subscribable Calendar & Feeds**: Live RFC 5545 `.ics` dynamic iCalendar feeds for Google/Apple Calendar synchronization and RSS 2.0 XML updates.
- 🛡️ **Operator Admin Console**: Secured endpoint review dashboard with constant-time cryptographic verification (`x-admin-key` authentication) for recruit application triaging.
- 🖼️ **Dynamic Social Cards (@vercel/og)**: Edge-rendered Open Graph metadata images built dynamically per transmit.

---

## 🏗️ Core Architecture & Tech Stack

```
                                  ┌────────────────────────┐
                                  │   Client / Browser     │
                                  │  (React 19 + Radix UI) │
                                  └───────────┬────────────┘
                                              │
                         ┌────────────────────┼────────────────────┐
                         │ HTTP Requests      │ Supabase SSR Cookie│
                         ▼                    ▼                    ▼
               ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
               │ Next.js App Router│ │ Next.js Middleware│ │ Dynamic Edge OG   │
               │   API Handlers    │ │  Session Refresh  │ │    (/api/og)      │
               └─────────┬─────────┘ └─────────┬─────────┘ └───────────────────┘
                         │                     │
                         ├─────────────────────┘
                         ▼
        ┌────────────────────────────────────────────────────────┐
        │            Prisma ORM Database Client                  │
        │        (Connection pooling & type-safe queries)        │
        └────────────────────────┬───────────────────────────────┘
                                 ▼
        ┌────────────────────────────────────────────────────────┐
        │              Supabase PostgreSQL Engine                │
        │          Row Level Security (RLS) & Triggers           │
        └────────────────────────────────────────────────────────┘
```

### 🧩 Technology Matrix

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Framework** | [Next.js 15 (App Router)](https://nextjs.org/) | Server Components, Edge/Dynamic Route Handlers, SSR layouts |
| **UI Library** | [React 19](https://react.dev/) | Client state, streaming transitions, concurrent rendering |
| **Database** | [Supabase PostgreSQL](https://supabase.com/) | Managed cloud PostgreSQL relational persistence |
| **ORM** | [Prisma ORM v6](https://www.prisma.io/) | Schema definition, migration engine, and type-safe query builder |
| **Auth & Sessions** | [`@supabase/ssr`](https://supabase.com/docs/guides/auth/server-side-rendering) | Cookie-based session validation & Next.js edge middleware |
| **Styling & Icons** | [Tailwind CSS 4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) | Cyberpunk tokens, HUD dialogs, Lucide icon system |
| **Typography & ASCII**| Figlet & Monospace fonts | Custom ASCII banners, canvas bitmap conversion, matrix rain |
| **Runtime & Tooling** | [Bun](https://bun.sh/) / Node.js 20+ | Ultra-fast package management, script execution, bundling |

---

## 🗄️ Database Schema & RSVP Lifecycle

The persistence layer is defined via Prisma in [`prisma/schema.prisma`](file:///c:/Users/harsh/Downloads/Website-Nexus/prisma/schema.prisma) and deployed onto Supabase PostgreSQL.

### 📊 Entity Relationship Diagram

```mermaid
erDiagram
    EVENT ||--o{ RSVP : "receives"
    EVENT {
        string id PK "cuid()"
        string slug UK "unique URL slug"
        string title "Event title"
        string description "Event overview"
        string category "HACKATHON | WORKSHOP | TALK"
        string venue "Physical / Virtual location"
        datetime startsAt "Start timestamp"
        datetime endsAt "Nullable end timestamp"
        string tags "Comma-separated search tags"
        boolean featured "Featured highlight flag"
        string schedule "JSON Run-of-Show timeline"
        datetime createdAt "Creation timestamp"
        datetime updatedAt "Auto-updated timestamp"
    }

    RSVP {
        string id PK "cuid()"
        string eventId FK "References Event.id (Cascade)"
        string name "Attendee full name"
        string email "Attendee email"
        datetime createdAt "RSVP timestamp"
    }

    JOIN_REQUEST {
        string id PK "cuid()"
        string name "Applicant name"
        string email "Applicant email"
        string branch "Academic branch"
        string year "Academic year"
        string interest "Domain / Subsystem interest"
        string message "Nullable statement / cover note"
        string status "pending | approved | rejected"
        datetime reviewedAt "Nullable review timestamp"
        datetime createdAt "Submission timestamp"
    }

    SUBSCRIBER {
        string id PK "cuid()"
        string email UK "Subscriber email"
        string source "footer | modal | banner"
        datetime createdAt "Subscription timestamp"
    }
```

---

### 🎟️ The RSVP Lifecycle Flow

The RSVP engine enforces strict validation, idempotency, and immediate synchronization across calendar exports and attendee lookups.

```mermaid
sequenceDiagram
    autonumber
    actor Attendee as User / Terminal HUD
    participant API as POST /api/events/[id]/rsvp
    participant DB as Supabase PostgreSQL
    participant Lookup as GET /api/rsvp-lookup
    participant Feed as GET /api/calendar.ics

    Attendee->>API: Submit RSVP (id/slug, name, email)
    Note over API: 1. Sanitize control chars<br/>2. Validate RFC 5322 format<br/>3. Verify name & email length
    API->>DB: Query Event (by ID or Slug)
    alt Event Not Found
        DB-->>API: null
        API-->>Attendee: 404 Not Found {"error": "Event not found"}
    else Event Found
        DB-->>API: Event record
        Note over API: 4. Check event lock status (past events rejected)
        API->>DB: db.rsvp.upsert({ where: { eventId_email }, create, update })
        DB-->>API: RSVP Record created/updated
        API->>DB: db.rsvp.count({ where: { eventId } })
        DB-->>API: Total RSVP count
        API-->>Attendee: 200 OK {"ok": true, "rsvpCount": N}
    end

    opt Attendee Pass Verification
        Attendee->>Lookup: GET /api/rsvp-lookup?email=user@domain.com
        Lookup->>DB: Find RSVPs with Event metadata (sanitized, no PII leak)
        DB-->>Lookup: List of registered events
        Lookup-->>Attendee: Return ticket records & event passes
    end

    opt Calendar Subscription
        Attendee->>Feed: Subscribe /api/calendar.ics
        Feed->>DB: Fetch upcoming events
        DB-->>Feed: Event list
        Feed-->>Attendee: RFC 5545 VCALENDAR feed with live updates
    end
```

#### Step-by-Step Breakdown

1. **Client Submission**: The user selects an event from the radar/timeline HUD and submits their name and email.
2. **Sanitization & RFC 5322 Validation**:
   - Strips non-printable ASCII/control characters (`[\x00-\x1F\x7F]`).
   - Normalizes email strings to lowercase.
   - Enforces RFC 5322 standard regex validation and string constraints (name: 2–80 chars, email: max 254 chars).
3. **Identifier Resolution**: Supports querying by either immutable `cuid` or human-readable `slug`.
4. **Idempotent Upsert & Double-Booking Prevention**:
   - Leverages Prisma's composite unique constraint:
     ```prisma
     @@unique([eventId, email])
     ```
   - Automatically handles repeat registrations gracefully without duplicate database rows or primary key violations.
5. **Dynamic Calendar Synchronization**:
   - Once RSVP'd, events can be downloaded as individual ICS files or subscribed to globally via `/api/calendar.ics`.
6. **Self-Service RSVP Pass Retrieval**:
   - Users can query `/api/rsvp-lookup?email=user@domain.com` at any time to recover their registered event ledger without exposing other attendees' PII.

---

## 📡 System Workflows & API Reference

### 1. Club Recruitment & Member Ingestion
- **`POST /api/join`**:
  - Validates applicant name, university email, branch, year, interest cluster, and optional statement.
  - Automatically suppresses duplicate spam by detecting existing pending applications for the same email.
- **`PATCH /api/admin/join-requests`**:
  - Moves applications through the review pipeline (`pending` -> `approved` / `rejected`).
  - Protected with **constant-time SHA-256 header authentication** (`x-admin-key` or `Authorization: Bearer <token>`) using `crypto.timingSafeEqual` to prevent side-channel timing attacks.
  - Fails closed in production if admin secrets are absent.
- **`GET /api/admin/stats`**:
  - Aggregates operational telemetry (total events, total RSVPs, pending applications, active newsletter wire subscribers).

### 2. Newsletter & Transmission Wire
- **`POST /api/newsletter`**:
  - Idempotently registers subscriber email with default `"footer"` source.
- **`DELETE /api/newsletter?email=<address>`**:
  - Instant one-click unsubscribe mechanism.

### 3. Live Syndication & Feeds
- **`GET /api/calendar.ics`**:
  - Dynamic RFC 5545 iCalendar feed generator (`text/calendar`).
  - Automatically compiles event schedules, locations, and descriptions for native integration into Apple Calendar, Google Calendar, and Outlook.
- **`GET /api/feed.xml`**:
  - Dynamic RSS 2.0 XML syndicate feed (`application/rss+xml`) containing recent announcements, hackathons, and community dispatches.

### 4. Edge-Rendered Dynamic Social Cards
- **`GET /api/og`**:
  - Built with `@vercel/og` running on the Edge runtime.
  - Generates custom branded 1200x630 Open Graph preview banners featuring dynamic event titles, venue metadata, and retro ASCII borders.

---

## 🛡️ Supabase & Row Level Security (RLS)

NEXUS combines **Prisma ORM** for server-side transactional workflows with **Supabase SSR** for cookie authentication and client sessions.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE POSTGRESQL LAYER                       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌────────────────────────┐              ┌────────────────────────┐   │
│   │   Prisma ORM Engine    │              │  Supabase Client / SSR │   │
│   │ (Direct Connection /   │              │   (Browser & Server    │   │
│   │  Bypasses RLS via      │              │    Components under    │   │
│   │  postgres connection)  │              │    Public Anon / Auth) │   │
│   └───────────┬────────────┘              └───────────┬────────────┘   │
│               │                                       │                │
│               │ Full Read/Write Access                │ Subject to     │
│               │ for Verified Next.js API Routes       │ RLS Policies   │
│               ▼                                       ▼                │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                     PostgreSQL Tables                          │   │
│   │   [Event]       [Rsvp]       [JoinRequest]      [Subscriber]   │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Recommended Supabase RLS Policies

When exposing Postgres tables directly via PostgREST or Supabase Realtime, enforce the following security policies in the Supabase SQL editor:

```sql
-- 1. Enable RLS across all tables
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Rsvp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JoinRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscriber" ENABLE ROW LEVEL SECURITY;

-- 2. Events: Public read-only access
CREATE POLICY "Public events are viewable by everyone" 
ON "Event" FOR SELECT 
USING (true);

-- 3. RSVPs: Public can insert their own RSVPs; only privileged roles can view all
CREATE POLICY "Anyone can create an RSVP" 
ON "Rsvp" FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Attendees can view their own RSVPs" 
ON "Rsvp" FOR SELECT 
USING (auth.jwt() ->> 'email' = email);

-- 4. Join Requests: Public can submit; authenticated operators can manage
CREATE POLICY "Anyone can submit a join request" 
ON "JoinRequest" FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view and review join requests" 
ON "JoinRequest" FOR ALL 
TO authenticated 
USING (auth.jwt() ->> 'role' = 'admin');

-- 5. Newsletter Subscribers: Public insert/delete; private listings
CREATE POLICY "Anyone can subscribe to the newsletter" 
ON "Subscriber" FOR INSERT 
WITH CHECK (true);
```

---

## 🔐 Environment Variables

Create a `.env.local` or `.env` file in the root directory. You can duplicate `.env.example`:

```bash
cp .env.example .env.local
```

### Configuration Keys

| Variable | Required | Default / Format | Description |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@host:5432/db?schema=public` | PostgreSQL connection string (Supabase Transaction / Session pooler or direct instance). |
| `ADMIN_SECRET` | **Yes** | Any high-entropy string (e.g. `openssl rand -hex 32`) | Secret key used by the operations HUD and admin API routes to authorize reviews and stats. |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | `https://xyzcompany.supabase.co` | Public Supabase project API gateway endpoint. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Yes** | `eyJhbGciOi...` | Supabase public anonymous / publishable client key for SSR cookie validation. |
| `NEXT_PUBLIC_SITE_URL` | No | `https://nexus.yourdomain.com` | Base site URL for generating canonical RSS feeds and calendar subscription links. |

---

## 🚀 Getting Started

Ensure you have [Bun](https://bun.sh/) (v1.1+) or Node.js (v20+) installed.

### 1. Clone & Install

```bash
git clone https://github.com/HarshitTaneja006/Website-Nexus.git
cd Website-Nexus
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Populate DATABASE_URL, ADMIN_SECRET, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

### 3. Synchronize Database Schema

Push the Prisma models directly to your Supabase PostgreSQL instance:

```bash
bun x prisma db push
```

*(Optional)* Generate Prisma client artifacts:

```bash
bun x prisma generate
```

### 4. Seed Development Data

Seed the database with flagship events, detailed schedules, sample RSVPs, and subscribers:

```bash
# Seed core events and run-of-show schedules
bun run prisma/seed.ts

# Seed realistic RSVP attendees and subscriber counts
bun run prisma/seed-rsvps.ts
```

### 5. Launch Development Server

```bash
bun dev
```

Visit [`http://localhost:3000`](http://localhost:3000) in your browser to explore the NEXUS HUD.

---

## 🛠️ CLI & Operational Commands

| Command | Action | Description |
| :--- | :--- | :--- |
| `bun dev` | `next dev -p 3000` | Starts the Next.js development server with hot-module reloading. |
| `bun run build` | `next build ...` | Generates the optimized standalone production build and asset bundles. |
| `bun start` | `next start` | Starts the production server. |
| `bun run lint` | `eslint .` | Runs ESLint 9 checks across all TypeScript and React files. |
| `bun x prisma db push` | `prisma db push` | Synchronizes the Prisma schema with the live PostgreSQL database. |
| `bun x prisma studio` | `prisma studio` | Opens the local visual GUI database browser on port 5555. |
| `bun run prisma/seed.ts` | TypeScript script | Populates events, workshops, hackathons, and timeline schedules. |

---

## 🚢 Deployment Guide

### Deploying to Vercel with Supabase

1. **Set Up Supabase PostgreSQL Database**:
   - Create a project on [Supabase](https://supabase.com/).
   - Copy the **Connection URI** from *Project Settings -> Database* (use the Transaction pooler on port 6543 for serverless environments or Session pooler on port 5432).
   - Copy the **Project URL** and **Publishable Key** from *Project Settings -> API*.

2. **Push Schema & Run Seeds**:
   ```bash
   DATABASE_URL="your-supabase-connection-string" bun x prisma db push
   DATABASE_URL="your-supabase-connection-string" bun run prisma/seed.ts
   ```

3. **Deploy to Vercel**:
   - Push your repository to GitHub.
   - Import the project into the [Vercel Dashboard](https://vercel.com/new).
   - In **Project Settings -> Environment Variables**, configure:
     - `DATABASE_URL`: Your Supabase PostgreSQL connection string.
     - `ADMIN_SECRET`: A generated high-entropy secret string.
     - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase URL.
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Your Supabase publishable key.
     - `NEXT_PUBLIC_SITE_URL`: Your production Vercel URL (e.g. `https://nexus.vercel.app`).
   - Leave the build command as default (`next build`) or custom if using standalone output.

4. **Verify Deployment**:
   - Test event RSVP submissions.
   - Verify `/api/calendar.ics` and `/api/feed.xml`.
   - Access the operator console with your configured `ADMIN_SECRET`.

---

## 📜 License

Engineered with ⚡ by **[Harshit Taneja](https://github.com/HarshitTaneja006)**. Distributed under the MIT License.
