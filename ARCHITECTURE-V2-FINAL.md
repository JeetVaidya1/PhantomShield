# Phantom Shield v2 — Production Architecture

> This document is designed for Claude Code to read and execute.
> It contains exact GitHub repos, file paths, SDK references, and security requirements.
> Each section is tagged: [MANUAL] = Jeet does this, [CLAUDE CODE] = Claude Code builds this.

---

## TABLE OF CONTENTS

1. Open Source Dependencies (exact repos + files)
2. Infrastructure Setup [MANUAL]
3. Email Engine Integration [CLAUDE CODE]
4. Phone Provider Abstraction [CLAUDE CODE]
5. Multi-Domain System [CLAUDE CODE]
6. Tracker Warfare [CLAUDE CODE]
7. Intelligence Features [CLAUDE CODE]
8. Automation Features [CLAUDE CODE]
9. Safety Features [CLAUDE CODE]
10. Security Hardening [CLAUDE CODE]
11. New Database Schema (complete)
12. New API Endpoints (complete)
13. New Mobile Screens (complete)

---

## 1. OPEN SOURCE DEPENDENCIES

### SimpleLogin Email Engine

- **Repo:** `https://github.com/simple-login/app` (AGPL-3.0 license, 6.5k stars, 5,200+ commits)
- **What we use:** We do NOT fork the full SimpleLogin app. We use their Docker image as a black-box email forwarding engine, then build custom middleware on top.
- **Docker image:** `simplelogin/app:3.4.0`
- **Key entry points inside the image:**
  - `python email_handler.py` — Listens on port 20381 for email from Postfix, handles forwarding + reverse aliases
  - `python job_runner.py` — Background jobs (bounces, cleanup, etc.)
  - `python server.py` — Web dashboard (we DON'T use this — our mobile app IS the dashboard)
- **Config:** All via environment file mounted at `/code/.env` inside container
- **Database:** SimpleLogin uses PostgreSQL. We point it at a dedicated database on our Supabase instance (separate schema, not mixing with app tables).
- **Key config variables we must set:**
  ```
  URL=https://mail.phantomshield.com
  EMAIL_DOMAIN=phantomshield.com
  SUPPORT_EMAIL=support@phantomshield.com
  EMAIL_SERVERS_WITH_PRIORITY=[(10, "mail.phantomshield.com.")]
  DISABLE_ALIAS_SUFFIX=1
  DKIM_PRIVATE_KEY_PATH=/dkim.key
  DB_URI=postgresql://sl_user:PASSWORD@localhost:5432/simplelogin
  FLASK_SECRET=<random-64-char-string>
  GNUPG_HOME=/sl/pgp
  ```

### Telnyx Node.js SDK

- **NPM:** `telnyx` (https://www.npmjs.com/package/telnyx)
- **Repo:** `https://github.com/team-telnyx/telnyx-node`
- **Install:** `npm install telnyx`
- **Key APIs we use:**
  ```typescript
  import Telnyx from 'telnyx';
  const client = new Telnyx({ apiKey: process.env.TELNYX_API_KEY });

  // Buy a number
  await client.numberOrders.create({
    phone_numbers: [{ phone_number: '+15558675309' }]
  });

  // Send SMS
  await client.messages.send({
    from: '+15551234567',
    to: '+15559876543',
    text: 'Hello from Phantom Shield'
  });
  ```
- **Webhook format:** POST with JSON body, signature in `telnyx-signature-ed25519` header, timestamp in `telnyx-timestamp` header
- **Webhook verification:** Use ed25519 public key verification (Telnyx provides the public key in your dashboard)

### Tracker Blocklists (Open Source)

- **DuckDuckGo Tracker Radar:** `https://github.com/nicolo-ribaudo/nicolo-ribaudo.github.io/tree/master/nicolo-ribaudo/nicolo-ribaudo.github.io` — Comprehensive, community maintained
- **EasyList / EasyPrivacy:** `https://easylist.to/easylist/easyprivacy.txt` — Standard privacy filter list
- **Trocker tracker list:** Available at `https://github.com/nicolo-ribaudo/nicolo-ribaudo.github.io`
- **Our approach:** Download and merge these lists into a single JSON file at build time: `data/tracker-domains.json`. Update weekly via cron. Format:
  ```json
  {
    "pixel_domains": ["mailchimp.com", "list-manage.com", "hubspot.com", ...],
    "utm_params": ["utm_source", "utm_medium", "utm_campaign", "mc_eid", "fbclid", "gclid", ...],
    "known_pixel_paths": ["/track/open", "/beacon/", "/pixel/", "/wf/open", ...]
  }
  ```

---

## 2. INFRASTRUCTURE SETUP [MANUAL — Jeet does this before Claude Code starts]

### Step 1: VPS for Email Server

**Provider:** Hetzner Cloud (cheapest reliable option with port 25 open)
- Plan: CX22 (2 vCPU, 4GB RAM, 40GB SSD) — €4.35/month (~$5/month)
- Location: Ashburn, VA (US East) or Falkenstein (EU)
- OS: Ubuntu 24.04 LTS
- **CRITICAL:** Many VPS providers block port 25 (SMTP) by default. Hetzner allows it but you must request unblock via support ticket. Do this FIRST.

**After provisioning:**
```bash
# SSH in
ssh root@YOUR_VPS_IP

# Update
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Postfix
apt install -y postfix postfix-pgsql

# Install certbot for SSL
apt install -y certbot
```

### Step 2: Domain & DNS Configuration

**Buy domains (Cloudflare Registrar — cheapest renewals):**
- `phantomshield.com` — Primary (or whatever you choose)
- 10-15 rotation domains: generic names like `mailnest.io`, `inboxhub.co`, `msgport.com`, etc.
- Cost: ~$10/year each, ~$120-150 total for 12 domains

**DNS records for EACH email domain (do this in Cloudflare dashboard):**
```
# MX record — tells the internet where to send email for this domain
TYPE: MX    NAME: @    VALUE: mail.phantomshield.com    PRIORITY: 10

# A record — points mail.phantomshield.com to your VPS
TYPE: A     NAME: mail    VALUE: YOUR_VPS_IP

# SPF record — authorizes your server to send email for this domain
TYPE: TXT   NAME: @    VALUE: "v=spf1 mx -all"

# DKIM record — public key for email signing (generated in Step 3)
TYPE: TXT   NAME: dkim._domainkey    VALUE: "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY"

# DMARC record — policy for handling failed authentication
TYPE: TXT   NAME: _dmarc    VALUE: "v=DMARC1; p=quarantine; rua=mailto:dmarc@phantomshield.com"

# Reverse DNS (PTR record) — set in Hetzner dashboard, not Cloudflare
# Must point VPS IP back to mail.phantomshield.com
```

### Step 3: Generate DKIM Keys

```bash
# On your VPS
openssl genrsa -out /root/dkim.key 2048
openssl rsa -in /root/dkim.key -pubout -out /root/dkim.pub.key

# Extract the public key for DNS (remove headers/footers, join lines)
cat /root/dkim.pub.key | grep -v "^-" | tr -d '\n'
# Copy this output → paste into DNS TXT record for dkim._domainkey
```

### Step 4: Deploy SimpleLogin via Docker

```bash
# Create working directory
mkdir -p /opt/simplelogin/sl/pgp /opt/simplelogin/sl/upload
cd /opt/simplelogin

# Create Docker network
docker network create sl-network

# Start PostgreSQL for SimpleLogin (separate from your Supabase)
docker run -d \
  --name sl-db \
  -e POSTGRES_PASSWORD=STRONG_PASSWORD_HERE \
  -e POSTGRES_USER=sl_user \
  -e POSTGRES_DB=simplelogin \
  -p 127.0.0.1:5432:5432 \
  -v /opt/simplelogin/sl/db:/var/lib/postgresql/data \
  --restart always \
  --network="sl-network" \
  postgres:16

# Create simplelogin.env (see config in Section 1)
nano /opt/simplelogin/simplelogin.env

# Copy DKIM keys
cp /root/dkim.key /opt/simplelogin/dkim.key
cp /root/dkim.pub.key /opt/simplelogin/dkim.pub.key

# Initialize SimpleLogin database
docker run --rm \
  -v /opt/simplelogin/sl:/sl \
  -v /opt/simplelogin/simplelogin.env:/code/.env \
  --network="sl-network" \
  simplelogin/app:3.4.0 alembic upgrade head

# Start email handler (the core — listens for email from Postfix)
docker run -d \
  --name sl-email \
  -v /opt/simplelogin/sl:/sl \
  -v /opt/simplelogin/sl/upload:/code/static/upload \
  -v /opt/simplelogin/simplelogin.env:/code/.env \
  -v /opt/simplelogin/dkim.key:/dkim.key \
  -v /opt/simplelogin/dkim.pub.key:/dkim.pub.key \
  -p 127.0.0.1:20381:20381 \
  --restart always \
  --network="sl-network" \
  simplelogin/app:3.4.0 python email_handler.py

# Start job runner (handles bounces, cleanup)
docker run -d \
  --name sl-job-runner \
  -v /opt/simplelogin/sl:/sl \
  -v /opt/simplelogin/sl/upload:/code/static/upload \
  -v /opt/simplelogin/simplelogin.env:/code/.env \
  -v /opt/simplelogin/dkim.key:/dkim.key \
  -v /opt/simplelogin/dkim.pub.key:/dkim.pub.key \
  --restart always \
  --network="sl-network" \
  simplelogin/app:3.4.0 python job_runner.py
```

### Step 5: Configure Postfix

Replace `/etc/postfix/main.cf`:
```
smtpd_banner = $myhostname ESMTP
biff = no
append_dot_mydomain = no
readme_directory = no

# TLS parameters
smtpd_tls_cert_file=/etc/letsencrypt/live/mail.phantomshield.com/fullchain.pem
smtpd_tls_key_file=/etc/letsencrypt/live/mail.phantomshield.com/privkey.pem
smtpd_use_tls=yes
smtpd_tls_session_cache_database = btree:${data_directory}/smtpd_scache
smtp_tls_session_cache_database = btree:${data_directory}/smtp_scache
smtp_tls_security_level = may

# Network
myhostname = mail.phantomshield.com
myorigin = phantomshield.com
mydestination = localhost
mynetworks = 127.0.0.0/8
inet_interfaces = all
recipient_delimiter = +

# Size limit (25MB)
message_size_limit = 26214400

# Virtual domains — forward to SimpleLogin
virtual_mailbox_domains = pgsql:/etc/postfix/pgsql-virtual-mailbox-domains.cf
virtual_transport = smtp:127.0.0.1:20381

# Rate limiting
smtpd_client_connection_rate_limit = 10
smtpd_client_message_rate_limit = 30
anvil_rate_time_unit = 60s

# Anti-spam
smtpd_helo_required = yes
smtpd_helo_restrictions = reject_non_fqdn_helo_hostname, reject_invalid_helo_hostname
smtpd_sender_restrictions = reject_non_fqdn_sender, reject_unknown_sender_domain
smtpd_recipient_restrictions = reject_unauth_destination, reject_non_fqdn_recipient
```

Create `/etc/postfix/pgsql-virtual-mailbox-domains.cf`:
```
hosts = localhost
user = sl_user
password = STRONG_PASSWORD_HERE
dbname = simplelogin
query = SELECT domain FROM custom_domain WHERE domain='%s' AND verified=true
        UNION SELECT '%s' WHERE '%s' = 'phantomshield.com' LIMIT 1;
```

### Step 6: Test Email Flow

```bash
# Send test email to an alias
echo "Test body" | mail -s "Test subject" test@phantomshield.com

# Check SimpleLogin logs
docker logs sl-email --tail 50

# Check Postfix logs
tail -50 /var/log/mail.log

# Verify DKIM/SPF with external tool
# Send an email to check-auth@verifier.port25.com
# Or use https://www.mail-tester.com
```

### Step 7: Create External Accounts

**Telnyx:**
1. Sign up at https://telnyx.com
2. Go to API Keys → create key → save as `TELNYX_API_KEY`
3. Go to Messaging → create Messaging Profile → name it "Phantom Shield"
4. Note the Messaging Profile ID → save as `TELNYX_MESSAGING_PROFILE_ID`
5. Set webhook URL to: `https://api.phantomshield.com/api/webhooks/telnyx-sms`
6. Buy 2 test phone numbers

**OpenAI (for AI summaries):**
1. Go to https://platform.openai.com
2. Create API key → save as `OPENAI_API_KEY`
3. Set usage limit to $20/month initially

### Step 8: Environment Variables

Add to your Vercel project (or `.env` for local dev):
```
# Email Server (your VPS)
EMAIL_SERVER_HOST=mail.phantomshield.com
EMAIL_SERVER_IP=YOUR_VPS_IP
SIMPLELOGIN_DB_URI=postgresql://sl_user:PASSWORD@YOUR_VPS_IP:5432/simplelogin

# Telnyx
TELNYX_API_KEY=KEY_...
TELNYX_MESSAGING_PROFILE_ID=uuid-here
TELNYX_PUBLIC_KEY=base64-public-key-for-webhook-verification

# OpenAI
OPENAI_API_KEY=sk-...

# Existing (unchanged)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
HIBP_API_KEY=...
```

**IMPORTANT:** After completing ALL manual steps above, verify:
- [ ] Email sent to test@phantomshield.com appears in SimpleLogin logs
- [ ] DKIM passes (check via mail-tester.com)
- [ ] SPF passes
- [ ] Telnyx can send a test SMS from dashboard
- [ ] VPS firewall allows ports: 22 (SSH), 25 (SMTP), 80 (HTTP), 443 (HTTPS)
- [ ] VPS firewall BLOCKS: 5432 (Postgres — only localhost), 20381 (SimpleLogin — only localhost)

**Only after ALL checks pass does Claude Code start building.**

---

## 3. EMAIL ENGINE INTEGRATION [CLAUDE CODE]

Claude Code does NOT touch SimpleLogin's code. Instead, it builds:

### 3A. Alias Sync Bridge

SimpleLogin has its own database with its own `alias` table. Our Supabase has an `identities` table. We need a bridge that keeps them in sync.

**File: `lib/email/alias-sync.ts`**

When our app creates an identity, this module:
1. Connects to SimpleLogin's PostgreSQL directly
2. Creates a corresponding alias record
3. Stores the SimpleLogin alias ID on our identity record

When our app kills an identity:
1. Deactivates the alias in SimpleLogin's database
2. Updates our identity record

**This is a direct database bridge, NOT an API integration.** SimpleLogin's API is designed for its own web dashboard. We bypass it and write directly to its Postgres tables because we control both databases on the same server.

**Key SimpleLogin tables we interact with:**
- `alias` — the alias records (email, enabled, user_id, mailbox_id, etc.)
- `contact` — tracks who has emailed each alias
- `mailbox` — the real email addresses aliases forward to
- `user` — SimpleLogin user (we create ONE service user for all Phantom Shield operations)
- `custom_domain` — registered domains for alias creation

### 3B. Webhook Receiver for Email Events

SimpleLogin emits events when emails are processed. We build a webhook endpoint that SimpleLogin's job_runner calls when:
- Email forwarded successfully
- Email bounced
- Alias auto-disabled

**File: `app/api/webhooks/email-events/route.ts`**

### 3C. Tracker Stripping Middleware

This runs as a separate microservice on the VPS, sitting between Postfix and SimpleLogin.

**Architecture:**
```
Postfix (port 25) → Tracker Stripper (port 20380) → SimpleLogin (port 20381)
```

The tracker stripper is a small Python SMTP proxy that:
1. Receives email from Postfix
2. Parses HTML body
3. Strips tracking pixels (using our `data/tracker-domains.json`)
4. Cleans UTM params from links
5. Adds `X-PhantomShield-Trackers-Stripped: N` header
6. Forwards cleaned email to SimpleLogin on port 20381
7. POSTs tracker count to our API: `POST /api/webhooks/tracker-log`

**File: `email-server/tracker-stripper/main.py`** — Python, runs as Docker container on VPS
**File: `email-server/tracker-stripper/Dockerfile`**
**File: `email-server/tracker-stripper/tracker_domains.json`** — merged blocklist

### 3D. AI Summary Service

Separate endpoint that the tracker stripper calls for marketing emails.

**File: `app/api/v2/email/summarize/route.ts`**
- Receives: email subject, from, body preview (first 1000 chars)
- Classifies: transactional vs marketing (heuristic first, AI fallback)
- If marketing: generates one-line summary via gpt-4o-mini
- Returns: `{ type, summary }`
- Called by tracker stripper before forwarding

### 3E. Digest Batching Cron

**File: `app/api/cron/digest/route.ts`**
- Runs every hour via Vercel Cron
- For each user with digest_mode enabled:
  - Check if it's their digest time
  - Compile all held marketing email summaries
  - Format into single digest email
  - Send via SimpleLogin's outgoing SMTP
  - Mark emails as forwarded

---

## 4. PHONE PROVIDER ABSTRACTION [CLAUDE CODE]

### 4A. Provider Interface

**File: `lib/phone/provider.ts`**
```typescript
export interface PhoneProvider {
  name: string;
  buyNumber(params: { areaCode?: string; country?: string }): Promise<{
    number: string;        // E.164 format: +15551234567
    providerSid: string;   // provider-specific ID for management
    monthlyCost: number;   // in USD
  }>;
  releaseNumber(providerSid: string): Promise<void>;
  sendSMS(params: { from: string; to: string; body: string }): Promise<{
    messageId: string;
    cost: number;
  }>;
  verifyWebhook(headers: Record<string, string>, body: string): boolean;
  parseInboundSMS(body: any): {
    from: string;
    to: string;
    text: string;
    messageId: string;
  };
}
```

### 4B. Telnyx Implementation

**File: `lib/phone/providers/telnyx.ts`**
- Uses `telnyx` npm package (https://github.com/team-telnyx/telnyx-node)
- `buyNumber`: `client.numberOrders.create({ phone_numbers: [{ phone_number }] })`
- `sendSMS`: `client.messages.send({ from, to, text, messaging_profile_id })`
- `verifyWebhook`: ed25519 signature verification using `telnyx-signature-ed25519` and `telnyx-timestamp` headers
- `parseInboundSMS`: Extract from Telnyx webhook payload `data.payload.from.phone_number`, `.to[0].phone_number`, `.text`

### 4C. Twilio Fallback (keep existing)

**File: `lib/phone/providers/twilio.ts`**
- Refactor existing `lib/twilio.ts` to implement PhoneProvider interface
- No new functionality, just interface compliance

### 4D. Provider Factory

**File: `lib/phone/factory.ts`**
```typescript
export function getPhoneProvider(): PhoneProvider {
  switch (process.env.PHONE_PROVIDER) {
    case 'telnyx': return new TelnyxProvider();
    case 'twilio': return new TwilioProvider();
    default: throw new Error(`Unknown PHONE_PROVIDER: ${process.env.PHONE_PROVIDER}`);
  }
}
```

### 4E. Webhook Handler

**File: `app/api/webhooks/telnyx-sms/route.ts`**
- Verify webhook signature (CRITICAL — see Security section)
- Parse inbound SMS
- Look up which identity owns the receiving number
- Forward SMS content as push notification to user
- Log SMS metadata in database

---

## 5. MULTI-DOMAIN SYSTEM [CLAUDE CODE]

### 5A. Domain Management

**File: `lib/email/domains.ts`**
- `getActiveDomains()`: Query alias_domains table for active, mx_verified, dkim_configured domains
- `selectDomainForNewAlias(userId)`: Smart selection — spread user's aliases across different domains, skip high-blocked-count domains
- `reportDomainBlocked(domainId)`: Increment blocked_count, auto-deactivate at threshold

### 5B. Domain Registration in SimpleLogin DB

When we add a new domain, we must also register it in SimpleLogin's `custom_domain` table so SimpleLogin knows to accept email for it.

**File: `lib/email/domain-registration.ts`**
- Creates record in our `alias_domains` table (Supabase)
- Creates record in SimpleLogin's `custom_domain` table (SimpleLogin Postgres)
- Generates DKIM key pair for the domain
- Returns DNS records the admin needs to configure

---

## 6-9. FEATURE IMPLEMENTATIONS [CLAUDE CODE]

All features follow the same pattern:
1. Database migration (Supabase)
2. API endpoint(s) (Next.js route handlers)
3. Mobile screen(s) (React Native/Expo)
4. Tests

Detailed stories are in `prd-v2.json`. Key architectural notes:

### Leak Detection
- Runs in the email webhook handler (`/api/webhooks/email-events`)
- When SimpleLogin forwards an email, it sends us metadata (sender, alias)
- We compare sender domain against the identity's labeled service
- Mismatch = leak detection record created + push notification

### Company Privacy Scores
- Aggregated from leak_detections across ALL users (anonymized)
- Computed nightly by Supabase pg_cron function
- Exposed via public API (no auth required) for Chrome extension

### Honeypots
- Regular aliases with `is_honeypot: true` flag
- Email pipeline checks this flag — if honeypot, DON'T forward, just log the trigger

### GDPR/CCPA Requests
- Template stored in `lib/gdpr/templates.ts`
- Sent via SimpleLogin's reply-from-alias system (so it comes FROM the alias)
- Tracked in deletion_requests table with 30-day timer

### Emergency Nuke
- Atomic transaction: kill all identities → release all phone numbers → fire GDPR emails → clear local storage
- Requires biometric token from expo-secure-store
- Soft-delete (recoverable 30 days)

### Portable Export
- Server-side: query all user data, format as JSON
- Includes SimpleLogin-compatible alias format for migration
- Download via React Native Share API

---

## 10. SECURITY HARDENING [CLAUDE CODE]

**Every story in prd-v2.json must satisfy these security requirements. Claude Code should verify each one during implementation.**

### 10A. Authentication & Authorization

```
RULE: Every API endpoint (except public health check) MUST verify Supabase JWT.
RULE: Every database query MUST include user_id filter (RLS enforced at DB level).
RULE: Webhook endpoints MUST verify provider signatures before processing.
```

**Implementation:**
- Supabase Row Level Security (RLS) enabled on ALL new tables
- Every RLS policy: `auth.uid() = user_id`
- Webhook signature verification:
  - Telnyx: ed25519 signature in `telnyx-signature-ed25519` header
  - SimpleLogin events: HMAC-SHA256 with shared secret
  - Cron endpoints: verify `Authorization: Bearer CRON_SECRET` header

### 10B. Encryption

```
RULE: All sensitive data encrypted at rest using user's encryption key.
RULE: Server NEVER stores user's master password or derived encryption key.
RULE: All API communication over HTTPS (TLS 1.2+).
RULE: All inter-service communication (VPS ↔ Vercel) over HTTPS with shared secret.
```

**What's encrypted in the database (using existing zero-knowledge encryption from v1):**
- `identities.forwarding_email` — user's real email (encrypted with SERVER key, decrypted only during forwarding)
- `email_summaries.full_body_encrypted` — stored email content
- `identities.reverse_alias_token` — generated server-side, not user-visible

**What's NOT encrypted (metadata, needed for queries):**
- Alias email addresses (needed for Postfix routing)
- Tracker counts, leak detection records, company scores
- Email subjects and sender domains (metadata, not content)

### 10C. Input Validation & Injection Prevention

```
RULE: All user input validated with zod schemas before database insertion.
RULE: All SQL queries use parameterized queries (Supabase client handles this).
RULE: Email content is NEVER rendered as raw HTML in the app — sanitize with DOMPurify before WebView rendering.
RULE: All webhook payloads validated against expected schema.
```

**Specific validations:**
- Alias labels: max 100 chars, alphanumeric + spaces + common punctuation, strip HTML
- Company names: max 200 chars, same sanitization
- Email bodies before AI summarization: truncate to 2000 chars, strip scripts/iframes
- Phone numbers: E.164 format validation (`/^\+[1-9]\d{1,14}$/`)
- GDPR template: fixed template, only the alias email and company name are variable (prevent template injection)

### 10D. Rate Limiting

```
RULE: All public API endpoints rate-limited.
RULE: Webhook endpoints rate-limited per source IP.
RULE: AI summarization rate-limited per user (prevent cost abuse).
```

**Limits:**
- API endpoints: 100 requests/minute per user (existing from Phase 9)
- Webhook endpoints: 1000 requests/minute per source IP
- AI summarization: 100 summaries/day per user
- GDPR email sending: 10 requests/day per user
- Emergency nuke: 1 per 24 hours per user
- Alias creation: 20/hour per user
- Phone number purchase: 5/day per user

### 10E. Secrets Management

```
RULE: No secrets in code. ALL secrets in environment variables.
RULE: No secrets in git history. Verify with `git log --all -p | grep -i "password\|secret\|key"`.
RULE: Separate secrets for dev/staging/production.
```

**Secrets inventory:**
| Secret | Where stored | Who has access |
|--------|-------------|----------------|
| Supabase service role key | Vercel env vars | Vercel only |
| Telnyx API key | Vercel env vars | Vercel only |
| OpenAI API key | Vercel env vars | Vercel only |
| SimpleLogin DB password | VPS env file | VPS only |
| DKIM private key | VPS filesystem | VPS only |
| Webhook shared secrets | Both Vercel + VPS | Both |
| CRON_SECRET | Vercel env vars | Vercel Cron only |

### 10F. VPS Hardening

```
RULE: SSH key-only authentication (no password login).
RULE: UFW firewall allowing only ports 22, 25, 80, 443.
RULE: Fail2ban installed for SSH and Postfix.
RULE: Automatic security updates enabled.
RULE: Docker containers run as non-root where possible.
```

**Setup script (Jeet runs this on VPS):**
```bash
# Disable password auth
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# Firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 25/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Fail2ban
apt install -y fail2ban
systemctl enable fail2ban

# Auto-updates
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### 10G. Mobile App Security

```
RULE: All sensitive data stored via expo-secure-store (Keychain on iOS, Keystore on Android).
RULE: Never store tokens, passwords, or encryption keys in AsyncStorage.
RULE: Biometric authentication required for: emergency nuke, export, viewing decrypted email content.
RULE: App auto-locks after timeout (existing from Phase 2).
RULE: Certificate pinning on API requests to api.phantomshield.com.
```

**Specific expo-secure-store keys:**
- `auth_token` — Supabase JWT
- `refresh_token` — Supabase refresh token
- `encryption_key` — derived from master password (NEVER sent to server)
- `biometric_token` — biometric-gated, required for sensitive operations
- `nuke_contact_number` — emergency contact for "I'm safe" message

### 10H. Content Security for Email Viewing

```
RULE: Email HTML rendered in sandboxed WebView with JavaScript disabled.
RULE: All external images proxied through our server (prevents IP leak).
RULE: No remote content loaded by default — user must tap to load images.
RULE: Links open in system browser, not in WebView.
```

**Implementation for in-app email viewer:**
```typescript
<WebView
  source={{ html: sanitizedHtml }}
  javaScriptEnabled={false}         // No scripts
  allowFileAccess={false}           // No local file access
  mixedContentMode="never"          // No HTTP content on HTTPS page
  originWhitelist={['about:blank']} // Only render static HTML
  onNavigationStateChange={(e) => {
    if (e.url !== 'about:blank') {
      Linking.openURL(e.url);       // External links → system browser
      return false;
    }
  }}
/>
```

### 10I. Audit Logging

```
RULE: All sensitive operations logged with: user_id, action, timestamp, IP address, success/failure.
RULE: Logs stored in Supabase audit_log table with 90-day retention.
RULE: Logs are append-only (no UPDATE or DELETE via app — only admin).
```

**Logged operations:**
- Identity created/killed
- Phone number purchased/released
- GDPR request sent
- Emergency nuke triggered
- Export downloaded
- Failed authentication attempts
- Webhook signature verification failures
- Rate limit hits

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT, -- 'identity', 'phone_number', 'gdpr_request', etc.
  resource_id UUID,
  metadata JSONB, -- action-specific details
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: users can read their own logs, cannot write or delete
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own audit logs"
  ON audit_log FOR SELECT
  USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policy for users — only service role can write
```

---

## 11. COMPLETE NEW DATABASE SCHEMA

All migrations should be created as Supabase SQL migrations.

```sql
-- =============================================
-- V2 MIGRATION: Multi-domain support
-- =============================================
CREATE TABLE alias_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT true,
  blocked_count INTEGER DEFAULT 0,
  mx_verified BOOLEAN DEFAULT false,
  dkim_configured BOOLEAN DEFAULT false,
  dkim_public_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE alias_domains ENABLE ROW LEVEL SECURITY;
-- Domains are public-readable (needed for alias creation)
CREATE POLICY "Anyone can read active domains"
  ON alias_domains FOR SELECT USING (active = true);

-- Add domain reference to identities
ALTER TABLE identities ADD COLUMN domain_id UUID REFERENCES alias_domains(id);
ALTER TABLE identities ADD COLUMN reverse_alias_token TEXT UNIQUE;
ALTER TABLE identities ADD COLUMN reply_enabled BOOLEAN DEFAULT true;
ALTER TABLE identities ADD COLUMN phone_provider TEXT DEFAULT 'telnyx';
ALTER TABLE identities ADD COLUMN phone_provider_sid TEXT;
ALTER TABLE identities ADD COLUMN is_honeypot BOOLEAN DEFAULT false;
ALTER TABLE identities ADD COLUMN service_label TEXT; -- "Netflix", "Uber", etc.
ALTER TABLE identities ADD COLUMN simplelogin_alias_id BIGINT; -- FK to SimpleLogin's alias table

-- =============================================
-- V2 MIGRATION: Tracker logging
-- =============================================
CREATE TABLE tracker_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID REFERENCES identities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trackers_stripped INTEGER NOT NULL DEFAULT 0,
  tracker_companies TEXT[] DEFAULT '{}',
  links_cleaned INTEGER NOT NULL DEFAULT 0,
  email_from TEXT,
  email_subject TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tracker_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own tracker logs"
  ON tracker_logs FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_tracker_logs_user_date ON tracker_logs(user_id, processed_at DESC);

-- =============================================
-- V2 MIGRATION: Leak detection
-- =============================================
CREATE TABLE leak_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID REFERENCES identities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expected_sender TEXT NOT NULL,
  actual_sender_domain TEXT NOT NULL,
  actual_sender_email TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed BOOLEAN DEFAULT false
);

ALTER TABLE leak_detections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own leak detections"
  ON leak_detections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own leak detections"
  ON leak_detections FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- V2 MIGRATION: Company privacy scores (public, aggregated)
-- =============================================
CREATE TABLE company_privacy_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_domain TEXT NOT NULL UNIQUE,
  company_name TEXT,
  total_aliases INTEGER DEFAULT 0,
  leak_detections INTEGER DEFAULT 0,
  leak_rate NUMERIC(5,4) DEFAULT 0,
  avg_days_to_first_spam NUMERIC(10,2),
  privacy_score INTEGER DEFAULT 50, -- 0-100
  last_computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Public read (no RLS restriction for SELECT)
ALTER TABLE company_privacy_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read company scores"
  ON company_privacy_scores FOR SELECT USING (true);

-- =============================================
-- V2 MIGRATION: Email summaries + digest
-- =============================================
CREATE TABLE email_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID REFERENCES identities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_from TEXT NOT NULL,
  email_subject TEXT NOT NULL,
  summary TEXT,
  email_type TEXT NOT NULL DEFAULT 'marketing', -- 'transactional', 'marketing'
  full_body_encrypted TEXT,
  digest_batch_id UUID,
  forwarded BOOLEAN DEFAULT false,
  trackers_stripped INTEGER DEFAULT 0,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own email summaries"
  ON email_summaries FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_email_summaries_user_date ON email_summaries(user_id, received_at DESC);

CREATE TABLE digest_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_count INTEGER DEFAULT 0,
  sent BOOLEAN DEFAULT false,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE digest_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own digest batches"
  ON digest_batches FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- V2 MIGRATION: Honeypots
-- =============================================
CREATE TABLE honeypot_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID REFERENCES identities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_from_email TEXT NOT NULL,
  trigger_from_domain TEXT NOT NULL,
  trigger_subject TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE honeypot_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own honeypot triggers"
  ON honeypot_triggers FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- V2 MIGRATION: GDPR/CCPA requests
-- =============================================
CREATE TABLE deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_id UUID REFERENCES identities(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_email TEXT NOT NULL,
  request_type TEXT NOT NULL DEFAULT 'gdpr_erasure',
  status TEXT DEFAULT 'sent', -- 'sent', 'awaiting', 'completed', 'ignored', 'escalated'
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  response_deadline TIMESTAMPTZ, -- sent_at + 30 days
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own deletion requests"
  ON deletion_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own deletion requests"
  ON deletion_requests FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE company_privacy_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_domain TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  privacy_email TEXT,
  dpo_email TEXT,
  privacy_page_url TEXT,
  verified BOOLEAN DEFAULT false,
  contributed_by_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Public read
ALTER TABLE company_privacy_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read company contacts"
  ON company_privacy_contacts FOR SELECT USING (true);

-- =============================================
-- V2 MIGRATION: Autopilot
-- =============================================
CREATE TABLE autopilot_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  stale_aliases INTEGER DEFAULT 0,
  spam_only_aliases INTEGER DEFAULT 0,
  unused_phones INTEGER DEFAULT 0,
  auto_killed INTEGER DEFAULT 0,
  user_reviewed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE autopilot_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own autopilot scans"
  ON autopilot_scans FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- V2 MIGRATION: User settings extensions
-- =============================================
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS email_forward_mode TEXT DEFAULT 'full';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS digest_frequency TEXT DEFAULT 'daily';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS digest_time TIME DEFAULT '08:00';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS digest_day INTEGER DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS autopilot_auto_kill_days INTEGER DEFAULT 90;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS nuke_contact_number TEXT;

-- =============================================
-- V2 MIGRATION: Audit log
-- =============================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own audit logs"
  ON audit_log FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_audit_log_user_date ON audit_log(user_id, created_at DESC);

-- =============================================
-- V2 MIGRATION: Family plan
-- =============================================
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'My Family',
  max_members INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can read family"
  ON families FOR SELECT
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can read members"
  ON family_members FOR SELECT
  USING (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );
```

---

## 12. API ENDPOINTS

```
# Email infrastructure
POST   /api/webhooks/email-events         — SimpleLogin event webhook (signature verified)
POST   /api/webhooks/tracker-log          — Tracker stripper reports stats (shared secret)
POST   /api/webhooks/telnyx-sms           — Telnyx inbound SMS (ed25519 verified)

# Tracker stats
GET    /api/v2/trackers/stats             — User's tracker blocking stats (auth required)

# Leak detection
GET    /api/v2/leaks                      — User's leak detections (auth required)
PATCH  /api/v2/leaks/:id/dismiss          — Dismiss a leak alert (auth required)

# Company scores
GET    /api/v2/company-scores/:domain     — Public privacy score (no auth, rate limited)

# Email summaries
GET    /api/v2/emails/recent              — Paginated email summaries (auth required)
GET    /api/v2/emails/:id                 — Single email with full body (auth + biometric)

# Digest
PATCH  /api/v2/settings/digest            — Update digest preferences (auth required)
POST   /api/cron/digest                   — Cron: compile and send digests (cron secret)

# Honeypots
POST   /api/v2/honeypots                  — Create honeypot (auth required)
GET    /api/v2/honeypots                  — List with triggers (auth required)
DELETE /api/v2/honeypots/:id              — Delete honeypot (auth required)

# GDPR/CCPA
POST   /api/v2/deletion-requests          — Create + send request (auth required)
GET    /api/v2/deletion-requests          — List requests (auth required)
PATCH  /api/v2/deletion-requests/:id      — Update status (auth required)
GET    /api/v2/company-contacts/:domain   — Lookup privacy contact (auth required)

# Autopilot
POST   /api/v2/autopilot/scan            — Trigger scan (auth required)
GET    /api/v2/autopilot/results          — Latest scan results (auth required)
POST   /api/v2/autopilot/kill             — Kill stale identities from scan (auth required)
POST   /api/cron/autopilot               — Cron: monthly scan for all users (cron secret)

# Safety
POST   /api/v2/nuke                       — Emergency nuke (auth + biometric token required)
GET    /api/v2/export                     — Export all data (auth + biometric required)

# Family
POST   /api/v2/family                     — Create family (auth required)
POST   /api/v2/family/invite              — Invite member (auth required, owner only)
GET    /api/v2/family/stats               — Aggregate stats (auth required, member)
DELETE /api/v2/family/members/:id         — Remove member (auth required, owner only)

# Domains (admin/internal)
GET    /api/v2/domains                    — List active domains (auth required)
POST   /api/v2/domains/:id/report-blocked — Report a domain as blocked (auth required)

# Cron jobs
POST   /api/cron/company-scores           — Nightly: recompute company privacy scores (cron secret)
POST   /api/cron/tracker-list-update      — Weekly: refresh tracker blocklist (cron secret)
```

---

## 13. NEW MOBILE SCREENS

| Screen | Location | Access |
|--------|----------|--------|
| Tracker Dashboard | Home tab → new card → tap to expand | All users |
| Leak Alerts | Notifications tab → new section | Pro users |
| Honeypot Manager | Identities tab → "Honeypots" section | Pro users |
| GDPR Request Tracker | Settings → "Data Requests" | Pro users |
| Autopilot Settings | Settings → "Privacy Autopilot" | Pro users |
| Autopilot Review | Push notification → deep link | Pro users |
| Digest Settings | Settings → "Email Digest" | Pro users |
| In-App Email Viewer | Email summary → tap | Pro users |
| Emergency Nuke | Settings → "Emergency" (red section) | All users |
| Export | Settings → "Export My Data" | All users |
| Family Dashboard | Settings → "Family Plan" | Family plan users |
| Company Score Badge | Alias creation flow → inline | All users |
