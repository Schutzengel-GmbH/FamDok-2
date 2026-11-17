import { prisma } from '../db';
import { ORG_ENCRYPTION_ENABLED } from '../config';

/**
 * Refuses to run with `ORG_ENCRYPTION_ENABLED` off once any organisation has activated its
 * encryption. Its data is stored as ciphertext and can only be read and written with the
 * encryption features, so turning them off is a one-way street that can't be taken back.
 */
export async function assertEncryptionConfig(enabled = ORG_ENCRYPTION_ENABLED) {
  if (enabled) return;
  const encrypted = await prisma.organisation.findMany({
    where: { keyState: { not: 'uninitialized' } },
    select: { name: true },
  });
  if (encrypted.length > 0)
    throw new Error(
      `ORG_ENCRYPTION_ENABLED is off, but these organisations have activated their encryption: ` +
        `${encrypted.map((o) => o.name).join(', ')}. ` +
        'Once activated, the encryption cannot be turned off again; set ORG_ENCRYPTION_ENABLED=true.'
    );
}
