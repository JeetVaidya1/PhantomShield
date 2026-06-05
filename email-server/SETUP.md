# Phantom Defender — Self-Hosted Email Engine Setup

This stands up the SimpleLogin forwarding engine + the tracker-stripper on a VPS,
and connects it to the deployed app. Once done, aliases at `@phantomdefender.com`
forward to each user's real inbox with trackers stripped — replacing the current
Cloudflare Email Routing catch-all.

**Time:** ~2–4 hours (most of it DNS propagation + a port-25 unblock ticket).
**Cost:** ~$6–12/mo (VPS). **Difficulty:** high — you're running a mail server.

---

## ⚠️ Two wrinkles to decide on first

1. **Postgres (5432) must be reachable from Vercel.** The app's alias-sync bridge
   (`lib/email/alias-sync.ts`) connects from Vercel's serverless functions to
   SimpleLogin's Postgres. Vercel egress IPs are dynamic, so you can't IP-allowlist
   them easily. Options, best → simplest:
   - **(a)** Put Postgres behind a tunnel/proxy with a static IP (e.g. a small
     Fly/Cloudflare Tunnel) — most secure.
   - **(b)** Expose 5432 publicly with a long random password **and require SSL**
     (`sslmode=require` in the URI). Acceptable to start; rotate the password often.
   This compose file uses (b). Don't skip the strong password.

2. **The email-events webhook (bounces/forwarded → `/api/webhooks/email-events`)
   is NOT wired by stock SimpleLogin.** Alias forwarding + tracker stripping work
   without it. Bounce auto-disable and leak-detection-on-forward need SimpleLogin
   to POST events to our endpoint, which requires a small custom hook or a polling
   job — treat that as a follow-up after the core flow is live.

---

## Step 0 — Provision the VPS (you)

- **Hetzner Cloud**, CX22 (2 vCPU / 4 GB), Ubuntu 24.04, EU or US location.
- **CRITICAL:** open a Hetzner support ticket to **unblock outbound port 25** —
  do this first, it can take a few hours.
- Set **reverse DNS (PTR)** in the Hetzner console: VPS IP → `mail.phantomdefender.com`.

```bash
ssh root@YOUR_VPS_IP
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install -y postfix postfix-pgsql certbot
# Firewall: allow SSH/SMTP/HTTP/HTTPS; 5432 see Wrinkle 1.
ufw allow 22 && ufw allow 25 && ufw allow 80 && ufw allow 443 && ufw allow 5432 && ufw enable
```

## Step 1 — DNS in Cloudflare (you)

For `phantomdefender.com` (set the mail records to **DNS-only / grey cloud**, not proxied):

| Type | Name | Value | Notes |
|------|------|-------|-------|
| A | `mail` | `YOUR_VPS_IP` | grey cloud |
| MX | `@` | `mail.phantomdefender.com` (prio 10) | **replaces Cloudflare Email Routing** |
| TXT | `@` | `v=spf1 mx -all` | SPF |
| TXT | `dkim._domainkey` | `v=DKIM1; k=rsa; p=<DKIM_PUBLIC>` | from Step 2 |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@phantomdefender.com` | DMARC |

> Switching the MX record turns OFF Cloudflare Email Routing for the domain. Make
> sure the VPS is receiving mail before you fully cut over.

## Step 2 — DKIM keys (on the VPS)

```bash
mkdir -p /opt/phantomdefender && cd /opt/phantomdefender
openssl genrsa -out dkim.key 2048
openssl rsa -in dkim.key -pubout -out dkim.pub.key
grep -v '^-' dkim.pub.key | tr -d '\n'   # paste into the dkim._domainkey TXT record
```

## Step 3 — Bring up the engine (on the VPS)

```bash
cd /opt/phantomdefender
# Copy this repo's email-server/ here (git clone or scp), then:
cd email-server
cp .env.example .env && nano .env          # fill SL_DB_PASSWORD + TRACKER_WEBHOOK_SECRET
nano simplelogin.env                        # create it per .env.example header
cp ../dkim.key ../dkim.pub.key ./           # DKIM keys next to the compose file

docker compose up -d sl-db
docker compose run --rm sl-email alembic upgrade head   # init the SL schema
docker compose up -d                                    # start everything
docker compose ps
```

## Step 4 — Postfix → tracker-stripper (on the VPS)

Edit `/etc/postfix/main.cf` (key lines):

```
myhostname = mail.phantomdefender.com
myorigin = phantomdefender.com
inet_interfaces = all
mydestination = localhost
# Hand inbound mail to the tracker-stripper, which forwards to SimpleLogin:
virtual_mailbox_domains = pgsql:/etc/postfix/pgsql-virtual-mailbox-domains.cf
virtual_transport = smtp:127.0.0.1:20380
smtpd_helo_required = yes
smtpd_recipient_restrictions = reject_unauth_destination, reject_non_fqdn_recipient
```

`/etc/postfix/pgsql-virtual-mailbox-domains.cf`:

```
hosts = 127.0.0.1
user = sl_user
password = YOUR_SL_DB_PASSWORD
dbname = simplelogin
query = SELECT domain FROM custom_domain WHERE domain='%s' AND verified=true UNION SELECT '%s' WHERE '%s' = 'phantomdefender.com' LIMIT 1;
```

Then: `systemctl restart postfix`. (TLS: run `certbot certonly --standalone -d mail.phantomdefender.com` and add the cert paths to main.cf.)

## Step 5 — Create the SimpleLogin service user + custom domain

```bash
# One service user owns all Phantom Defender aliases:
docker compose run --rm sl-email python shell.py   # then create a user; note its id
# Register phantomdefender.com as a verified custom_domain for that user.
```
Note the user's **id** → that's `SIMPLELOGIN_SERVICE_USER_ID`.

## Step 6 — Point the app at the VPS (Vercel env, then redeploy)

Add these in Vercel (Production) and redeploy:

```
SIMPLELOGIN_DB_URI=postgresql://sl_user:PASSWORD@YOUR_VPS_IP:5432/simplelogin?sslmode=require
SIMPLELOGIN_SERVICE_USER_ID=<id from Step 5>
SIMPLELOGIN_WEBHOOK_SECRET=<random; for the future event webhook>
TRACKER_WEBHOOK_SECRET=<same value you put in email-server/.env>
EMAIL_WEBHOOK_SECRET=<random; for /api/v2/email/summarize>
```

Setting `SIMPLELOGIN_DB_URI` flips the app from the Cloudflare fallback to the
SimpleLogin path automatically (see `app/api/v2/aliases/route.ts`).

## Step 7 — Verify

- `echo "hi" | mail -s "test" anything@phantomdefender.com` → arrives at the
  forwarding inbox, trackers stripped (check `X-PhantomShield-Trackers-Stripped`).
- `docker compose logs -f tracker-stripper sl-email`
- **Deliverability:** send to a fresh address at https://mail-tester.com — aim 9–10/10.
  Confirm SPF + DKIM + DMARC all pass. Warm the IP slowly.

## Rollback

If anything's wrong, revert the Cloudflare MX record back to the Email Routing
values and unset `SIMPLELOGIN_DB_URI` in Vercel — the app returns to the
Cloudflare fallback with zero code changes.
