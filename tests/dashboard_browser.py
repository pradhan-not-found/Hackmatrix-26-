"""Browser interaction checks using installed Microsoft Edge; no outbound scans."""

import json
import socket
import threading
import time
import unittest

import uvicorn
from playwright.sync_api import sync_playwright


REPORT = {
    "id": "00000000-0000-0000-0000-000000000001",
    "submitted_url": "https://example.com", "normalized_url": "https://example.com/",
    "created_at": "2026-11-07T09:00:00+00:00", "completed_at": "2026-11-07T09:00:01+00:00",
    "status": "completed", "risk_classification": "Suspicious",
    "evidence_coverage": {"network_complete": True, "reputation_available": False},
    "findings": [{"id": "finding-1", "severity": "medium", "category": "test",
                  "description": "<img src=x onerror=window.injected=true>",
                  "evidence": {"reason": "test fixture"}, "source": "browser test",
                  "observed_at": "2026-11-07T09:00:00+00:00"}],
    "checks": [{"name": "dns", "status": "completed", "addresses": ["8.8.8.8"]},
               {"name": "threat_intelligence", "status": "unavailable", "reason": "No API key"}],
    "redirect_chain": [{"url": "https://example.com/", "status": 200,
                        "address": "8.8.8.8", "headers": {"server": "test"},
                        "tls": {"verified": True, "protocol": "TLSv1.3"}}],
    "recommendations": ["Review the evidence."], "limitations": ["Reputation unavailable."],
}


class DashboardBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.socket = socket.socket()
        cls.socket.bind(("127.0.0.1", 0))
        cls.url = f"http://127.0.0.1:{cls.socket.getsockname()[1]}"
        cls.server = uvicorn.Server(uvicorn.Config("backend.main:app", log_level="error"))
        cls.thread = threading.Thread(target=cls.server.run, kwargs={"sockets": [cls.socket]}, daemon=True)
        cls.thread.start()
        for _ in range(100):
            if cls.server.started:
                break
            time.sleep(.05)
        if not cls.server.started:
            raise RuntimeError("Preview server failed to start")
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(channel="msedge", headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.should_exit = True
        cls.thread.join(timeout=5)
        cls.socket.close()

    def test_submission_history_tabs_export_errors_and_mobile(self):
        page = self.browser.new_page(viewport={"width": 1440, "height": 1050})
        self.addCleanup(page.close)
        failures = []
        page.on("pageerror", lambda failure: failures.append(str(failure)))

        def api(route):
            request = route.request
            if request.url.endswith("/explanation"):
                route.fulfill(json={"status": "completed", "model": "gemini-test",
                    "generated_at": REPORT["completed_at"],
                    "summary": {"text": "Reputation verification is unavailable.", "evidence_ids": ["assessment"]},
                    "explanations": [], "next_steps": [],
                    "evidence": [{"id": "assessment", "risk_classification": "Suspicious"}]})
            elif request.method == "POST":
                self.assertEqual(request.post_data_json["url"], "https://example.com")
                route.fulfill(status=201, json=REPORT)
            elif request.url.split("?")[0].endswith(REPORT["id"]):
                route.fulfill(json=REPORT)
            else:
                route.fulfill(json={"items": [REPORT], "total": 1})

        page.route("**/api/investigations**", api)
        page.goto(self.url)
        page.get_by_text("Backend online", exact=True).wait_for()
        page.get_by_role("button", name="Use example.com").click()
        page.get_by_role("button", name="Investigate URL").click()
        page.locator("#report").wait_for(state="visible")
        self.assertEqual(page.locator("#risk").inner_text(), "Suspicious")
        self.assertEqual(page.locator("#reputation-coverage").inner_text(), "Unavailable")
        self.assertIsNone(page.evaluate("window.injected"))
        page.get_by_text("View supporting evidence").click()
        self.assertIn("test fixture", page.locator("#findings pre").inner_text())
        page.get_by_role("tab", name="Checks", exact=True).click()
        page.get_by_text("No API key", exact=True).wait_for()
        page.get_by_role("tab", name="Checks", exact=True).press("ArrowRight")
        self.assertEqual(page.locator("#tab-redirects").get_attribute("aria-selected"), "true")
        self.assertIn("TLSv1.3", page.locator("#redirects").inner_text())
        page.get_by_role("tab", name="Raw JSON").click()
        self.assertEqual(json.loads(page.locator("#raw-json").inner_text()), REPORT)
        with page.expect_download() as event:
            page.get_by_role("button", name="Export JSON").click()
        self.assertEqual(json.loads(event.value.path().read_text()), REPORT)
        page.get_by_role("button", name="Explain findings", exact=True).click()
        page.get_by_text("Reputation verification is unavailable.", exact=True).wait_for()
        page.get_by_text("Supporting evidence: assessment", exact=True).click()
        self.assertIn("Suspicious", page.locator("#ai-content pre").inner_text())
        self.assertEqual(page.locator("#risk").inner_text(), "Suspicious")
        page.route("**/explanation", lambda route: route.fulfill(json={"status": "unavailable", "reason": "Gemini quota exceeded."}))
        page.get_by_role("button", name="Explain again", exact=True).click()
        page.get_by_text("Gemini quota exceeded.", exact=True).wait_for()
        self.assertTrue(page.get_by_role("button", name="Explain findings", exact=True).is_enabled())
        page.unroute("**/explanation")
        page.reload()
        page.locator("#report").wait_for(state="visible")
        page.get_by_role("button", name="New investigation").click()
        self.assertTrue(page.locator("#empty-state").is_visible())
        page.locator(".history-item").click()
        page.locator("#report").wait_for(state="visible")
        page.set_viewport_size({"width": 390, "height": 844})
        self.assertTrue(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))
        page.screenshot(path="data/dashboard-mobile.png", full_page=True)
        page.set_viewport_size({"width": 1440, "height": 1050})
        page.screenshot(path="data/dashboard-desktop.png", full_page=True)
        page.route("**/api/investigations", lambda route: route.fulfill(status=429, json={"detail": "Capacity reached"}))
        page.get_by_role("button", name="Investigate URL").click()
        page.get_by_role("alert").wait_for()
        self.assertIn("Capacity reached", page.get_by_role("alert").inner_text())
        self.assertTrue(page.get_by_role("button", name="Investigate URL").is_enabled())
        self.assertEqual(failures, [])
