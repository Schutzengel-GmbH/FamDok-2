import {
  checkKeyChain,
  clearKeyPin,
  hasSeenEncryption,
  readKeyPin,
  writeKeyPin,
} from './keyPins';

const held = (...versions: [number, string][]) =>
  versions.map(([keyVersion, fingerprint]) => ({ keyVersion, fingerprint }));

describe('keyPins', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('stores, reads and clears pins per org', () => {
    expect(hasSeenEncryption('o')).toBeFalse();
    writeKeyPin('o', { keyVersion: 2, fingerprint: 'b' });
    expect(readKeyPin('o')).toEqual({ keyVersion: 2, fingerprint: 'b' });
    expect(hasSeenEncryption('o')).toBeTrue();
    expect(readKeyPin('p')).toBeUndefined();
    clearKeyPin('o');
    expect(readKeyPin('o')).toBeUndefined();
  });

  it('ignores a garbled pin', () => {
    localStorage.setItem('famdok.keyPin.o', '{"keyVersion":"x"}');
    expect(readKeyPin('o')).toBeUndefined();
  });
});

describe('checkKeyChain', () => {
  it('trusts the first key it sees and pins it', () => {
    const result = checkKeyChain({
      pin: undefined,
      held: held([1, 'a']),
      links: new Set(),
      currentVersion: 1,
    });
    expect(result).toEqual({
      ok: true,
      trusted: new Set([1]),
      pin: { keyVersion: 1, fingerprint: 'a' },
      rotatedFrom: undefined,
    });
  });

  it('follows verified proofs to a newer version and reports the rotation', () => {
    const result = checkKeyChain({
      pin: { keyVersion: 1, fingerprint: 'a' },
      held: held([1, 'a'], [2, 'b'], [3, 'c']),
      links: new Set([2, 3]),
      currentVersion: 3,
    });
    expect(result).toEqual({
      ok: true,
      trusted: new Set([1, 2, 3]),
      pin: { keyVersion: 3, fingerprint: 'c' },
      rotatedFrom: 1,
    });
  });

  it('trusts older versions backwards along proofs, e.g. for a pinned rotation in progress', () => {
    const result = checkKeyChain({
      pin: { keyVersion: 2, fingerprint: 'b' },
      held: held([1, 'a'], [2, 'b']),
      links: new Set([2]),
      currentVersion: 1,
    });
    expect(result.ok).toBeFalse(); // rollback below the pin

    const ok = checkKeyChain({
      pin: { keyVersion: 2, fingerprint: 'b' },
      held: held([1, 'a'], [2, 'b']),
      links: new Set([2]),
      currentVersion: 2,
    });
    expect(ok.ok && [...ok.trusted].sort()).toEqual([1, 2]);
  });

  it('refuses a newer version without a valid proof (operator-forged rotation)', () => {
    for (const pin of [{ keyVersion: 1, fingerprint: 'a' }, undefined]) {
      const result = checkKeyChain({
        pin,
        held: held([1, 'a'], [2, 'forged']),
        links: new Set(),
        currentVersion: 2,
      });
      expect(result.ok).toBeFalse();
    }
  });

  it('does not use a pending version without a proof, but keeps the current one', () => {
    const result = checkKeyChain({
      pin: { keyVersion: 1, fingerprint: 'a' },
      held: held([1, 'a'], [2, 'forged']),
      links: new Set(),
      currentVersion: 1,
    });
    expect(result.ok && [...result.trusted]).toEqual([1]);
  });

  it('refuses a rollback and a swapped key under the pinned version', () => {
    expect(
      checkKeyChain({
        pin: { keyVersion: 2, fingerprint: 'b' },
        held: held([1, 'a']),
        links: new Set(),
        currentVersion: 1,
      }).ok,
    ).toBeFalse();
    expect(
      checkKeyChain({
        pin: { keyVersion: 1, fingerprint: 'a' },
        held: held([1, 'x']),
        links: new Set(),
        currentVersion: 1,
      }).ok,
    ).toBeFalse();
  });

  it('cannot verify a new version if the user no longer holds the pinned one', () => {
    const result = checkKeyChain({
      pin: { keyVersion: 1, fingerprint: 'a' },
      held: held([3, 'c']),
      links: new Set(),
      currentVersion: 3,
    });
    expect(result.ok).toBeFalse();
  });

  it('waits without complaint while the user holds no current grant', () => {
    const result = checkKeyChain({
      pin: { keyVersion: 1, fingerprint: 'a' },
      held: [],
      links: new Set(),
      currentVersion: 2,
    });
    expect(result).toEqual({ ok: true, trusted: new Set() });
  });
});
