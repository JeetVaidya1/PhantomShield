"""Tracker-stripping logic for the Phantom Defender email pipeline (v2-015).

Pure, dependency-free functions so they can be unit-tested with the stdlib.
The SMTP server (main.py) imports these; runtime SMTP deps live only there.

Responsibilities:
  * Remove tracking pixels (1x1 / hidden images, or images from known tracker
    domains) from HTML email bodies.
  * Strip tracking query parameters (utm_*, fbclid, gclid, mc_eid, ...) from
    every href link.
  * Leave plain-text emails and legitimate images untouched.
"""

from __future__ import annotations

import json
import os
import re
from html import unescape
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

# Query parameters considered tracking noise and stripped from links.
TRACKING_PARAMS = frozenset(
    {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "utm_id",
        "mc_eid",
        "mc_cid",
        "fbclid",
        "gclid",
        "dclid",
        "gclsrc",
        "msclkid",
        "igshid",
        "yclid",
        "_hsenc",
        "_hsmi",
        "vero_id",
        "vero_conv",
        "oly_enc_id",
        "oly_anon_id",
        "wickedid",
        "twclid",
        "ml_subscriber",
        "ml_subscriber_hash",
        "ref_src",
    }
)

_IMG_TAG_RE = re.compile(r"<img\b[^>]*>", re.IGNORECASE | re.DOTALL)
_ATTR_RE = re.compile(r"""(\w[\w:-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s">]+))""")
_HREF_RE = re.compile(r"""(href\s*=\s*)("([^"]*)"|'([^']*)')""", re.IGNORECASE)
_STYLE_HIDDEN_RE = re.compile(
    r"(display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(\.0+)?\b)",
    re.IGNORECASE,
)


def _load_tracker_domains() -> frozenset[str]:
    path = os.path.join(os.path.dirname(__file__), "tracker_domains.json")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return frozenset(d.lower() for d in json.load(fh))
    except (OSError, ValueError):
        return frozenset()


TRACKER_DOMAINS = _load_tracker_domains()


def _parse_attrs(tag: str) -> dict[str, str]:
    attrs: dict[str, str] = {}
    for match in _ATTR_RE.finditer(tag):
        name = match.group(1).lower()
        value = match.group(3) or match.group(4) or match.group(5) or ""
        attrs[name] = value
    return attrs


def _host_of(url: str) -> str:
    try:
        return urlsplit(unescape(url)).hostname or ""
    except ValueError:
        return ""


def is_tracker_domain(host: str) -> bool:
    """True if host (or a parent domain) is a known tracker domain."""
    host = host.lower().strip(".")
    if not host:
        return False
    parts = host.split(".")
    for i in range(len(parts) - 1):
        candidate = ".".join(parts[i:])
        if candidate in TRACKER_DOMAINS:
            return True
    return host in TRACKER_DOMAINS


def _is_tracking_pixel(tag: str) -> bool:
    attrs = _parse_attrs(tag)

    # Explicit 1x1 (or smaller) dimensions.
    def _small(dim: str) -> bool:
        try:
            return int(re.sub(r"[^0-9-]", "", dim) or "99") <= 1
        except ValueError:
            return False

    width = attrs.get("width", "")
    height = attrs.get("height", "")
    if width and height and _small(width) and _small(height):
        return True

    # Hidden via inline style.
    if _STYLE_HIDDEN_RE.search(attrs.get("style", "")):
        return True

    # Image served from a known tracker domain.
    host = _host_of(attrs.get("src", ""))
    if host and is_tracker_domain(host):
        return True

    return False


def clean_link(url: str) -> tuple[str, bool]:
    """Strip tracking params from a URL. Returns (cleaned_url, was_changed)."""
    raw = unescape(url)
    try:
        parts = urlsplit(raw)
    except ValueError:
        return url, False

    if not parts.query:
        return url, False

    pairs = parse_qsl(parts.query, keep_blank_values=True)
    kept = [(k, v) for k, v in pairs if k.lower() not in TRACKING_PARAMS]
    if len(kept) == len(pairs):
        return url, False

    new_query = urlencode(kept)
    cleaned = urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))
    return cleaned, True


def strip_trackers(html: str) -> tuple[str, int, int]:
    """Strip tracking pixels and clean links from an HTML body.

    Returns (cleaned_html, trackers_stripped, links_cleaned).
    """
    if not html:
        return html, 0, 0

    trackers = 0
    links_cleaned = 0

    def _img_sub(match: re.Match[str]) -> str:
        nonlocal trackers
        tag = match.group(0)
        if _is_tracking_pixel(tag):
            trackers += 1
            return ""
        return tag

    cleaned = _IMG_TAG_RE.sub(_img_sub, html)

    def _href_sub(match: re.Match[str]) -> str:
        nonlocal links_cleaned
        prefix = match.group(1)
        quote = match.group(2)[0]
        inner = match.group(3) if match.group(3) is not None else match.group(4)
        new_url, changed = clean_link(inner or "")
        if changed:
            links_cleaned += 1
            return f"{prefix}{quote}{new_url}{quote}"
        return match.group(0)

    cleaned = _HREF_RE.sub(_href_sub, cleaned)

    return cleaned, trackers, links_cleaned
