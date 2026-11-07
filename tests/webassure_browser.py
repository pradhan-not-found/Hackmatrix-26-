"""End-to-end Next.js -> FastAPI -> SQLite checks; only outbound probes are mocked.

Build webassure first, then run unittest discovery with -p webassure_browser.py.
"""

import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from urllib.request import urlopen

import uvicorn
from playwright.sync_api import expect, sync_playwright


class WebAssureBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.directory.cleanup)
        environment = patch.dict(os.environ, {"INVESTIGATION_DB": f"{cls.directory.name}/reports.sqlite3"})
        environment.start()
        cls.addClassCleanup(environment.stop)

        def fetch(url, addresses):
            time.sleep(.5)
            return {"url": url, "status": 200, "headers": {}, "address": addresses[0],
                    "tls": {"verified": True, "protocol": "TLSv1.3", "issuer": {"commonName": "Test CA"}, "not_after": "Jan 1 00:00:00 2030 GMT"}}

        def reputation(urls):
            if any("malicious.example" in url for url in urls):
                return {"status": "completed", "source": "Test provider", "matches": [{"threatType": "MALWARE", "threat": {"url": urls[0]}}]}
            return {"status": "unavailable", "reason": "Test provider unavailable"}

        for name, options in (("public_addresses", {"return_value": ["8.8.8.8"]}),
                              ("fetch", {"side_effect": fetch}), ("reputation", {"side_effect": reputation})):
            mock = patch(f"backend.investigation.{name}", **options)
            mock.start()
            cls.addClassCleanup(mock.stop)

        backend_socket = socket.socket()
        backend_socket.bind(("127.0.0.1", 0))
        backend_url = f"http://127.0.0.1:{backend_socket.getsockname()[1]}"
        cls.server = uvicorn.Server(uvicorn.Config("backend.main:app", log_level="error"))
        thread = threading.Thread(target=cls.server.run, kwargs={"sockets": [backend_socket]}, daemon=True)
        thread.start()

        def stop_backend():
            cls.server.should_exit = True
            thread.join(timeout=5)
            backend_socket.close()

        cls.addClassCleanup(stop_backend)
        for _ in range(100):
            if cls.server.started:
                break
            time.sleep(.05)
        if not cls.server.started:
            raise RuntimeError("Test backend did not start")
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        cls.url = f"http://127.0.0.1:{port}"
        root = Path(__file__).resolve().parent.parent
        log = open(Path(cls.directory.name) / "next.log", "w", encoding="utf-8")
        cls.addClassCleanup(log.close)
        process = subprocess.Popen(
            [shutil.which("node"), "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", str(port)],
            cwd=root / "webassure", env={**os.environ, "BACKEND_URL": backend_url}, stdout=log, stderr=log,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )

        def stop_ui():
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)

        cls.addClassCleanup(stop_ui)
        for _ in range(100):
            try:
                with urlopen(cls.url, timeout=1) as response:
                    if response.status == 200:
                        break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError("Built Next.js UI did not start; run npm run build first")
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(channel="msedge", headless=True)
        cls.addClassCleanup(cls.browser.close)

    def test_real_submission_persistence_evidence_download_and_retries(self):
        page = self.browser.new_page(viewport={"width": 1440, "height": 1000})
        self.addCleanup(page.close)
        failures = []
        page.on("pageerror", lambda failure: failures.append(str(failure)))
        page.add_init_script("localStorage.setItem('wa-user', JSON.stringify({name: 'Test user', email: 'test@example.com'}))")
        page.goto(self.url + "/dashboard/scans")
        expect(page.get_by_text("No saved investigations", exact=True)).to_be_visible()
        page.get_by_label("URL to scan", exact=True).fill("https://example.com")

        def fail_submission(route):
            if route.request.method == "POST":
                route.fulfill(status=503, json={"detail": "Test scanner temporarily unavailable"})
            else:
                route.continue_()

        page.route("**/api/investigations", fail_submission)
        page.get_by_role("button", name="Scan", exact=True).click()
        expect(page.locator('.dash__err[role="alert"]')).to_contain_text("Test scanner temporarily unavailable")
        page.unroute("**/api/investigations", fail_submission)
        with page.expect_response(lambda response: response.request.method == "POST" and response.url.endswith("/api/investigations")) as response_event:
            page.get_by_role("button", name="Retry scan", exact=True).click()
            expect(page.get_by_role("button", name="Scanning…", exact=True)).to_be_disabled()
        report = response_event.value.json()
        self.assertEqual(report["risk_classification"], "Inconclusive")
        dialog = page.get_by_role("dialog", name="Scan details")
        expect(dialog).to_be_visible()
        expect(dialog.get_by_text("Inconclusive", exact=True)).to_be_visible()
        expect(dialog.get_by_text("Test provider unavailable", exact=True).first).to_be_visible()
        expect(dialog.get_by_text("Local rules · Rule-based explanation", exact=True)).to_be_visible()
        self.assertGreater(dialog.locator('svg[aria-hidden="true"]').count(), 10)
        expect(dialog.get_by_role("heading", name="Domain identity", exact=True)).to_be_visible()
        expect(dialog.locator('.analysis-coverage-top')).to_contain_text('implemented checks')
        implemented = [check for check in report['evidence_coverage']['checks'] if check['status'] != 'not_implemented']
        not_assessed = [check for check in report['evidence_coverage']['checks'] if check['status'] == 'not_implemented']
        expect(dialog.locator('.analysis-check-cell')).to_have_count(len(implemented))
        expect(dialog.locator('.analysis-coverage-bar > span')).to_have_count(len(implemented))
        expect(dialog.locator('.analysis-not-assessed li')).to_have_count(len(not_assessed))
        expect(dialog.locator('.analysis-check-grid')).not_to_contain_text('HTML inspection')
        expect(dialog.get_by_role('heading', name='Not assessed', exact=True)).to_be_visible()
        coverage = dialog.get_by_text("Completed, incomplete & unimplemented checks", exact=True)
        coverage.click()
        expect(coverage.locator('..').locator('pre')).to_contain_text('"status": "not_implemented"')
        domains = dialog.get_by_text("Domain identity & URL indicators", exact=True)
        domains.click()
        expect(domains.locator('..').locator('pre')).to_contain_text('"registrable_domain": "example.com"')
        dialog.get_by_text("Assessment decision", exact=True).click()
        expect(dialog.get_by_text("Assessment decision", exact=True).locator('..').locator('pre')).to_contain_text('insufficient_core_coverage')
        dialog.get_by_text("Certificate & TLS details", exact=True).click()
        expect(dialog.get_by_text("Certificate & TLS details", exact=True).locator('..').locator('pre')).to_contain_text('"protocol": "TLSv1.3"')
        with page.expect_download() as event:
            dialog.get_by_role("button", name="Export report JSON", exact=True).click()
        self.assertEqual(json.loads(Path(event.value.path()).read_text()), report)
        detail_route = '**/api/investigations/' + report['id']
        page.route(detail_route, lambda route: route.fulfill(status=502, json={"detail": "Test report temporarily unavailable"}))
        page.reload()
        dialog = page.get_by_role("dialog", name="Scan details")
        expect(dialog).to_be_visible()
        expect(dialog.get_by_role("alert")).to_contain_text("Test report temporarily unavailable")
        page.unroute(detail_route)
        dialog.get_by_role("button", name="Retry report", exact=True).click()
        expect(dialog.get_by_text(report["id"], exact=False).first).to_be_visible()
        dialog.get_by_role("button", name="Close report", exact=True).click()
        page.get_by_role("link", name="Reports", exact=True).click()
        expect(page.get_by_role("button", name="Download JSON", exact=True)).to_be_visible()
        with page.expect_download() as event:
            page.get_by_role("button", name="Download JSON", exact=True).click()
        self.assertEqual(json.loads(Path(event.value.path()).read_text())["id"], report["id"])
        page.get_by_role("link", name="Open report", exact=True).click()
        expect(page.get_by_role("dialog", name="Scan details")).to_be_visible()
        page.get_by_role("button", name="Close report", exact=True).click()

        page.route("**/api/investigations?*", lambda route: route.fulfill(status=502, json={"detail": "Test history unavailable"}))
        page.get_by_role("button", name="Refresh history", exact=True).click()
        expect(page.get_by_role("alert").filter(has_text="Test history unavailable")).to_be_visible()
        page.unroute("**/api/investigations?*")
        page.get_by_role("button", name="Retry history", exact=True).click()
        expect(page.get_by_role("button", name="Refresh history", exact=True)).to_be_enabled()

        page.get_by_label("URL to scan", exact=True).fill("https://malicious.example")
        page.get_by_role("button", name="Scan", exact=True).click()
        dialog = page.get_by_role("dialog", name="Scan details")
        expect(dialog.get_by_text("Confirmed Malicious", exact=True)).to_be_visible()
        dialog.get_by_role("button", name="Close report", exact=True).click()
        page.get_by_role("tab", name="Malicious", exact=True).click()
        expect(page.locator("tbody tr")).to_have_count(1)
        page.set_viewport_size({"width": 390, "height": 844})
        self.assertTrue(page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        page.get_by_role("button", name="Open report for https://malicious.example/", exact=True).click()
        expect(page.get_by_role("dialog", name="Scan details")).to_be_visible()
        expect(page.get_by_role("dialog", name="Scan details")).to_be_in_viewport(ratio=1)
        page.screenshot(path="data/webassure-report-mobile.png", full_page=True)
        page.set_viewport_size({"width": 1440, "height": 1000})
        page.screenshot(path="data/webassure-report-desktop.png", full_page=True)
        dialog.get_by_role("heading", name="Redirects & TLS", exact=True).scroll_into_view_if_needed()
        expect(dialog.locator('.analysis-tls')).to_be_visible()
        page.screenshot(path="data/webassure-report-tls.png", full_page=True)
        dialog.get_by_role("button", name="Close report", exact=True).click()
        page.get_by_role("button", name="Switch to dark theme", exact=True).click()
        expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
        page.get_by_role("button", name="Open report for https://malicious.example/", exact=True).click()
        expect(dialog).to_be_visible()
        expect(dialog).to_have_css('opacity', '1')
        page.screenshot(path="data/webassure-report-dark.png", full_page=True, animations="disabled")
        dialog.get_by_role("button", name="Close report", exact=True).click()
        from backend.main import database
        connection = database()
        with connection:
            for index in range(31):
                item = {**report, "id": f"00000000-0000-0000-0000-{index:012d}",
                        "normalized_url": f"https://saved-{index}.example/"}
                connection.execute("INSERT INTO investigations VALUES (?, ?)", (item['id'], json.dumps(item)))
        connection.close()
        page.get_by_role("tab", name="All", exact=True).click()
        page.get_by_role("button", name="Refresh history", exact=True).click()
        expect(page.get_by_text("30 of 33 saved investigations loaded", exact=True)).to_be_visible()
        page.get_by_role("button", name="Load more", exact=True).click()
        expect(page.get_by_text("33 of 33 saved investigations loaded", exact=True)).to_be_visible()
        expect(page.locator("tbody tr")).to_have_count(33)
        self.assertEqual(failures, [])
