import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ENCRYPTION_KEY = process.env.VOICE_PII_ENCRYPTION_KEY;
const KEY_LENGTH = 32; // 256 bits

export function encryptPhone(phone: string): string | null {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== KEY_LENGTH) {
    return null;
  }
  const iv = randomBytes(12); // GCM standard
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
  const encrypted = Buffer.concat([cipher.update(phone, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store iv+tag+ciphertext base64
  const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
  return payload;
}

export function decryptPhone(payload: string): string | null {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== KEY_LENGTH) return null;
  const data = Buffer.from(payload, 'base64');
  const iv = data.slice(0, 12);
  const tag = data.slice(12, 28);
  const ciphertext = data.slice(28);
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf-8');
}
