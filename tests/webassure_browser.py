"""Offline browser regression: mocked Supabase Auth, real proxy/API, isolated storage.

Build webassure first, then run unittest discovery with -p webassure_browser.py.
"""

import json
import base64
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
from urllib.request import Request, urlopen

import uvicorn
from playwright.sync_api import expect, sync_playwright
from fastapi import Depends
from backend.main import app
from backend.supabase import authenticated_user, investigation_store
from tests.support_store import SQLiteFixtureStore

USER = {'id': '00000000-0000-0000-0000-000000000100', 'email': 'test@example.com', 'aud': 'authenticated',
        'role': 'authenticated', 'user_metadata': {'name': 'Test user'}, 'app_metadata': {'provider': 'email'}}


def test_session():
    expires = int(time.time()) + 3600
    encode = lambda value: base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    token = encode({'alg': 'HS256', 'typ': 'JWT'}) + '.' + encode({'sub': USER['id'], 'exp': expires, 'aud': 'authenticated', 'role': 'authenticated'}) + '.test-signature'
    return {'access_token': token, 'refresh_token': 'offline-refresh-token', 'token_type': 'bearer', 'expires_at': expires, 'expires_in': 3600, 'user': USER}


class WebAssureBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.directory.cleanup)
        environment = patch.dict(os.environ, {"INVESTIGATION_DB": f"{cls.directory.name}/reports.sqlite3", 'EMAIL_ANALYSIS_DB': f'{cls.directory.name}/emails.sqlite3'})
        environment.start()
        cls.addClassCleanup(environment.stop)
        def fixture_store(principal=Depends(authenticated_user)):
            return SQLiteFixtureStore()
        original_overrides = app.dependency_overrides.copy()
        app.dependency_overrides[investigation_store] = fixture_store
        def restore_overrides():
            app.dependency_overrides.clear()
            app.dependency_overrides.update(original_overrides)
        cls.addClassCleanup(restore_overrides)
        auth = patch('backend.supabase.request_supabase', return_value=(USER, {}))
        auth.start()
        cls.addClassCleanup(auth.stop)

        def fetch(url, addresses):
            time.sleep(.5)
            return {"url": url, "status": 200, "headers": {}, "address": addresses[0],
                    "tls": {"verified": True, "protocol": "TLSv1.3", "issuer": {"commonName": "Test CA"}, "not_after": "Jan 1 00:00:00 2030 GMT"},
                    "html": {"status": "completed", "bytes_read": 28, "text": "<title>Example workspace</title>"}}

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

    def test_account_login_profile_preferences_password_recovery_and_logout(self):
        page = self.browser.new_page(viewport={'width': 1440, 'height': 1000})
        self.addCleanup(page.close)
        current_user = json.loads(json.dumps(USER))
        updates = []
        recovered = []
        page.add_init_script("localStorage.setItem('wa-cookies', JSON.stringify({choice: 'essential'}))")
        def auth_response(route):
            path = route.request.url
            if '/token' in path:
                route.fulfill(json=test_session())
            elif '/recover' in path:
                recovered.append(route.request.post_data_json)
                route.fulfill(json={})
            elif '/logout' in path:
                route.fulfill(status=204)
            elif '/user' in path:
                if route.request.method == 'PUT':
                    body = route.request.post_data_json
                    updates.append(body)
                    current_user['user_metadata'].update(body.get('data', {}))
                route.fulfill(json=current_user)
            else:
                route.fulfill(status=400, json={'message': 'Unexpected auth test request'})
        page.route('**/auth/v1/**', auth_response)
        page.goto(self.url + '/login')
        page.get_by_label('Work email', exact=True).fill(USER['email'])
        page.locator('input[type=password]').fill('test-password-123')
        page.get_by_role('button', name='Log in', exact=True).click()
        expect(page.locator('.greet .dash__title')).to_be_visible()
        page.get_by_role('link', name='Settings', exact=True).click()
        page.get_by_label('Full name', exact=True).fill('Updated profile')
        page.get_by_role('button', name='Save changes', exact=True).click()
        expect(page.get_by_role('button', name='Saved', exact=True)).to_be_visible()
        self.assertEqual(current_user['user_metadata']['name'], 'Updated profile')
        image_bytes = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY5kAAAAASUVORK5CYII=')
        uploads = []
        def avatar_upload(route):
            uploads.append(route.request.url)
            route.fulfill(json={'Key': USER['id'] + '/profile.jpg'})
        page.route('**/storage/v1/object/avatars/**', avatar_upload)
        page.route('**/storage/v1/object/public/avatars/**', lambda route: route.fulfill(body=image_bytes, content_type='image/png'))
        page.locator('input[type=file]').set_input_files({'name': 'avatar.png', 'mimeType': 'image/png', 'buffer': image_bytes})
        expect(page.locator('.photo__img img')).to_have_attribute('src', __import__('re').compile('/storage/v1/object/public/avatars/'))
        self.assertEqual(len(uploads), 1)
        self.assertIn(USER['id'] + '/profile.jpg', uploads[0])
        self.assertFalse(current_user['user_metadata']['avatar'].startswith('data:'))
        page.get_by_role('switch', name='Weekly summary', exact=True).click()
        page.get_by_role('button', name='Save preferences', exact=True).click()
        expect(page.get_by_role('status')).to_contain_text('Preferences saved.')
        self.assertTrue(current_user['user_metadata']['preferences']['weekly'])
        page.reload()
        expect(page.get_by_role('switch', name='Weekly summary', exact=True)).to_have_attribute('aria-checked', 'true')
        page.get_by_role('button', name='Send password reset email', exact=True).click()
        expect(page.get_by_role('status')).to_contain_text('Check your email')
        self.assertEqual(recovered[-1]['email'], USER['email'])
        page.goto(self.url + '/auth/reset-password')
        page.get_by_label('New password', exact=True).fill('new-password-123')
        page.get_by_label('Confirm password', exact=True).fill('mismatch-123')
        page.get_by_role('button', name='Save password', exact=True).click()
        expect(page.locator('.auth__error[role=alert]')).to_have_text('Passwords do not match.')
        page.get_by_label('Confirm password', exact=True).fill('new-password-123')
        page.get_by_role('button', name='Save password', exact=True).click()
        expect(page.get_by_role('status')).to_have_text('Your password has been updated.')
        self.assertEqual(updates[-1]['password'], 'new-password-123')
        page.goto(self.url + '/dashboard/settings')
        page.locator('.st__danger').get_by_role('button', name='Log out', exact=True).click()
        expect(page).to_have_url(self.url + '/login')
        page.goto(self.url + '/dashboard/scans')
        expect(page).to_have_url(self.url + '/login?next=%2Fdashboard%2Fscans')

    def test_z_correlated_threats_observed_redirects_and_evidence(self):
        def fetch(url, addresses):
            redirected = 'shared.example' not in url
            return {'url': url, 'status': 302 if redirected else 200, 'address': addresses[0],
                    'headers': {'location': 'https://shared.example/entry'} if redirected else {},
                    'tls': {'verified': True, 'protocol': 'TLSv1.3'}, 'html': {'status': 'not_applicable'}}
        replacement = patch('backend.investigation.fetch', side_effect=fetch)
        replacement.start()
        self.addCleanup(replacement.stop)
        page = self.browser.new_page(viewport={'width': 1440, 'height': 1000})
        self.addCleanup(page.close)
        failures = []
        page.on('pageerror', lambda failure: failures.append(str(failure)))
        page.route('**/auth/v1/user', lambda route: route.fulfill(json=USER))
        page.add_init_script("localStorage.setItem('wa-cookies', JSON.stringify({choice: 'essential'}))")
        page.add_init_script("localStorage.setItem('sb-ldrspcimsdzazhbckmca-auth-token', JSON.stringify(" + json.dumps(test_session()) + "))")
        page.goto(self.url + '/dashboard/scans')
        for host in ['malicious.example', 'second.example']:
            page.get_by_label('URL to scan', exact=True).fill('https://' + host)
            page.get_by_role('button', name='Scan', exact=True).click()
            dialog = page.get_by_role('dialog', name='Scan details')
            expect(dialog).to_be_visible()
            dialog.get_by_role('button', name='Close report').click()
        page.get_by_role('link', name='Threats', exact=True).click()
        group = page.locator('.correlation-group').filter(has_text='shared.example')
        expect(group).to_be_visible()
        expect(group).to_contain_text('Shared redirect destination')
        expect(group).to_contain_text('2 investigations')
        expect(group).to_contain_text('Confirmed Malicious')
        expect(group).to_contain_text('Inconclusive')
        group.get_by_role('button', name='Open evidence report for second.example', exact=True).click()
        dialog = page.get_by_role('dialog', name='Scan details')
        expect(dialog.get_by_text('Inconclusive', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Close report').click()
        page.get_by_label('Filter related indicators').fill('no-match.example')
        expect(page.locator('.correlation-group')).to_have_count(0)
        page.get_by_label('Filter related indicators').fill('shared.example')
        expect(group).to_be_visible()
        page.set_viewport_size({'width': 390, 'height': 844})
        self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        self.assertEqual(failures, [])

    def test_z_email_frontend_paste_headers_eml_and_private_history(self):
        page = self.browser.new_page(viewport={'width': 1440, 'height': 1000})
        self.addCleanup(page.close)
        failures = []
        page.on('pageerror', lambda failure: failures.append(str(failure)))
        page.route('**/auth/v1/user', lambda route: route.fulfill(json=USER))
        page.add_init_script("localStorage.setItem('wa-cookies', JSON.stringify({choice: 'essential'}))")
        page.add_init_script("localStorage.setItem('sb-ldrspcimsdzazhbckmca-auth-token', JSON.stringify(" + json.dumps(test_session()) + "))")
        page.goto(self.url + '/dashboard')
        page.get_by_role('link', name='Email analysis', exact=True).click()
        page.get_by_role('button', name='Try scam sample', exact=True).click()
        expect(page.get_by_label('Include Gemini insights')).not_to_be_checked()
        with page.expect_response(lambda response: response.request.method == 'POST' and response.url.endswith('/api/email/analyze')) as created:
            page.get_by_role('button', name='Analyse email', exact=True).click()
        first = created.value.json()
        self.assertEqual(created.value.status, 200)
        result = page.get_by_role('region', name='Email analysis results')
        expect(result).to_be_visible()
        expect(result).to_contain_text('Urgent account verification')
        expect(result).to_contain_text('Not provided')
        with page.expect_download() as export:
            result.get_by_role('button', name='Export email report').click()
        self.assertEqual(json.loads(Path(export.value.path()).read_text(encoding='utf8'))['id'], first['id'])
        page.get_by_role('tab', name='Raw headers', exact=True).click()
        page.get_by_label('Raw email headers', exact=True).fill('From: colleague@example.com\nSubject: Header sample\nAuthentication-Results: mx.example.com; spf=pass; dkim=pass; dmarc=pass')
        page.get_by_role('button', name='Analyse email', exact=True).click()
        expect(result.locator('.email-auth')).to_contain_text('PASS')
        page.get_by_role('tab', name='Upload .eml', exact=True).click()
        page.get_by_label('Email file', exact=True).set_input_files({'name': 'sample.eml', 'mimeType': 'message/rfc822', 'buffer': b'From: colleague@example.com\nSubject: Uploaded sample\n\nMeeting at ten tomorrow.'})
        page.get_by_role('button', name='Analyse email', exact=True).click()
        expect(result).to_contain_text('Uploaded sample')
        expect(page.locator('.email-history tbody tr')).to_have_count(3)
        page.reload()
        expect(page.locator('.email-history tbody tr')).to_have_count(3)
        page.get_by_role('button', name='Open email report Urgent account verification', exact=True).click()
        expect(page.get_by_role('region', name='Email analysis results')).to_contain_text('Urgent account verification')
        page.set_viewport_size({'width': 390, 'height': 844})
        self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        self.assertEqual(failures, [])

    def test_z_report_gemini_insights_retry_save_and_reuse(self):
        from backend.gemini import insight_fingerprint, INSIGHT_VERSION
        def insights(report):
            return {'status': 'completed', 'provider': 'Gemini', 'model': 'gemini-test',
                    'generated_at': '2026-11-08T08:00:00Z', 'insight_version': INSIGHT_VERSION,
                    'input_fingerprint': insight_fingerprint(report),
                    'summary': {'text': 'Missing browser protections require owner review, without establishing phishing.', 'evidence_ids': ['finding-1']},
                    'explanations': [{'text': 'The response omitted selected security headers.', 'evidence_ids': ['finding-1']}],
                    'next_steps': [{'text': 'Website owner: configure the missing headers and rescan.', 'evidence_ids': ['finding-1']}],
                    'evidence': [{'id': 'finding-1', 'category': 'configuration'}]}
        sequence = [{'status': 'unavailable', 'reason': 'Test provider temporarily unavailable'}, insights]
        def generate(report):
            value = sequence.pop(0)
            return value(report) if callable(value) else value
        mock = patch('backend.main.explain', side_effect=generate).start()
        self.addCleanup(patch.stopall)
        page = self.browser.new_page(viewport={'width': 1440, 'height': 1000})
        self.addCleanup(page.close)
        page.route('**/auth/v1/user', lambda route: route.fulfill(json=USER))
        page.add_init_script("localStorage.setItem('wa-cookies', JSON.stringify({choice: 'essential'}))")
        page.add_init_script("localStorage.setItem('sb-ldrspcimsdzazhbckmca-auth-token', JSON.stringify(" + json.dumps(test_session()) + "))")
        page.goto(self.url + '/dashboard/scans')
        page.get_by_label('URL to scan', exact=True).fill('https://insights.example')
        page.get_by_role('button', name='Scan', exact=True).click()
        section = page.locator('.analysis-explanation')
        section.get_by_role('button', name='Generate AI insights', exact=True).click()
        expect(section.get_by_role('alert')).to_contain_text('Test provider temporarily unavailable')
        section.get_by_role('button', name='Retry AI insights', exact=True).click()
        expect(section.locator('.report-insight-grid')).to_be_visible()
        expect(section).to_contain_text('Missing browser protections require owner review')
        expect(section).to_contain_text('What matters')
        expect(section).to_contain_text('Website owner: configure the missing headers')
        page.reload()
        expect(page.locator('.report-insight-grid')).to_be_visible()
        expect(page.get_by_role('button', name='Generate AI insights', exact=True)).to_have_count(0)
        self.assertEqual(mock.call_count, 2)

    def test_z_certificate_inspection_saved_details_and_report(self):
        from tests.test_certificates import certificate
        from backend.certificates import inspect_certificate
        from cryptography.hazmat.primitives.asymmetric import rsa
        metadata = inspect_certificate(certificate(rsa.generate_private_key(65537, 2048)))
        def fetch(url, addresses):
            return {'url': url, 'status': 200, 'address': addresses[0], 'headers': {},
                    'tls': {'verified': True, 'protocol': 'TLSv1.3', 'certificate': metadata},
                    'html': {'status': 'not_applicable'}}
        replacement = patch('backend.investigation.fetch', side_effect=fetch)
        replacement.start()
        self.addCleanup(replacement.stop)
        page = self.browser.new_page(viewport={'width': 1440, 'height': 1000})
        self.addCleanup(page.close)
        failures = []
        page.on('pageerror', lambda failure: failures.append(str(failure)))
        page.route('**/auth/v1/user', lambda route: route.fulfill(json=USER))
        page.add_init_script("localStorage.setItem('wa-cookies', JSON.stringify({choice: 'essential'}))")
        page.add_init_script("localStorage.setItem('sb-ldrspcimsdzazhbckmca-auth-token', JSON.stringify(" + json.dumps(test_session()) + "))")
        page.goto(self.url + '/dashboard/certificates')
        page.get_by_label('Domain or HTTPS URL to inspect').fill('certificate.example')
        page.get_by_role('button', name='Inspect certificate', exact=True).click()
        record = page.locator('.cert-record').filter(has_text='certificate.example')
        expect(record).to_be_visible()
        expect(record).to_contain_text('CN=example.com')
        expect(record).to_contain_text('RSA 2048 bits')
        expect(record).to_contain_text('sha256')
        page.reload()
        record = page.locator('.cert-record').filter(has_text='certificate.example')
        expect(record).to_be_visible()
        record.get_by_text('Certificate identity and evidence', exact=True).click()
        expect(record).to_contain_text(metadata['sha256_fingerprint'])
        record.get_by_role('button', name='View scan report', exact=True).click()
        dialog = page.get_by_role('dialog', name='Scan details')
        expect(dialog).to_be_visible()
        dialog.get_by_role('tab', name='Checks', exact=True).click()
        expect(dialog.get_by_text('Certificate key strength', exact=True)).to_have_count(2)
        dialog.get_by_role('button', name='Close report').click()
        page.set_viewport_size({'width': 390, 'height': 844})
        self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        self.assertEqual(failures, [])

    def test_z_sepolia_wallet_deployment_registration_and_walletless_verification(self):
        root = Path(__file__).resolve().parent.parent
        chain = subprocess.Popen([shutil.which('node'), 'scripts/registry-browser-fixture.mjs', '--sepolia', '--undeployed'],
                                 cwd=root / 'webassure', stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                 text=True, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        def stop_chain():
            chain.terminate(); chain.wait(timeout=10); chain.stdout.close()
        self.addCleanup(stop_chain)
        config = json.loads(chain.stdout.readline())
        def raw_rpc(payload):
            request = Request(config['rpc'], data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
            with urlopen(request, timeout=15) as response:
                return json.load(response)
        wallet_chain = ['0x1']
        switches = []
        def wallet_rpc(payload):
            if payload['method'] == 'eth_chainId': return wallet_chain[0]
            if payload['method'] == 'wallet_switchEthereumChain':
                wallet_chain[0] = payload['params'][0]['chainId']
                switches.append(wallet_chain[0])
                return None
            method = 'eth_accounts' if payload['method'] == 'eth_requestAccounts' else payload['method']
            result = raw_rpc({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': payload.get('params', [])})
            if 'error' in result: raise RuntimeError(result['error']['message'])
            return result['result']
        page = self.browser.new_page(viewport={'width': 1440, 'height': 1000})
        self.addCleanup(page.close)
        failures = []
        page.on('pageerror', lambda error: failures.append(str(error)))
        page.expose_function('registryWalletRpc', wallet_rpc)
        page.add_init_script("window.ethereum = { request: (payload) => window.registryWalletRpc(payload) }")
        page.route('**/auth/v1/user', lambda route: route.fulfill(json=USER))
        page.route('**/registry-sepolia.json', lambda route: route.fulfill(status=404, json={}))
        def public_rpc(route):
            headers = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS'}
            if route.request.method == 'OPTIONS': route.fulfill(status=204, headers=headers)
            else: route.fulfill(json=raw_rpc(route.request.post_data_json), headers=headers)
        page.route('https://ethereum-sepolia-rpc.publicnode.com/**', public_rpc)
        page.add_init_script("localStorage.setItem('wa-cookies', JSON.stringify({choice: 'essential'}))")
        page.add_init_script("localStorage.setItem('sb-ldrspcimsdzazhbckmca-auth-token', JSON.stringify(" + json.dumps(test_session()) + "))")
        page.goto(self.url + '/dashboard/scans')
        page.get_by_label('URL to scan', exact=True).fill('https://wallet-test.example')
        page.get_by_role('button', name='Scan', exact=True).click()
        page.get_by_role('dialog', name='Scan details').get_by_role('button', name='Close report').click()
        page.get_by_role('link', name='Threat ledger', exact=True).click()
        expect(page.get_by_label('Registry network')).to_have_value('11155111')
        page.get_by_role('button', name='Connect wallet', exact=True).click()
        expect(page.get_by_role('button', name='Refresh wallet', exact=True)).to_be_visible()
        self.assertEqual(switches, ['0xaa36a7'])
        page.get_by_role('button', name='Deploy registry', exact=True).click()
        expect(page.get_by_role('button', name='Download deployment config', exact=True)).to_be_visible(timeout=20000)
        expect(page.get_by_text('Registry configured', exact=True)).to_be_visible(timeout=20000)
        with page.expect_download() as deployment_event:
            page.get_by_role('button', name='Download deployment config', exact=True).click()
        deployment = json.loads(Path(deployment_event.value.path()).read_text(encoding='utf8'))
        self.assertEqual(deployment['chainId'], '11155111')
        self.assertGreater(deployment['deploymentBlock'], 0)
        self.assertEqual(page.get_by_role('link', name='View deployment transaction', exact=True).get_attribute('href'), 'https://sepolia.etherscan.io/tx/' + deployment['deploymentTransaction'])
        page.get_by_label('Saved investigation').select_option(label='https://wallet-test.example/ — Inconclusive')
        page.get_by_role('button', name='Prepare snapshot', exact=True).click()
        page.get_by_role('button', name='Register with wallet', exact=True).click()
        expect(page.get_by_text('Integrity verified', exact=True)).to_be_visible(timeout=20000)
        with page.expect_download() as receipt_event:
            page.get_by_role('button', name='Export receipt', exact=True).click()
        receipt_path = receipt_event.value.path()
        page.reload()
        page.evaluate('delete window.ethereum')
        page.locator('input[type="file"]').set_input_files(receipt_path)
        page.get_by_role('button', name='Verify integrity', exact=True).click()
        expect(page.get_by_text('Integrity verified', exact=True)).to_be_visible(timeout=20000)
        page.set_viewport_size({'width': 390, 'height': 844})
        self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        self.assertEqual(failures, [])

    def test_z_message_link_investigation_and_ledger_snapshot(self):
        root = Path(__file__).resolve().parent.parent
        chain = subprocess.Popen([shutil.which('node'), 'scripts/registry-browser-fixture.mjs'],
                                 cwd=root / 'webassure', stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                 text=True, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        def stop_chain():
            chain.terminate()
            chain.wait(timeout=10)
            chain.stdout.close()
        self.addCleanup(stop_chain)
        config = json.loads(chain.stdout.readline())
        page = self.browser.new_page(viewport={"width": 1440, "height": 1000})
        self.addCleanup(page.close)
        failures = []
        page.on('pageerror', lambda failure: failures.append(str(failure)))
        page.route('**/auth/v1/user', lambda route: route.fulfill(json=USER))
        page.add_init_script("localStorage.setItem('wa-cookies', JSON.stringify({choice: 'essential'}))")
        page.add_init_script("localStorage.setItem('sb-ldrspcimsdzazhbckmca-auth-token', JSON.stringify(" + json.dumps(test_session()) + "))")
        page.goto(self.url + '/dashboard/messages')
        page.get_by_label('Message to analyse').fill('Your bank account is blocked. Verify at https://malicious.example/login and share your OTP immediately.')
        page.get_by_role('button', name='Analyse message', exact=True).click()
        inspect = page.get_by_role('button', name='Investigate link', exact=True)
        expect(inspect).to_be_visible(timeout=20000)
        with page.expect_response(lambda response: response.request.method == 'POST' and response.url.endswith('/api/investigations')) as response_event:
            inspect.click()
        report = response_event.value.json()
        self.assertEqual(report['risk_classification'], 'Confirmed Malicious')
        self.assertTrue(page.url.endswith('/dashboard/messages'))
        page.get_by_role('button', name='View link report').click()
        dialog = page.get_by_role('dialog', name='Scan details')
        expect(dialog).to_be_visible()
        expect(dialog.get_by_text('Confirmed Malicious', exact=True)).to_be_visible()
        dialog.get_by_role('button', name='Close report').click()
        page.route('**/ledger-config.json', lambda route: route.fulfill(json=config))
        page.get_by_role('link', name='Threat ledger', exact=True).click()
        page.get_by_label('Registry network').select_option('31337')
        page.get_by_label('Saved investigation').select_option(report['id'])
        page.get_by_role('button', name='Prepare snapshot', exact=True).click()
        with page.expect_download() as download_event:
            page.get_by_role('button', name='Export snapshot', exact=True).click()
        bundle = json.loads(Path(download_event.value.path()).read_text(encoding='utf8'))
        self.assertEqual(bundle['snapshot']['report']['id'], report['id'])
        self.assertEqual(bundle['snapshot']['schema'], 'webassure-report-commitment/v1')
        self.assertIsNone(bundle['registration'])
        page.get_by_role('button', name='Register with wallet').click()
        expect(page.locator('.ledger-panel [role="alert"]')).to_contain_text('Ethereum browser wallet')
        def rpc_call(payload):
            method = 'eth_accounts' if payload['method'] == 'eth_requestAccounts' else payload['method']
            request = Request(config['rpc'], data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': payload.get('params', [])}).encode(), headers={'Content-Type': 'application/json'})
            with urlopen(request, timeout=15) as response:
                result = json.load(response)
            if 'error' in result:
                raise RuntimeError(result['error']['message'])
            return result['result']
        page.expose_function('registryRpc', rpc_call)
        page.evaluate("window.ethereum = { request: (payload) => window.registryRpc(payload) }")
        page.get_by_role('button', name='Register with wallet').click()
        expect(page.get_by_text('Integrity verified', exact=True)).to_be_visible(timeout=20000)
        with page.expect_download() as receipt_event:
            page.get_by_role('button', name='Export receipt', exact=True).click()
        receipt_path = receipt_event.value.path()
        receipt = json.loads(Path(receipt_path).read_text(encoding='utf8'))
        self.assertRegex(receipt['registration']['transactionHash'], r'^0x[0-9a-f]{64}$')
        # A new page can verify without signing or remembering the original report.
        page.reload()
        page.evaluate("window.ethereum = { request: (payload) => window.registryRpc(payload) }")
        page.locator('input[type="file"]').set_input_files(receipt_path)
        page.get_by_role('button', name='Verify integrity', exact=True).click()
        expect(page.get_by_text('Integrity verified', exact=True)).to_be_visible(timeout=20000)
        receipt['snapshot']['report']['risk_classification'] = 'Low Risk'
        page.locator('input[type="file"]').set_input_files({'name': 'altered.json', 'mimeType': 'application/json', 'buffer': json.dumps(receipt).encode()})
        page.get_by_role('button', name='Verify integrity', exact=True).click()
        expect(page.locator('.ledger-panel [role="alert"]')).to_contain_text('Integrity mismatch')
        page.set_viewport_size({'width': 390, 'height': 844})
        self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        self.assertEqual(failures, [])

    def test_real_submission_persistence_evidence_download_and_retries(self):
        page = self.browser.new_page(viewport={"width": 1440, "height": 1000})
        self.addCleanup(page.close)
        failures = []
        page.on("pageerror", lambda failure: failures.append(str(failure)))
        page.route('**/auth/v1/user', lambda route: route.fulfill(json=USER))
        page.add_init_script("localStorage.setItem('wa-theme', 'light')")
        page.add_init_script("localStorage.setItem('sb-ldrspcimsdzazhbckmca-auth-token', JSON.stringify(" + json.dumps(test_session()) + "))")
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
        expect(dialog.get_by_text("Local rules · Rule-based explanation", exact=True)).to_be_visible()
        self.assertGreater(dialog.locator('svg[aria-hidden="true"]').count(), 10)
        expect(dialog.get_by_role('tab', name='Overview', exact=False)).to_have_attribute('aria-selected', 'true')
        dialog.get_by_role('tab', name='Overview', exact=False).press('ArrowRight')
        expect(dialog.get_by_role('tab', name='Checks', exact=True)).to_have_attribute('aria-selected', 'true')
        expect(dialog.get_by_role('tabpanel', name='Checks', exact=True).get_by_text("Test provider unavailable", exact=True)).to_be_visible()
        expect(dialog.locator('.analysis-coverage-top')).to_contain_text('implemented checks')
        implemented = [check for check in report['evidence_coverage']['checks'] if check['status'] != 'not_implemented']
        not_assessed = [check for check in report['evidence_coverage']['checks'] if check['status'] == 'not_implemented']
        expect(dialog.locator('.analysis-check-cell')).to_have_count(len(implemented))
        expect(dialog.locator('.analysis-coverage-bar > span')).to_have_count(len(implemented))
        expect(dialog.locator('.analysis-not-assessed li')).to_have_count(len(not_assessed))
        expect(dialog.locator('.analysis-check-grid')).to_contain_text('HTML inspection')
        expect(dialog.locator('.analysis-check-grid')).not_to_contain_text('Certificate revocation')
        expect(dialog.get_by_role('heading', name='Page inspection', exact=True)).to_be_visible()
        expect(dialog.locator('.page-inspection-summary')).to_contain_text('Example workspace')
        expect(dialog.get_by_role('heading', name='Not assessed', exact=True)).to_be_visible()
        dialog.get_by_role('tab', name='Evidence', exact=True).click()
        coverage = dialog.get_by_text("Completed, incomplete & unimplemented checks", exact=True)
        coverage.click()
        expect(coverage.locator('..').locator('pre')).to_contain_text('"status": "not_implemented"')
        domains = dialog.get_by_text("Domain identity & URL indicators", exact=True)
        domains.click()
        expect(domains.locator('..').locator('pre')).to_contain_text('"registrable_domain": "example.com"')
        dialog.get_by_text("Assessment decision", exact=True).click()
        expect(dialog.get_by_text("Assessment decision", exact=True).locator('..').locator('pre')).to_contain_text('insufficient_core_coverage')
        dialog.get_by_role('tab', name='Connection', exact=True).click()
        expect(dialog.get_by_role("heading", name="Domain identity", exact=True)).to_be_visible()
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
        expect(dialog.get_by_role('button', name='Export report JSON', exact=True).locator('span')).to_be_hidden()
        with page.expect_download() as mobile_download:
            dialog.get_by_role('button', name='Export report JSON', exact=True).click()
        self.assertEqual(json.loads(Path(mobile_download.value.path()).read_text())['risk_classification'], 'Confirmed Malicious')
        page.screenshot(path="data/webassure-report-mobile.png", full_page=True)
        page.set_viewport_size({"width": 1440, "height": 1000})
        page.screenshot(path="data/webassure-report-desktop.png", full_page=True)
        dialog.get_by_role('tab', name='Connection', exact=True).click()
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
        page.get_by_role('link', name='Overview', exact=True).click()
        expect(page.locator('.greet .dash__title')).to_be_visible()
        expect(page.locator('.kpi').filter(has_text='Saved investigations').locator('.kpi__v')).to_have_text('33')
        expect(page.locator('.kpi').filter(has_text='Known malicious').locator('.kpi__v')).to_have_text('1')
        expect(page.locator('.kpi').filter(has_text='Needs verification').locator('.kpi__v')).to_have_text('32')
        expect(page.locator('.bars__row').filter(has_text='Inconclusive').locator('.bars__meta .grey')).to_have_text('32')
        expect(page.locator('.table-wrap tbody tr')).to_have_count(5)
        expect(page.get_by_role('img', name='Scans per day', exact=True)).to_be_visible()
        page.screenshot(path='data/webassure-overview-dark.png', full_page=True)
        page.get_by_role('button', name='Switch to light theme', exact=True).click()
        page.screenshot(path='data/webassure-overview-light.png', full_page=True)
        page.set_viewport_size({'width': 390, 'height': 844})
        expect(page.locator('.dash__side')).not_to_be_in_viewport()
        self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        page.screenshot(path='data/webassure-overview-mobile.png', full_page=True, animations='disabled')
        self.assertEqual(failures, [])
