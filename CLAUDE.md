# Phantom Defender - Project Context

## What This Is
Mobile-first privacy app that creates disposable email aliases and burner phone numbers.
Unlike competitors, we don't just forward email — we strip trackers, detect data leaks,
plant honeypot traps, automate GDPR deletion requests, and score company privacy practices.
Built with zero-knowledge encryption so even we can't see user data.

## Domain
phantomdefender.com (Cloudflare Email Routing enabled, catch-all active)

## Tech Stack
- Mobile: React Native (Expo)
- Backend: Next.js API routes on Vercel
- Database: Supabase (PostgreSQL + RLS) — https://vexrhvgymqkemsbfcwiv.supabase.co
- Encryption: Client-side zero-knowledge, libsodium
- Email: Cloudflare Email Routing (Sunday launch) → SimpleLogin on VPS (later)
- Phone: Twilio (RECEIVE-ONLY — no outbound SMS ever)
- AI: OpenAI gpt-4o-mini for email classification + summaries
- Auth: Supabase anonymous auth or username/password (NO email required to sign up)
- Payments: RevenueCat (later, not for Sunday launch)

## Architecture Principles
- ALL encryption happens client-side before data hits the server
- Server never sees plaintext forwarding email addresses
- Offline-first: core features work without network
- Every identity is independently disposable
- Forwarding email encrypted with user's master password before storing
- Phone numbers are RECEIVE-ONLY (for OTPs and incoming SMS only)
- Free tier: 3 email aliases, 0 phone numbers
- Pro tier: 15 email aliases, 2 phone numbers (not live until payments enabled)

## Project Structure
- app/ — Next.js API routes + pages
- lib/ — Shared utilities (crypto, phone, email, audit, rate-limit, validations)
- components/ — React Native components
- supabase/ — Migrations and config
- email-server/ — VPS tracker stripper (for later, not Sunday)
- data/ — Static data files (tracker-domains.json, company-contacts seed)

## V2 Documents (READ THESE)
- ARCHITECTURE-V2-FINAL.md — Full technical spec, database schemas, API endpoints, security requirements
- prd-v2-final.json — All user stories with acceptance criteria

## V2 Changes from V1
- Domain changed from phantomshield.com to phantomdefender.com
- Twilio stays (no Telnyx switch). Skip stories v2-007, v2-009, v2-010.
- Phone numbers are receive-only. PhoneProvider interface has NO sendSMS method.
- No email required for signup. Anonymous auth or username/password only.
- Forwarding email encrypted before storage.

## Security Rules (EVERY story must satisfy these)
- Every API endpoint verifies Supabase JWT
- Every database query scoped to auth.uid() via RLS
- Every user input validated with zod schema
- Every webhook verifies provider signature before processing
- Every new table has RLS enabled
- All secrets from process.env, never hardcoded
- All sensitive tokens in expo-secure-store, never AsyncStorage
- All sensitive operations logged to audit_log table
- Rate limits enforced per ARCHITECTURE-V2-FINAL.md Section 10D

## Code Conventions
- TypeScript strict mode everywhere
- Tests colocated with source files (*.test.ts)
- Encryption utilities in lib/crypto/
- All API routes validate input with Zod
- Error handling: never expose internal errors to client
- Commit message format: "v2-XXX: [description]"

## Test Commands
- Run tests: npm test
- Run single test: npm test -- --testPathPattern="filename"

## Sunday Launch Build Order
Stories to build (in this order):
v2-001 → v2-005 (database + security foundation)
v2-016 → v2-020 (trackers, leaks, AI summaries)  
v2-024 → v2-029 (honeypots, GDPR)
v2-032, v2-033 (privacy scores)
v2-034 → v2-037 (nuke, export)

## When Compacting
ALWAYS preserve: completed story IDs, encryption patterns, test results,
database schema state, security decisions, API endpoint list, and any
bugs or issues discovered during the session.

## Sub-Agent Rules
- ALWAYS read ARCHITECTURE-V2-FINAL.md for the relevant section before implementing
- ALWAYS run tests after implementing a user story
- ALWAYS check that new code doesn't break existing tests
- ALWAYS verify RLS policies exist for new tables
- Commit after each completed user story
- Mark passes: true in prd-v2-final.json after tests pass
