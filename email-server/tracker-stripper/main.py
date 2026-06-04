"""Phantom Defender tracker-stripper SMTP proxy (v2-015).

Sits between Postfix and SimpleLogin:

    Postfix (25) -> tracker-stripper (20380) -> SimpleLogin (20381)

For each message it strips tracking pixels and cleans tracking links from the
HTML body, adds X-PhantomShield-* headers, forwards the cleaned message to
SimpleLogin, and POSTs per-email stats to the configurable webhook.

Plain-text-only messages are forwarded unchanged.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import smtplib
import urllib.request
from email import message_from_bytes
from email.message import Message

from aiosmtpd.controller import Controller
from aiosmtpd.smtp import SMTP, Envelope, Session

from stripper import strip_trackers

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("tracker-stripper")

LISTEN_HOST = os.environ.get("STRIPPER_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("STRIPPER_PORT", "20380"))
FORWARD_HOST = os.environ.get("SIMPLELOGIN_HOST", "127.0.0.1")
FORWARD_PORT = int(os.environ.get("SIMPLELOGIN_PORT", "20381"))
STATS_WEBHOOK_URL = os.environ.get("TRACKER_STATS_WEBHOOK_URL", "")
STATS_WEBHOOK_SECRET = os.environ.get("TRACKER_WEBHOOK_SECRET", "")


def process_message(raw: bytes) -> tuple[bytes, int, int]:
    """Strip trackers from a raw RFC822 message. Returns (new_raw, trackers, links)."""
    msg: Message = message_from_bytes(raw)
    total_trackers = 0
    total_links = 0

    if msg.is_multipart():
        parts = msg.walk()
    else:
        parts = [msg]

    for part in parts:
        if part.get_content_type() != "text/html":
            continue
        payload = part.get_payload(decode=True)
        if payload is None:
            continue
        charset = part.get_content_charset() or "utf-8"
        try:
            html = payload.decode(charset, errors="replace")
        except (LookupError, ValueError):
            html = payload.decode("utf-8", errors="replace")

        cleaned, trackers, links = strip_trackers(html)
        total_trackers += trackers
        total_links += links
        if trackers or links:
            del part["Content-Transfer-Encoding"]
            part.set_payload(cleaned, charset=charset)

    msg["X-PhantomShield-Trackers-Stripped"] = str(total_trackers)
    msg["X-PhantomShield-Links-Cleaned"] = str(total_links)
    return msg.as_bytes(), total_trackers, total_links


def post_stats(rcpt: str, trackers: int, links: int, sender: str, subject: str) -> None:
    if not STATS_WEBHOOK_URL:
        return
    body = json.dumps(
        {
            "alias_email": rcpt,
            "trackers_stripped": trackers,
            "links_cleaned": links,
            "email_from": sender,
            "email_subject": subject,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        STATS_WEBHOOK_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {STATS_WEBHOOK_SECRET}",
        },
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=5).close()
    except OSError as exc:  # never block delivery on stats failure
        log.warning("stats POST failed: %s", exc)


class StripperHandler:
    async def handle_DATA(self, server: SMTP, session: Session, envelope: Envelope) -> str:
        try:
            cleaned, trackers, links = process_message(envelope.content)
        except Exception as exc:  # malformed message -> forward unchanged
            log.warning("strip failed, forwarding unchanged: %s", exc)
            cleaned, trackers, links = envelope.content, 0, 0

        try:
            with smtplib.SMTP(FORWARD_HOST, FORWARD_PORT, timeout=30) as client:
                client.sendmail(envelope.mail_from, envelope.rcpt_tos, cleaned)
        except OSError as exc:
            log.error("forward to SimpleLogin failed: %s", exc)
            return "451 Temporary forwarding failure"

        parsed = message_from_bytes(envelope.content)
        for rcpt in envelope.rcpt_tos:
            post_stats(rcpt, trackers, links, envelope.mail_from, parsed.get("Subject", ""))

        return "250 Message accepted for delivery"


def main() -> None:
    controller = Controller(StripperHandler(), hostname=LISTEN_HOST, port=LISTEN_PORT)
    controller.start()
    log.info("tracker-stripper listening on %s:%s -> %s:%s", LISTEN_HOST, LISTEN_PORT, FORWARD_HOST, FORWARD_PORT)
    try:
        asyncio.get_event_loop().run_forever()
    except KeyboardInterrupt:
        controller.stop()


if __name__ == "__main__":
    main()
