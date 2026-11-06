import { checkKeyPin, clearKeyPin, hasSeenEncryption, readKeyPin } from './keyPins';
import { KeyPinMismatchError } from './errors';

describe('keyPins', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('pins the first key it sees', () => {
    expect(hasSeenEncryption('o')).toBeFalse();
    expect(checkKeyPin('o', { keyVersion: 1, fingerprint: 'a' })).toEqual({ rotated: false, previous: undefined });
    expect(readKeyPin('o')).toEqual({ keyVersion: 1, fingerprint: 'a' });
    expect(hasSeenEncryption('o')).toBeTrue();
  });

  it('accepts the same key again and reports a newer version', () => {
    checkKeyPin('o', { keyVersion: 1, fingerprint: 'a' });
    expect(checkKeyPin('o', { keyVersion: 1, fingerprint: 'a' }).rotated).toBeFalse();
    expect(checkKeyPin('o', { keyVersion: 2, fingerprint: 'b' }).rotated).toBeTrue();
    expect(readKeyPin('o')!.keyVersion).toBe(2);
  });

  it('refuses an older version or a different key under the same version', () => {
    checkKeyPin('o', { keyVersion: 2, fingerprint: 'b' });
    expect(() => checkKeyPin('o', { keyVersion: 1, fingerprint: 'a' })).toThrowError(KeyPinMismatchError);
    expect(() => checkKeyPin('o', { keyVersion: 2, fingerprint: 'x' })).toThrowError(KeyPinMismatchError);
    expect(readKeyPin('o')).toEqual({ keyVersion: 2, fingerprint: 'b' });
  });

  it('keeps orgs apart and can be cleared', () => {
    checkKeyPin('o', { keyVersion: 2, fingerprint: 'b' });
    expect(() => checkKeyPin('p', { keyVersion: 1, fingerprint: 'a' })).not.toThrow();
    clearKeyPin('o');
    expect(readKeyPin('o')).toBeUndefined();
  });
});
