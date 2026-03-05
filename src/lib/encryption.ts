/**
 * AES-256-GCM encryption utilities for storing secrets at rest.
 *
 * Ciphertext format: "v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * - v1 prefix for future key rotation support
 * - 12-byte random IV
 * - 16-byte GCM auth tag
 * - Variable-length ciphertext
 *
 * Encryption key MUST come from APP_ENCRYPTION_KEY env var (32 bytes, hex-encoded).
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const VERSION_PREFIX = "v1";

function getEncryptionKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("APP_ENCRYPTION_KEY environment variable is not set");
  }

  // Accept hex (64 chars = 32 bytes) or base64 (44 chars = 32 bytes)
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }

  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars or 44 base64 chars)");
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  return `${VERSION_PREFIX}:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new Error("Invalid ciphertext format");
  }

  const [, ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}
