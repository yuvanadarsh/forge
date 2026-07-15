"""AES-256-GCM encryption for API keys.

Stored format: base64( 12-byte nonce || ciphertext+tag ).
The 256-bit key is derived as SHA-256(secret) so any SECRET_KEY string works,
including the recommended `openssl rand -hex 32` output.
"""

import base64
import hashlib
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_NONCE_BYTES = 12


class CryptoError(Exception):
    """Raised when decryption fails (wrong secret or corrupted ciphertext)."""


def _derive_key(secret: str) -> bytes:
    if not secret:
        raise CryptoError("SECRET_KEY is empty — set it in the environment")
    return hashlib.sha256(secret.encode("utf-8")).digest()


def encrypt_key(plaintext: str, secret: str) -> str:
    key = _derive_key(secret)
    nonce = os.urandom(_NONCE_BYTES)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt_key(ciphertext: str, secret: str) -> str:
    key = _derive_key(secret)
    try:
        raw = base64.b64decode(ciphertext.encode("ascii"))
        nonce, ct = raw[:_NONCE_BYTES], raw[_NONCE_BYTES:]
        return AESGCM(key).decrypt(nonce, ct, None).decode("utf-8")
    except (InvalidTag, ValueError) as exc:
        raise CryptoError("Failed to decrypt API key (wrong SECRET_KEY or corrupted data)") from exc


def get_secret_key() -> str:
    """SECRET_KEY from environment — the only secret allowed in .env."""
    secret = os.getenv("SECRET_KEY", "")
    if not secret:
        raise CryptoError("SECRET_KEY environment variable is not set")
    return secret


def self_test() -> None:
    """Round-trip check: encrypt → decrypt returns the original, tamper fails."""
    secret = "test-secret-0123456789abcdef"
    sample = "sk-ant-api03-example-key-abcd"

    encrypted = encrypt_key(sample, secret)
    assert encrypted != sample
    assert decrypt_key(encrypted, secret) == sample

    # Same plaintext twice must differ (random nonce)
    assert encrypt_key(sample, secret) != encrypted

    # Wrong secret must fail loudly
    try:
        decrypt_key(encrypted, "wrong-secret")
        raise AssertionError("decrypt with wrong secret should have failed")
    except CryptoError:
        pass

    print("crypto self_test OK")


if __name__ == "__main__":
    self_test()
