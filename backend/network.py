"""Bounded, public-address-only requests; target content is never executed."""

import http.client
import ipaddress
import re
import socket
import ssl
import time
import threading
from email.message import Message
import idna
import certifi
from urllib.parse import quote, urlsplit, urlunsplit
from backend.certificates import inspect_certificate


class UnsafeURL(ValueError):
    pass


def create_tls_context():
    # Windows' OpenSSL view of the OS store can omit public roots that browsers
    # trust. Add the packaged Mozilla roots; retain system roots, hostname checks
    # and CERT_REQUIRED. Do not download issuer URLs from untrusted certificates.
    context = ssl.create_default_context()
    context.load_verify_locations(cafile=certifi.where())
    return context


MAX_HTML_BYTES = 256 * 1024


def read_html(response, headers: dict, deadline: float) -> dict:
    if not 200 <= response.status < 300:
        return {"status": "not_run", "reason": "Only successful terminal responses are parsed."}
    message = Message()
    message["content-type"] = headers.get("content-type", "application/octet-stream")
    if message.get_content_type() not in ("text/html", "application/xhtml+xml"):
        return {"status": "not_applicable", "reason": "Response is not declared HTML; its body was not read."}
    if headers.get("content-encoding", "identity").lower() != "identity":
        return {"status": "unavailable", "reason": "Compressed responses are not decoded by the bounded inspector."}
    if "attachment" in headers.get("content-disposition", "").lower():
        return {"status": "unavailable", "reason": "Attachments are not downloaded."}
    try:
        length = int(headers["content-length"]) if "content-length" in headers else None
    except ValueError:
        return {"status": "unavailable", "reason": "Invalid response Content-Length."}
    if length is not None and (length < 0 or length > MAX_HTML_BYTES):
        return {"status": "unavailable", "reason": "HTML exceeds the 256 KiB inspection limit or has an invalid length."}
    chunks, size = [], 0
    while True:
        if time.monotonic() >= deadline:
            raise TimeoutError("HTML request deadline exceeded")
        chunk = response.read1(min(8192, MAX_HTML_BYTES - size + 1))
        if not chunk:
            break
        size += len(chunk)
        if size > MAX_HTML_BYTES:
            return {"status": "unavailable", "reason": "HTML exceeds the 256 KiB inspection limit."}
        chunks.append(chunk)
    if response.length not in (None, 0):
        return {"status": "unavailable", "reason": "HTML response ended before its declared length."}
    raw = b"".join(chunks)
    charset = message.get_content_charset() or "utf-8"
    try:
        text = raw.decode(charset, errors="replace")
    except (LookupError, UnicodeError):
        charset = "utf-8"
        text = raw.decode(charset, errors="replace")
    return {"status": "completed", "text": text, "bytes_read": size, "charset": charset}


def normalize_url(value: str) -> str:
    value = value.strip()
    if not value or len(value) > 4096 or any(ord(c) < 33 for c in value) or "\\" in value:
        raise UnsafeURL("URL is empty, too long, or contains forbidden characters")
    if "://" not in value:
        value = "https://" + value
    try:
        parts = urlsplit(value)
        if parts.scheme.lower() not in ("http", "https") or not parts.hostname:
            raise UnsafeURL("Only HTTP and HTTPS URLs are supported")
        if parts.username is not None or parts.password is not None:
            raise UnsafeURL("URLs containing credentials are not supported")
        host = parts.hostname.rstrip(".").lower()
        try:
            address = ipaddress.ip_address(host)
            host = address.compressed
        except ValueError:
            host = idna.encode(host, uts46=True, std3_rules=True).decode("ascii")
            if len(host) > 253 or not all(
                re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label)
                for label in host.split(".")
            ):
                raise UnsafeURL("Invalid hostname")
        port = parts.port
        expected = 443 if parts.scheme.lower() == "https" else 80
        if port is not None and port != expected:
            raise UnsafeURL("Only the standard port for each scheme is supported")
        authority = f"[{host}]" if ":" in host else host
        return urlunsplit((parts.scheme.lower(), authority,
                           quote(parts.path or "/", safe="/%:@!$&'()*+,;=-._~"),
                           quote(parts.query, safe="%=&?/:@!$'()*+,;~-._"), ""))
    except (ValueError, UnicodeError) as exc:
        raise UnsafeURL(str(exc)) from exc


def public_addresses(host: str, port: int) -> list[str]:
    addresses = sorted({entry[4][0] for entry in socket.getaddrinfo(
        host, port, type=socket.SOCK_STREAM
    )})
    if not addresses:
        raise OSError("DNS returned no addresses")
    for value in addresses:
        address = ipaddress.ip_address(value)
        mapped = isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped is not None
        transition = isinstance(address, ipaddress.IPv6Address) and (
            address.sixtofour is not None or address.teredo is not None
            or address in ipaddress.ip_network("64:ff9b::/96")
            or address in ipaddress.ip_network("64:ff9b:1::/48")
        )
        if not address.is_global or address.is_multicast or address.is_reserved or mapped or transition:
            raise UnsafeURL("Destination resolves to a non-public or unsupported address")
    return addresses


def fetch(url: str, addresses: list[str], timeout: float = 5) -> dict:
    """One pinned GET, with a hard socket deadline and a bounded HTML-only body."""
    parts = urlsplit(url)
    host = parts.hostname
    port = 443 if parts.scheme == "https" else 80
    connection = http.client.HTTPConnection(host, port, timeout=timeout)
    started = time.monotonic()
    deadline = started + timeout
    active_socket = [None]
    expired = threading.Event()
    response = None

    def interrupt():
        expired.set()
        sock = active_socket[0]
        if sock is not None:
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            sock.close()

    timer = threading.Timer(timeout, interrupt)
    timer.daemon = True
    timer.start()
    try:
        # Connect to an already validated numeric IP. Never resolve the hostname again.
        connection.sock = socket.create_connection((addresses[0], port), timeout=timeout)
        active_socket[0] = connection.sock
        if expired.is_set():
            raise TimeoutError("Request deadline exceeded")
        connection.sock.settimeout(max(.001, deadline - time.monotonic()))
        tls = None
        if parts.scheme == "https":
            connection.sock = create_tls_context().wrap_socket(
                connection.sock, server_hostname=host
            )
            active_socket[0] = connection.sock
            cert = connection.sock.getpeercert()
            tls = {
                "verified": True, "protocol": connection.sock.version(),
                "cipher": connection.sock.cipher()[0],
                "issuer": dict(item for group in cert.get("issuer", ()) for item in group),
                "not_before": cert.get("notBefore"), "not_after": cert.get("notAfter"),
                "subject_alt_names": cert.get("subjectAltName", ()),
                "certificate": inspect_certificate(connection.sock.getpeercert(binary_form=True)),
            }
        if time.monotonic() >= deadline:
            raise TimeoutError("Request deadline exceeded")
        connection.sock.settimeout(max(.001, deadline - time.monotonic()))
        target = urlunsplit(("", "", parts.path, parts.query, ""))
        connection.request("GET", target, headers={
            "User-Agent": "HackMatrix-Investigator/1.0", "Connection": "close",
            "Accept": "text/html, application/xhtml+xml", "Accept-Encoding": "identity",
        })
        response = connection.getresponse()
        headers = {key.lower(): value for key, value in response.getheaders()}
        html = read_html(response, headers, deadline)
        if expired.is_set():
            raise TimeoutError("Request deadline exceeded")
        return {"url": url, "address": addresses[0], "status": response.status,
                "headers": headers, "tls": tls, "html": html}
    finally:
        timer.cancel()
        if response is not None:
            response.close()
        connection.close()
        if active_socket[0] is not None:
            active_socket[0].close()
