"""Bounded, public-address-only requests; target content is never executed."""

import http.client
import ipaddress
import re
import socket
import ssl
import time
from urllib.parse import quote, urlsplit, urlunsplit


class UnsafeURL(ValueError):
    pass


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
        host = parts.hostname.rstrip(".").encode("idna").decode("ascii").lower()
        try:
            address = ipaddress.ip_address(host)
            host = address.compressed
        except ValueError:
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
    """HEAD only: collect headers without downloading bodies or running scripts."""
    parts = urlsplit(url)
    host = parts.hostname
    port = 443 if parts.scheme == "https" else 80
    connection = http.client.HTTPConnection(host, port, timeout=timeout)
    started = time.monotonic()
    try:
        # Connect to an already validated numeric IP. Never resolve the hostname again.
        connection.sock = socket.create_connection((addresses[0], port), timeout=timeout)
        tls = None
        if parts.scheme == "https":
            connection.sock = ssl.create_default_context().wrap_socket(
                connection.sock, server_hostname=host
            )
            cert = connection.sock.getpeercert()
            tls = {
                "verified": True, "protocol": connection.sock.version(),
                "cipher": connection.sock.cipher()[0],
                "issuer": dict(item for group in cert.get("issuer", ()) for item in group),
                "not_before": cert.get("notBefore"), "not_after": cert.get("notAfter"),
                "subject_alt_names": cert.get("subjectAltName", ()),
            }
        connection.sock.settimeout(max(0.1, timeout - (time.monotonic() - started)))
        target = urlunsplit(("", "", parts.path, parts.query, ""))
        connection.request("HEAD", target, headers={
            "User-Agent": "HackMatrix-Investigator/1.0", "Connection": "close",
        })
        response = connection.getresponse()
        headers = {key.lower(): value for key, value in response.getheaders()}
        return {"url": url, "address": addresses[0], "status": response.status,
                "headers": headers, "tls": tls}
    finally:
        connection.close()
