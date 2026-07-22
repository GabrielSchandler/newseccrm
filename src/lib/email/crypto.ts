import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

function resolveEncryptionKey() {
  const rawKey = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error("EMAIL_TOKEN_ENCRYPTION_KEY não configurada.");
  }

  const base64Key = Buffer.from(rawKey, "base64");

  if (base64Key.length === 32) {
    return base64Key;
  }

  const utf8Key = Buffer.from(rawKey, "utf8");

  if (utf8Key.length === 32) {
    return utf8Key;
  }

  return scryptSync(rawKey, "grscrm-email-token", 32);
}

export function encryptEmailSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", resolveEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptEmailSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Token criptografado inválido.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    resolveEncryptionKey(),
    Buffer.from(ivValue, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
