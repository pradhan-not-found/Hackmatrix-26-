import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.main import app
from backend.supabase import Principal, SupabaseStore, authenticated_user

OWNER = '00000000-0000-0000-0000-000000000001'
REPORT_ID = '00000000-0000-0000-0000-000000000002'


class SupabaseTests(unittest.TestCase):
    def test_all_investigation_routes_require_authentication_before_work(self):
        with patch('backend.supabase.request_supabase') as request, patch('backend.main.investigate') as scan, TestClient(app) as client:
            for method, path in [('GET', '/api/investigations'), ('POST', '/api/investigations'),
                                 ('GET', f'/api/investigations/{REPORT_ID}'), ('POST', f'/api/investigations/{REPORT_ID}/explanation')]:
                response = client.request(method, path, json={'url': 'example.com'})
                self.assertEqual(response.status_code, 401)
            request.assert_not_called()
            scan.assert_not_called()

    def test_identity_is_verified_remotely_not_taken_from_client_metadata(self):
        with patch('backend.supabase.request_supabase', return_value=({'id': OWNER, 'user_metadata': {'id': REPORT_ID}}, {})) as request:
            principal = authenticated_user('Bearer signed-token')
            self.assertEqual(principal.id, OWNER)
            request.assert_called_once_with('/auth/v1/user', 'signed-token')

    def test_invalid_sessions_cannot_query_reports(self):
        with patch('backend.supabase.request_supabase', side_effect=HTTPException(401, 'Expired')) as request, TestClient(app) as client:
            response = client.get('/api/investigations', headers={'Authorization': 'Bearer expired-token'})
            self.assertEqual(response.status_code, 401)
            self.assertEqual(request.call_count, 1)

    def test_list_is_owner_scoped_paginated_and_excludes_report_payload(self):
        store = SupabaseStore(Principal(OWNER, 'user-token'))
        with patch('backend.supabase.request_supabase', return_value=([{'id': REPORT_ID}], {'Content-Range': '0-0/3'})) as request:
            result = store.list(1, 2)
            params = parse_qs(urlsplit(request.call_args.args[0]).query)
            self.assertEqual(params['user_id'], [f'eq.{OWNER}'])
            self.assertEqual(params['offset'], ['2'])
            self.assertEqual(params['order'], ['created_at.desc,id.desc'])
            self.assertNotIn('report', params['select'][0])
            self.assertEqual(result['total'], 3)
            self.assertEqual(request.call_args.args[1], 'user-token')

    def test_insert_owner_is_derived_from_verified_session(self):
        store = SupabaseStore(Principal(OWNER, 'user-token'))
        with patch('backend.supabase.request_supabase', return_value=(None, {})) as request:
            store.create({'id': REPORT_ID})
            self.assertEqual(request.call_args.args[3]['user_id'], OWNER)

    def test_inaccessible_reports_are_404_and_updates_have_owner_filter(self):
        store = SupabaseStore(Principal(OWNER, 'user-token'))
        for method in ('get', 'update'):
            with patch('backend.supabase.request_supabase', return_value=([], {})) as request:
                with self.assertRaises(HTTPException) as failure:
                    getattr(store, method)(REPORT_ID, *([{'id': REPORT_ID}] if method == 'update' else []))
                self.assertEqual(failure.exception.status_code, 404)
                self.assertIn('user_id=eq.', request.call_args.args[0])

    def test_auth_errors_do_not_expose_tokens_or_upstream_responses(self):
        from urllib.error import HTTPError
        from backend.supabase import request_supabase
        with patch('backend.supabase.configuration', return_value=('https://project.supabase.co', 'publishable')), patch('backend.supabase.build_opener') as opener:
            opener.return_value.open.side_effect = HTTPError('https://project.supabase.co', 500, 'private upstream body', {}, None)
            with self.assertRaises(HTTPException) as failure:
                request_supabase('/rest/v1/investigations', 'secret-user-token')
            self.assertNotIn('secret-user-token', failure.exception.detail)
            self.assertNotIn('private upstream body', failure.exception.detail)

    def test_transient_reads_retry_once_then_recover(self):
        from urllib.error import URLError, HTTPError
        from backend.supabase import request_supabase
        for error in (URLError(ConnectionResetError(10054, 'reset')), HTTPError('https://project.supabase.co', 503, 'Unavailable', {}, None)):
            with self.subTest(error=type(error).__name__), patch('backend.supabase.configuration', return_value=('https://project.supabase.co', 'publishable')), \
                 patch('backend.supabase.build_opener') as opener, patch('backend.supabase.time.sleep'):
                success = opener.return_value.open.return_value
                success.__enter__.return_value.read.return_value = b'[]'
                opener.return_value.open.side_effect = [error, success]
                rows, _ = request_supabase('/rest/v1/investigations', 'user-token')
                self.assertEqual(rows, [])
                self.assertEqual(opener.return_value.open.call_count, 2)

    def test_writes_and_auth_denials_are_not_retried(self):
        from urllib.error import URLError, HTTPError
        from backend.supabase import request_supabase
        for method, error, status in (
            ('POST', URLError(ConnectionResetError()), 503),
            ('GET', HTTPError('https://project.supabase.co', 401, 'Expired', {}, None), 401),
            ('GET', HTTPError('https://project.supabase.co', 403, 'Denied', {}, None), 403),
        ):
            with self.subTest(method=method, status=status), patch('backend.supabase.configuration', return_value=('https://project.supabase.co', 'publishable')), patch('backend.supabase.build_opener') as opener:
                opener.return_value.open.side_effect = error
                with self.assertRaises(HTTPException) as caught:
                    request_supabase('/rest/v1/investigations', 'private-token', method=method)
                self.assertEqual(caught.exception.status_code, status)
                self.assertEqual(opener.return_value.open.call_count, 1)

    def test_exhausted_retry_logs_no_private_data(self):
        from urllib.error import URLError
        from backend.supabase import request_supabase
        with patch('backend.supabase.configuration', return_value=('https://project.supabase.co', 'publishable')), patch('backend.supabase.build_opener') as opener, patch('backend.supabase.time.sleep'), self.assertLogs('backend.supabase', level='WARNING') as logs:
            opener.return_value.open.side_effect = URLError(OSError(10054, 'private-token private-body'))
            with self.assertRaises(HTTPException) as caught:
                request_supabase('/auth/v1/user', 'private-token')
            self.assertEqual(caught.exception.status_code, 503)
            self.assertEqual(opener.return_value.open.call_count, 2)
        self.assertNotIn('private-token', ' '.join(logs.output))
        self.assertNotIn('private-body', ' '.join(logs.output))


if __name__ == '__main__':
    unittest.main()
