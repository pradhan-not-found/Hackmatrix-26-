import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, ec, ed25519
from cryptography.x509.oid import NameOID

from backend.certificates import inspect_certificate
from backend.investigation import investigate


def certificate(key):
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'example.com')])
    stamp = datetime.now(timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
            .public_key(key.public_key()).serial_number(1)
            .not_valid_before(stamp - timedelta(days=1)).not_valid_after(stamp + timedelta(days=30))
            .add_extension(x509.SubjectAlternativeName([x509.DNSName('example.com')]), critical=False)
            .sign(key, None if isinstance(key, ed25519.Ed25519PrivateKey) else hashes.SHA256()))
    return cert.public_bytes(serialization.Encoding.DER)


class CertificateTests(unittest.TestCase):
    def test_supported_keys_and_metadata(self):
        for key, name in ((rsa.generate_private_key(65537, 2048), 'RSA'),
                          (ec.generate_private_key(ec.SECP256R1()), 'EC'),
                          (ed25519.Ed25519PrivateKey.generate(), 'Ed25519')):
            with self.subTest(name=name):
                metadata = inspect_certificate(certificate(key))
                self.assertEqual(metadata['public_key']['algorithm'], name)
                self.assertEqual(metadata['public_key']['status'], 'acceptable')
                self.assertEqual(metadata['signature']['status'], 'acceptable')
                self.assertEqual(metadata['subject_alt_names'], [{'type': 'DNS', 'value': 'example.com'}])
                self.assertTrue(metadata['not_after'].endswith('+00:00'))
                self.assertEqual(len(metadata['sha256_fingerprint']), 64)

    def test_weak_key_and_signature_policy(self):
        der = certificate(rsa.generate_private_key(65537, 1024))
        self.assertEqual(inspect_certificate(der)['public_key']['status'], 'weak')
        # Parser fixture only: replace SHA256withRSA OIDs with SHA1withRSA.
        # This signature is intentionally invalid and never used in a TLS handshake.
        sha1_der = der.replace(bytes.fromhex('06092a864886f70d01010b'), bytes.fromhex('06092a864886f70d010105'))
        self.assertEqual(inspect_certificate(sha1_der)['signature']['status'], 'weak')

    def test_malformed_and_unsupported_curve_are_not_clean(self):
        self.assertEqual(inspect_certificate(b'invalid DER')['status'], 'unavailable')
        metadata = inspect_certificate(certificate(ec.generate_private_key(ec.SECP256K1())))
        self.assertEqual(metadata['public_key']['status'], 'unavailable')

    def test_pipeline_records_configuration_findings_without_phishing_escalation(self):
        metadata = inspect_certificate(certificate(rsa.generate_private_key(65537, 1024)))
        response = {'url': 'https://example.com/', 'status': 200, 'address': '8.8.8.8',
                    'headers': {}, 'tls': {'verified': True, 'certificate': metadata},
                    'html': {'status': 'completed', 'text': '<title>Example</title>'}}
        with patch('backend.investigation.public_addresses', return_value=['8.8.8.8']), \
             patch('backend.investigation.fetch', return_value=response), \
             patch('backend.investigation.reputation', return_value={'status': 'completed', 'source': 'fixture', 'matches': []}):
            report = investigate('https://example.com')
        finding = next(item for item in report['findings'] if item.get('code') == 'certificate_key_strength')
        self.assertEqual(finding['kind'], 'security_configuration')
        self.assertIn('impact', finding)
        self.assertIn('remediation', finding)
        self.assertEqual(report['risk_classification'], 'Low Risk')
        coverage = {item['name']: item['status'] for item in report['evidence_coverage']['checks']}
        self.assertEqual(coverage['certificate_key_strength'], 'completed')
        self.assertEqual(coverage['certificate_signature'], 'completed')
        self.assertEqual(coverage['certificate_revocation'], 'not_implemented')
