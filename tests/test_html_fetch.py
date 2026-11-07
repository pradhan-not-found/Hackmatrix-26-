import socket
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

from backend.network import MAX_HTML_BYTES, fetch


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        self.send_response(302 if self.path == "/redirect" else 200)
        self.send_header("Content-Type", "application/octet-stream" if self.path == "/binary" else "text/html; charset=utf-8")
        if self.path == "/compressed":
            self.send_header("Content-Encoding", "gzip")
        if self.path == "/attachment":
            self.send_header("Content-Disposition", 'attachment; filename="page.html"')
        if self.path == "/declared-large":
            self.send_header("Content-Length", str(MAX_HTML_BYTES + 1))
        if self.path == "/redirect":
            self.send_header("Location", "http://127.0.0.1/private")
        self.end_headers()
        try:
            if self.path == "/slow":
                for _ in range(100):
                    self.wfile.write(b"x")
                    self.wfile.flush()
                    time.sleep(.03)
            elif self.path == "/large":
                self.wfile.write(b"x" * (MAX_HTML_BYTES + 1))
            else:
                self.wfile.write(b"<title>Benign fixture</title>")
        except OSError:
            pass


class BoundedHTMLFetchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def get(self, path, timeout=2):
        connect = socket.create_connection
        def pinned_fixture(address, **kwargs):
            self.assertEqual(address, ("8.8.8.8", 80))
            return connect(self.server.server_address, **kwargs)
        with patch("backend.network.socket.create_connection", side_effect=pinned_fixture):
            return fetch("http://example.com" + path, ["8.8.8.8"], timeout)

    def test_small_html_is_read(self):
        result = self.get("/")
        self.assertEqual(result["html"]["status"], "completed")
        self.assertIn("Benign fixture", result["html"]["text"])

    def test_non_html_compressed_attachments_and_oversize_are_not_parsed(self):
        for path, status in (("/binary", "not_applicable"), ("/compressed", "unavailable"),
                             ("/attachment", "unavailable"), ("/declared-large", "unavailable"),
                             ("/large", "unavailable")):
            with self.subTest(path=path):
                result = self.get(path)["html"]
                self.assertEqual(result["status"], status)
                self.assertNotIn("text", result)

    def test_redirect_is_returned_not_followed(self):
        result = self.get("/redirect")
        self.assertEqual(result["status"], 302)
        self.assertEqual(result["html"]["status"], "not_run")

    def test_slow_stream_is_stopped_by_whole_request_deadline(self):
        started = time.monotonic()
        with self.assertRaises((TimeoutError, OSError)):
            self.get("/slow", timeout=.15)
        self.assertLess(time.monotonic() - started, .8)
