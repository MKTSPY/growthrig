import { createHash, randomBytes } from 'crypto';

export async function createRandomNonce(length = 32): Promise<string> {
  return randomBytes(length).toString('hex');
}

export function hashConfirmationNonce(nonce: string): string {
  return createHash('sha256').update(nonce).digest('hex');
}
