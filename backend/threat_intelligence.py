"""Google Safe Browsing lookups with explicit, secret-free failure results."""

import http.client
import json
import os
import socket
import ssl
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

from dotenv import dotenv_values

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
SOURCE = "Google Safe Browsing v4"
THREAT_TYPES = ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"]


def api_key() -> str:
    # An explicitly empty environment variable disables the provider, including in tests.
    if "GOOGLE_SAFE_BROWSING_API_KEY" in os.environ:
        return os.environ["GOOGLE_SAFE_BROWSING_API_KEY"].strip()
    return (dotenv_values(ENV_FILE, interpolate=False).get("GOOGLE_SAFE_BROWSING_API_KEY") or "").strip()


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def reputation(urls: list[str], *, key_override: str | None = None) -> dict:
    """Only send URLs to the provider, never fetch submitted destinations here.

    key_override is used by the validation command to exercise rejected credentials
    without changing the running application's configuration.
    """
    urls = list(dict.fromkeys(urls))
    base = {"source": SOURCE, "checked_at": datetime.now(timezone.utc).isoformat(),
            "checked_urls": urls}

    def unavailable(code, reason, http_status=None):
        result = {**base, "status": "unavailable", "error_code": code, "reason": reason}
        if http_status is not None:
            result["http_status"] = http_status
        return result

    key = api_key() if key_override is None else key_override
    if not key:
        return unavailable("not_configured", "Google Safe Browsing API key not configured")
    if not urls or len(urls) > 500:
        return unavailable("invalid_input", "Provider lookup requires between 1 and 500 URLs")
    endpoint = "https://safebrowsing.googleapis.com/v4/threatMatches:find?" + urlencode({"key": key})
    payload = {"client": {"clientId": "hackmatrix", "clientVersion": "1.0"},
               "threatInfo": {"threatTypes": THREAT_TYPES,
                              "platformTypes": ["ANY_PLATFORM"], "threatEntryTypes": ["URL"],
                              "threatEntries": [{"url": url} for url in urls]}}
    request = Request(endpoint, data=json.dumps(payload).encode(),
                      headers={"Content-Type": "application/json"})
    try:
        with build_opener(ProxyHandler({}), NoRedirect()).open(request, timeout=5) as response:
            raw = response.read(262145)
        if len(raw) > 262144:
            raise ValueError("Response too large")
        data = json.loads(raw)
        if not isinstance(data, dict) or "error" in data:
            raise ValueError("Invalid provider response")
        matches = data.get("matches", [])
        if not isinstance(matches, list) or not all(
            isinstance(match, dict) and isinstance(match.get("threat"), dict)
            and match["threat"].get("url") in urls
            and match.get("threatType") in THREAT_TYPES
            and match.get("platformType") == "ANY_PLATFORM"
            and match.get("threatEntryType") == "URL"
            for match in matches
        ):
            raise ValueError("Invalid provider matches")
        return {**base, "status": "completed", "matches": matches}
    except HTTPError as exc:
        status = exc.code
        exc.close()
        if status in (400, 401, 403):
            return unavailable("configuration_error", "Provider rejected the request. Check the API key, Safe Browsing API activation, and key restrictions.", status)
        if status == 429:
            return unavailable("quota_exceeded", "Provider quota exceeded; retry later or review your Google Cloud quota.", status)
        return unavailable("provider_http_error", "Provider returned an unsuccessful HTTP response.", status)
    except (TimeoutError, socket.timeout):
        return unavailable("timeout", "Threat intelligence provider timed out.")
    except ssl.SSLError:
        return unavailable("tls_error", "Could not verify a secure connection to the threat intelligence provider.")
    except URLError as exc:
        if isinstance(exc.reason, (TimeoutError, socket.timeout)):
            return unavailable("timeout", "Threat intelligence provider timed out.")
        if isinstance(exc.reason, ssl.SSLError):
            return unavailable("tls_error", "Could not verify a secure connection to the threat intelligence provider.")
        return unavailable("network_error", "Could not connect to the threat intelligence provider.")
    except (OSError, http.client.HTTPException):
        return unavailable("network_error", "Could not connect to the threat intelligence provider.")
    except (ValueError, TypeError, UnicodeError):
        return unavailable("invalid_response", "Threat intelligence provider returned an invalid response.")
