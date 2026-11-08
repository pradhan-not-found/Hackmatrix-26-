"""Leaf-certificate metadata and explicit local cryptographic policy checks.

Does not perform chain, revocation, CT or CA compromise analysis. The network
client still verifies hostname and system trust before providing the leaf DER.
"""
from cryptography import x509
from cryptography.exceptions import UnsupportedAlgorithm
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa, ec, dsa, ed25519, ed448


def inspect_certificate(der: bytes) -> dict:
    try:
        return _inspect(der)
    except (ValueError, TypeError, UnsupportedAlgorithm, x509.DuplicateExtension):
        return {"status": "unavailable", "reason": "Leaf certificate metadata could not be parsed or uses an unsupported algorithm."}


def _inspect(der):
    cert = x509.load_der_x509_certificate(der)
    public_key = cert.public_key()
    key = {"algorithm": type(public_key).__name__, "bits": None, "status": "unavailable"}
    if isinstance(public_key, rsa.RSAPublicKey):
        key.update(algorithm="RSA", bits=public_key.key_size, status="weak" if public_key.key_size < 2048 else "acceptable")
    elif isinstance(public_key, ec.EllipticCurvePublicKey):
        key.update(algorithm="EC", bits=public_key.key_size, curve=public_key.curve.name)
        if public_key.key_size < 256:
            key["status"] = "weak"
        elif public_key.curve.name in ("secp256r1", "secp384r1", "secp521r1"):
            key["status"] = "acceptable"
    elif isinstance(public_key, dsa.DSAPublicKey):
        key.update(algorithm="DSA", bits=public_key.key_size, status="weak")
    elif isinstance(public_key, (ed25519.Ed25519PublicKey, ed448.Ed448PublicKey)):
        key.update(algorithm="Ed25519" if isinstance(public_key, ed25519.Ed25519PublicKey) else "Ed448", status="acceptable")
    signature = {"oid": cert.signature_algorithm_oid.dotted_string,
                 "algorithm": cert.signature_algorithm_oid._name, "hash": None, "status": "unavailable"}
    try:
        digest = cert.signature_hash_algorithm
        if digest is not None:
            signature["hash"] = digest.name
            if digest.name in ("md5", "sha1") or digest.digest_size < 32:
                signature["status"] = "weak"
            elif digest.name in ("sha256", "sha384", "sha512"):
                signature["status"] = "acceptable"
        elif signature["oid"] in ("1.3.101.112", "1.3.101.113"):
            signature["status"] = "acceptable"  # EdDSA has no separate hash field.
    except UnsupportedAlgorithm:
        pass
    try:
        names = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
        sans = [{"type": "DNS", "value": value} for value in names.get_values_for_type(x509.DNSName)]
        sans += [{"type": "IP", "value": str(value)} for value in names.get_values_for_type(x509.IPAddress)]
    except x509.ExtensionNotFound:
        sans = []
    return {"status": "completed", "policy": "leaf-crypto-v1", "subject": cert.subject.rfc4514_string(),
            "issuer": cert.issuer.rfc4514_string(), "serial_number": str(cert.serial_number),
            "not_before": cert.not_valid_before_utc.isoformat(), "not_after": cert.not_valid_after_utc.isoformat(),
            "subject_alt_names": sans, "sha256_fingerprint": cert.fingerprint(hashes.SHA256()).hex(),
            "public_key": key, "signature": signature,
            "scope": "Leaf certificate only; no revocation, CT, full-chain strength or CA compromise checks."}
