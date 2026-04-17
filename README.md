# Phantom Defender

**The only privacy app that fights back.**

Phantom Defender is a privacy command center that creates disposable email aliases and burner phone numbers — then actively monitors, detects, and responds to privacy violations on your behalf. Unlike other alias services that just forward email, Phantom Defender strips trackers, catches data leaks, plants honeypot traps, automates GDPR deletion requests, and scores company privacy practices in real time.

Built with zero-knowledge encryption. We couldn't read your data even if we wanted to.

---

## At a glance

- **Zero-knowledge architecture** — AES-256-GCM client-side encryption, PBKDF2 with 600K iterations. Server stores encrypted blobs and never sees plaintext.
- **Full stack** — Next.js 14, Supabase (PostgreSQL + RLS), Stripe, Cloudflare Email Routing, Twilio, OpenAI `gpt-4o-mini`.
- **280 passing tests** across auth, payments, email routing, and encryption paths.
- **42 API routes**, 15 database tables, 20 Row Level Security policies.
- **Built solo** on a 3-agent CI pipeline: a feature-builder writes, a security-auditor reviews, a test-runner gates merges.
- **~99% gross margin** on the no-phone plan at the $9.99 price point (see Unit Economics below).

---

## Why Phantom Defender?

Every time you sign up for a service, you hand over your real email and phone number. Companies sell that data, track your every open, and leak it in breaches. Existing solutions like Apple's Hide My Email or SimpleLogin create aliases — but that's where they stop. They're pipes. They don't tell you what's happening on the other end.

Phantom Defender is different. The alias is just the delivery mechanism. The value is what flows through it:

- **Tracker Warfare** — Every spy pixel from Mailchimp, HubSpot, and Facebook is stripped before email reaches your inbox. See exactly which companies are tracking you, with real names and real numbers.
- **Leak Detection** — When Netflix sells your alias to a vitamin company, we catch it instantly and push an alert to your phone. Definitive proof of data selling.
- **Honeypot Traps** — Plant decoy aliases at services you don't trust. If the alias receives email, you have irrefutable evidence the company shared or sold your data.
- **GDPR Automation** — One tap sends a legally valid data deletion request to any company. Track the 30-day countdown. Escalate to FTC/DPA if they ignore you.
- **Privacy Scores** — Every company gets a crowdsourced privacy score based on real leak detection data, GDPR response times, and tracker behavior across all users.
- **Emergency Nuke** — One button kills every alias, releases every phone number, fires GDPR deletion requests to every labeled service, and soft-deletes your account. 30-day recovery window.
- **Privacy Autopilot** — Monthly scans identify stale aliases, spam-only addresses, and unused phone numbers. Reduce your digital footprint automatically.

---

## Features

### Free Tier
- 3 email aliases
- Tracker stripping on all emails
- Leak detection alerts
- Honeypot alias creation
- GDPR deletion requests
- Privacy score browsing
- Emergency nuke
- Data export (JSON/CSV)

### Pro Tier — $9.99/month
- 15 email aliases
- 1 burner phone number (receive-only, for OTPs and SMS)
- AI-powered email summaries
- Privacy autopilot scanning
- Priority support
- Everything in Free

### Add-ons (Pro users)
- Extra phone number: $2.99/month each
- Extra 10 email aliases: $1.99/month

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | Next.js API Routes on Vercel |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Encryption | Client-side AES-256-GCM, PBKDF2 key derivation (600K iterations) |
| Email | Cloudflare Email Routing (beta) → SimpleLogin on VPS (production) |
| Phone | Twilio (receive-only) |
| AI | OpenAI gpt-4o-mini for email classification + summaries |
| Payments | Stripe Checkout + Subscriptions |
| Auth | Username + master password (no email required) |

---

## Architecture

### Zero-Knowledge Encryption

Phantom Defender uses a zero-knowledge architecture. Your master password never leaves your device.

1. **Signup** — You pick a username and master password. The password is split locally into an auth key (sent to Supabase, hashed again before storage) and an encryption key (stays on device, never transmitted).
2. **Encryption** — Every piece of sensitive data (forwarding email, phone mappings, identity labels) is encrypted client-side with AES-256-GCM before it ever hits the database.
3. **Storage** — The server stores encrypted blobs. If the database is breached, attackers get gibberish without individual master passwords.
4. **Key Derivation** — Auth key and encryption key use separate derivation paths with unique salts, so cracking one doesn't compromise the other.

### Email Flow

```
Sender → MX (Cloudflare) → Tracker Stripper → Forward to user's real email
                                    ↓
                           Log tracker stats
                           Check for leaks
                           Classify email
                           Generate AI summary
```

### Phone Number Flow (Receive-Only)

```
Service sends SMS → Twilio number → Webhook → API
                                                ↓
                                    Extract OTP (regex: 4-6 digits)
                                    Push notification: "Instagram OTP: 847291"
```

Phone numbers are strictly receive-only. No outbound SMS. This eliminates A2P 10DLC registration requirements and abuse concerns.

---

## Security

### Authentication & Authorization
- Every API endpoint verifies Supabase JWT
- Every database query scoped to `auth.uid()` via Row Level Security
- RLS enabled on all 15 tables with 20 policies
- Webhook endpoints verify provider signatures before processing

### Input Validation
- Every user input validated with Zod schemas before database insertion
- Parameterized queries (no raw SQL)
- Email HTML sanitized with DOMPurify

### Rate Limiting
| Endpoint | Limit |
|----------|-------|
| API (general) | 100/min/user |
| Auth signup | 5/hr/IP |
| Auth login | 10/15min/IP |
| Alias creation | 20/hr/user |
| AI summaries | 100/day/user |
| GDPR requests | 10/day/user |
| Emergency nuke | 1/24hr/user |
| Phone purchase | 5/day/user |

### Secrets Management
- All secrets in environment variables
- Separate dev/staging/prod configurations
- No secrets in git (`.env.local` in `.gitignore`)

### Audit Logging
- All sensitive operations logged to append-only `audit_log` table
- 90-day retention
- Service role only (users cannot write directly)

---

## Database Schema

### Core Tables
- `identities` — Email aliases and phone numbers with encrypted metadata
- `user_settings` — Plan tier, forwarding preferences, autopilot config
- `alias_domains` — Domain rotation pool for email aliases

### V2 Intelligence Tables
- `tracker_logs` — Stripped tracker events per alias
- `leak_detections` — Unexpected sender detections
- `company_privacy_scores` — Crowdsourced privacy ratings
- `email_summaries` — AI-generated email summaries
- `honeypot_triggers` — Honeypot activation events
- `deletion_requests` — GDPR/CCPA request tracking
- `company_privacy_contacts` — 239 seeded company DPO/privacy contacts
- `autopilot_scans` — Monthly footprint scan results
- `audit_log` — Security audit trail

### Family Tables (coming soon)
- `families` — Family plan groups
- `family_members` — Member roles and permissions

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account (username + password, no email) |
| POST | `/api/auth/login` | Login, returns JWT + encryption metadata |

### Aliases
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/aliases` | List user's aliases |
| POST | `/api/v2/aliases` | Create new alias |
| DELETE | `/api/v2/aliases/:id` | Kill an alias |

### Intelligence
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/trackers/stats` | 30-day tracker blocking stats |
| GET | `/api/v2/leaks` | Leak detection alerts |
| PATCH | `/api/v2/leaks/:id/dismiss` | Dismiss a leak alert |
| POST | `/api/v2/honeypots` | Create honeypot alias |
| GET | `/api/v2/honeypots` | List honeypots + trigger status |

### GDPR
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v2/deletion-requests` | Send GDPR deletion request |
| GET | `/api/v2/deletion-requests` | List all requests + status |
| PATCH | `/api/v2/deletion-requests/:id` | Update request status |
| GET | `/api/v2/company-contacts/:domain` | Get company privacy contact |

### Privacy
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/company-scores/:domain` | Company privacy score |
| POST | `/api/v2/autopilot/scan` | Run privacy autopilot scan |
| GET | `/api/v2/autopilot/results` | Get scan results |
| POST | `/api/v2/autopilot/kill` | Kill stale identities |

### Account
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v2/nuke` | Emergency nuke (kills everything) |
| GET | `/api/v2/export?format=json` | Export all data as JSON |
| GET | `/api/v2/export?format=csv` | Export all data as CSV |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/stripe/checkout` | Create Pro subscription checkout |
| POST | `/api/stripe/addon` | Purchase add-on (extra phone/aliases) |
| POST | `/api/webhooks/stripe` | Handle Stripe subscription events |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/twilio-sms` | Incoming SMS handler |
| POST | `/api/webhooks/tracker-log` | Tracker stripping events |
| POST | `/api/v2/email/summarize` | Email classification + AI summary |
| POST | `/api/cron/company-scores` | Nightly privacy score computation |

---

## Project Structure

```
phantom-defender/
├── CLAUDE.md                    # AI assistant project context
├── ARCHITECTURE-V2-FINAL.md     # Full technical specification
├── prd-v2-final.json            # User stories + acceptance criteria
├── app/
│   ├── page.tsx                 # Login/signup screen
│   ├── dashboard/
│   │   ├── layout.tsx           # Dashboard shell + navigation
│   │   ├── page.tsx             # Main dashboard (metrics, charts, feed)
│   │   ├── aliases/page.tsx     # Alias management + creation
│   │   ├── leaks/page.tsx       # Leak detection alerts
│   │   ├── honeypots/page.tsx   # Honeypot manager
│   │   ├── gdpr/page.tsx        # GDPR request tracker
│   │   ├── scores/page.tsx      # Company privacy scores
│   │   ├── phone/page.tsx       # Burner phone management (Pro)
│   │   ├── autopilot/page.tsx   # Privacy autopilot
│   │   ├── nuke/page.tsx        # Emergency nuke
│   │   ├── export/page.tsx      # Data export
│   │   ├── upgrade/page.tsx     # Pro upgrade + pricing
│   │   └── settings/page.tsx    # Account settings
│   ├── api/
│   │   ├── auth/                # Signup + login endpoints
│   │   ├── v2/                  # All v2 feature endpoints
│   │   ├── stripe/              # Payment endpoints
│   │   ├── webhooks/            # Twilio, Stripe, tracker webhooks
│   │   └── cron/                # Scheduled jobs
├── lib/
│   ├── crypto/index.ts          # PBKDF2 + AES-256-GCM encryption
│   ├── supabase.ts              # Database client (anon + service role)
│   ├── audit.ts                 # Audit logging middleware
│   ├── rate-limit.ts            # Per-endpoint rate limiting
│   ├── auth-context.tsx         # Client-side auth context
│   ├── api-client.ts            # Authenticated fetch helper
│   └── validations/
│       └── v2-schemas.ts        # Zod validation schemas
├── data/
│   ├── tracker-domains.json     # 200+ tracker domains (DuckDuckGo Tracker Radar + EasyPrivacy)
│   └── company-contacts-seed.json # 239 company privacy contacts
├── .claude/
│   └── agents/                  # Claude Code subagent definitions
│       ├── feature-builder.md
│       ├── security-auditor.md
│       └── test-runner.md
└── __tests__/                   # 280+ tests across 25 files
```

---

## Development

### Prerequisites
- Node.js 18+
- npm
- Supabase account
- Twilio account (for phone numbers)
- OpenAI API key (for AI summaries)
- Stripe account (for payments)

### Setup

```bash
# Clone the repo
git clone https://github.com/JeetVaidya1/PhantomShield.git
cd PhantomShield

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your keys
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# OPENAI_API_KEY=
# STRIPE_SECRET_KEY=
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
# STRIPE_PRO_PRICE_ID=
# STRIPE_PHONE_ADDON_PRICE_ID=
# STRIPE_EMAIL_ADDON_PRICE_ID=
# STRIPE_WEBHOOK_SECRET=
# CRON_SECRET=
# WEBHOOK_SECRET=

# Run database migrations
npx supabase db push

# Start development server
npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern="auth-crypto"
```

280+ tests across 25 test files covering all endpoints, encryption, validation, and webhook handling.

### Deployment

The app deploys to Vercel with automatic deploys on push to `main`:

```bash
git push origin main
```

Or deploy manually:

```bash
npx vercel --prod
```

---

## Competitive Landscape

| Feature | Phantom Defender | Hide My Email | SimpleLogin | Cloaked | Firefox Relay |
|---------|:---:|:---:|:---:|:---:|:---:|
| Email aliases | Yes | Yes | Yes | Yes | Yes |
| Phone numbers | Yes | No | No | Yes | No |
| Tracker stripping | Yes | No | No | No | No |
| Leak detection | Yes | No | No | No | No |
| Honeypot traps | Yes | No | No | No | No |
| GDPR automation | Yes | No | No | No | No |
| Privacy scores | Yes | No | No | No | No |
| Emergency nuke | Yes | No | No | Basic | No |
| Privacy autopilot | Yes | No | No | No | No |
| AI email summaries | Yes | No | No | No | No |
| Zero-knowledge encryption | Yes | Partial | No | Yes | No |
| No email required to signup | Yes | No | No | No | No |
| Android support | Yes | No | Yes | Yes | Yes |
| Open source engine | Yes | No | Yes | No | No |

---

## Roadmap

### Completed
- [x] V1: Core identity management (78 stories, 260+ tests)
- [x] V2: Intelligence features (20 stories, 280+ tests)
- [x] Zero-knowledge auth (no email signup)
- [x] Web app dashboard
- [x] Stripe payments integration
- [x] Cloudflare email routing

### In Progress
- [ ] UI overhaul (data-heavy dashboard design)
- [ ] Custom domain setup (phantomdefender.com)
- [ ] Landing page
- [ ] Beta launch (Reddit, HN, Twitter)

### Upcoming
- [ ] VPS deployment with SimpleLogin (DKIM signing, reply-from-alias)
- [ ] Multi-domain email rotation
- [ ] Native iOS app (TestFlight)
- [ ] Native Android app (APK)
- [ ] Digest batching (daily/weekly email summaries)
- [ ] In-app email viewer (sandboxed WebView)
- [ ] Family plan
- [ ] Chrome extension v2
- [ ] App Store + Google Play submission
- [ ] Product Hunt launch

---

## Unit Economics

| Metric | Value |
|--------|-------|
| Pro subscription | $9.99/month |
| Cost per phone number | $1.15/month (Twilio) |
| Cost per AI summary | ~$0.001 (gpt-4o-mini) |
| Email forwarding cost | $0 (Cloudflare free tier) |
| Gross margin (Pro, 1 phone) | ~$8.84/user/month (88.5%) |
| Gross margin (Pro, no phone) | ~$9.98/user/month (99.9%) |
| Break-even | 1 Pro subscriber |

---

## License

Proprietary. All rights reserved.

---

## Author

Built by [Jeet Vaidya](https://github.com/JeetVaidya1) — solo founder, UBC Computer Science.

*"Every other privacy service is passive. They create aliases and forward email. Phantom Defender is active — it analyzes what's happening to your data, catches companies misbehaving, and fights back on your behalf."*
