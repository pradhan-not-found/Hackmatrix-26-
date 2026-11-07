"""Verify sessions with Supabase Auth and access PostgREST under the caller's RLS identity."""

import json
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import UUID

from dotenv import dotenv_values
from fastapi import Depends, Header, HTTPException


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def configuration():
    values = dotenv_values(Path(__file__).resolve().parents[1] / '.env')
    url = (os.getenv('SUPABASE_URL') or values.get('SUPABASE_URL') or '').rstrip('/')
    key = os.getenv('SUPABASE_PUBLISHABLE_KEY') or values.get('SUPABASE_PUBLISHABLE_KEY')
    if not url.startswith('https://') or not key:
        raise HTTPException(503, 'Supabase is not configured on the backend.')
    return url, key


def request_supabase(path, token, method='GET', body=None, extra_headers=None):
    url, key = configuration()
    headers = {'apikey': key, 'Authorization': f'Bearer {token}', 'Content-Type': 'application/json', **(extra_headers or {})}
    request = Request(url + path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    try:
        with build_opener(NoRedirect()).open(request, timeout=15) as response:
            raw = response.read()
            return json.loads(raw) if raw else None, response.headers
    except HTTPError as failure:
        if failure.code == 401:
            raise HTTPException(401, 'Your session has expired. Sign in again.', headers={'WWW-Authenticate': 'Bearer'}) from failure
        if failure.code == 403:
            raise HTTPException(403, 'You do not have access to this resource.') from failure
        raise HTTPException(503, 'Supabase storage is unavailable. Check the connection and apply the workspace migration.') from failure
    except (URLError, TimeoutError, OSError, ValueError) as failure:
        raise HTTPException(503, 'Cannot reach Supabase. Please retry shortly.') from failure


@dataclass(frozen=True)
class Principal:
    id: str
    token: str


def authenticated_user(authorization: str | None = Header(default=None)):
    scheme, _, token = (authorization or '').partition(' ')
    if scheme.lower() != 'bearer' or not token.strip():
        raise HTTPException(401, 'Sign in to access investigations.', headers={'WWW-Authenticate': 'Bearer'})
    user, _ = request_supabase('/auth/v1/user', token.strip())
    try:
        user_id = str(UUID(user['id']))
    except (TypeError, KeyError, ValueError) as failure:
        raise HTTPException(401, 'Invalid session.', headers={'WWW-Authenticate': 'Bearer'}) from failure
    return Principal(user_id, token.strip())


class SupabaseStore:
    def __init__(self, principal):
        self.principal = principal

    def _path(self, **params):
        return '/rest/v1/investigations?' + urlencode({'user_id': f'eq.{self.principal.id}', **params})

    def create(self, report):
        request_supabase('/rest/v1/investigations', self.principal.token, 'POST',
                         {'id': report['id'], 'user_id': self.principal.id, 'report': report}, {'Prefer': 'return=minimal'})

    def list(self, limit, offset):
        fields = 'id,submitted_url,normalized_url,risk_classification,created_at,status'
        rows, headers = request_supabase(self._path(select=fields, order='created_at.desc,id.desc', limit=limit, offset=offset),
                                        self.principal.token, extra_headers={'Prefer': 'count=exact'})
        try:
            total = int(headers['Content-Range'].rsplit('/', 1)[1])
        except (KeyError, ValueError) as failure:
            raise HTTPException(502, 'Supabase returned invalid pagination metadata.') from failure
        return {'items': rows, 'total': total, 'limit': limit, 'offset': offset}

    def get(self, investigation_id):
        rows, _ = request_supabase(self._path(id=f'eq.{investigation_id}', select='report', limit=1), self.principal.token)
        if not rows:
            raise HTTPException(404, 'Investigation not found')
        return rows[0]['report']

    def update(self, investigation_id, report):
        rows, _ = request_supabase(self._path(id=f'eq.{investigation_id}', select='id'), self.principal.token, 'PATCH',
                                   {'report': report}, {'Prefer': 'return=representation'})
        if not rows:
            raise HTTPException(404, 'Investigation not found')


def investigation_store(principal: Principal = Depends(authenticated_user)):
    return SupabaseStore(principal)
