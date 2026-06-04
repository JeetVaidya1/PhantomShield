"""Stdlib unit tests for the tracker stripper (v2-015).

Run: python3 -m unittest discover -s email-server/tracker-stripper
No third-party deps required (aiosmtpd is only needed to run the server).
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))

from stripper import strip_trackers, clean_link, is_tracker_domain  # noqa: E402


class TestStripTrackers(unittest.TestCase):
    def test_mailchimp_pixel_removed(self):
        html = (
            '<p>Hello</p>'
            '<img src="https://list-manage.com/track/open.php?u=1" width="1" height="1">'
        )
        cleaned, trackers, links = strip_trackers(html)
        self.assertEqual(trackers, 1)
        self.assertNotIn("list-manage.com", cleaned)

    def test_tracker_domain_pixel_without_dimensions(self):
        html = '<img src="https://ct.sendgrid.net/open?id=abc">'
        cleaned, trackers, _ = strip_trackers(html)
        self.assertEqual(trackers, 1)
        self.assertEqual(cleaned.strip(), "")

    def test_hidden_pixel_by_style(self):
        html = '<img src="https://example.com/p.gif" style="display:none">'
        _, trackers, _ = strip_trackers(html)
        self.assertEqual(trackers, 1)

    def test_three_utm_links_cleaned(self):
        html = (
            '<a href="https://shop.com/a?utm_source=x&utm_medium=email&id=1">A</a>'
            '<a href="https://shop.com/b?utm_campaign=y">B</a>'
            '<a href="https://shop.com/c?fbclid=z&keep=1">C</a>'
        )
        cleaned, _, links = strip_trackers(html)
        self.assertEqual(links, 3)
        self.assertNotIn("utm_source", cleaned)
        self.assertNotIn("fbclid", cleaned)
        # Legitimate params are preserved.
        self.assertIn("id=1", cleaned)
        self.assertIn("keep=1", cleaned)

    def test_no_trackers_forwarded_unchanged(self):
        html = '<p>Hi</p><a href="https://shop.com/x">link</a><img src="https://cdn.shop.com/logo.png" width="200" height="60">'
        cleaned, trackers, links = strip_trackers(html)
        self.assertEqual(trackers, 0)
        self.assertEqual(links, 0)
        self.assertEqual(cleaned, html)

    def test_legitimate_image_not_stripped(self):
        html = '<img src="https://cdn.shop.com/hero.jpg" width="600" height="400">'
        _, trackers, _ = strip_trackers(html)
        self.assertEqual(trackers, 0)

    def test_plain_text_unchanged(self):
        text = "Plain text email, visit https://x.com?utm_source=foo for more"
        cleaned, trackers, links = strip_trackers(text)
        # No HTML tags -> no img stripping; bare text URL is not an href.
        self.assertEqual(trackers, 0)
        self.assertEqual(links, 0)
        self.assertEqual(cleaned, text)

    def test_malformed_html_does_not_crash(self):
        html = '<img src="https://list-manage.com/x" width="1" height="1" <a href="broken'
        cleaned, trackers, _ = strip_trackers(html)
        self.assertIsInstance(cleaned, str)
        self.assertGreaterEqual(trackers, 0)

    def test_empty_body(self):
        self.assertEqual(strip_trackers(""), ("", 0, 0))


class TestCleanLink(unittest.TestCase):
    def test_strips_only_tracking_params(self):
        url, changed = clean_link("https://x.com/p?utm_source=a&page=2")
        self.assertTrue(changed)
        self.assertIn("page=2", url)
        self.assertNotIn("utm_source", url)

    def test_no_change_when_clean(self):
        url, changed = clean_link("https://x.com/p?page=2")
        self.assertFalse(changed)
        self.assertEqual(url, "https://x.com/p?page=2")


class TestTrackerDomains(unittest.TestCase):
    def test_known_domains_loaded(self):
        self.assertTrue(is_tracker_domain("list-manage.com"))
        self.assertTrue(is_tracker_domain("ct.sendgrid.net"))  # subdomain match
        self.assertFalse(is_tracker_domain("github.com"))


if __name__ == "__main__":
    unittest.main()
