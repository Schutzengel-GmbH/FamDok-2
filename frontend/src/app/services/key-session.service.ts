import { computed, inject, Injectable, Injector, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { KeyStatus } from '../../../../shared/api';
import { CryptoService, KeyResolver, UnlockedDataKey } from './crypto.service';
import { KeyApiService } from './key-api.service';
import { KdfService } from './kdf.service';
import { MeService } from './me.service';
import { newKdfParams } from '../util/crypto/kdf';
import {
  InvalidGrantError,
  KeysLockedError,
  WrongRecoveryCodeError,
} from '../util/crypto/errors';
import {
  checkKeyChain,
  clearKeyPin,
  hasSeenEncryption,
  readKeyPin,
  writeKeyPin,
} from '../util/crypto/keyPins';

/**
 * Where the current user stands with the org encryption:
 * - `loading`: status not fetched yet
 * - `disabled`: the server runs without `ORG_ENCRYPTION_ENABLED`; no encryption feature is shown
 * - `notNeeded`: the role never holds the org key (Admin, Controller)
 * - `orgNotSetUp`: the org hasn't set up encryption yet; data is still plaintext
 * - `needsEnrolment`: the user has no key pair yet
 * - `locked`: key pair exists, the passphrase hasn't been entered in this tab
 * - `awaitingGrant`: unlocked, but no coordinator has granted the current key yet
 * - `unlocked`: the org data key is available in this tab
 * - `frozen`: the org is frozen or rotating; coordinators stay `unlocked` to run the rotation
 * - `keyMismatch`: the server presents a key this browser can't trace back to one it trusted
 */
export type KeySessionState =
  | 'loading'
  | 'disabled'
  | 'notNeeded'
  | 'orgNotSetUp'
  | 'needsEnrolment'
  | 'locked'
  | 'awaitingGrant'
  | 'unlocked'
  | 'frozen'
  | 'keyMismatch';

/**
 * The keys of the current tab. The private key and the org data keys live only in this
 * service's memory as non-extractable CryptoKeys; reloading or closing the tab, logging out or
 * locking discards them. Everything that encrypts or decrypts personal data gets its keys here.
 */
@Injectable({ providedIn: 'root' })
export class KeySessionService {
  private api = inject(KeyApiService);
  private crypto = inject(CryptoService);
  private kdf = inject(KdfService);
  // resolved on first use: MeService needs Keycloak, which pages without login don't provide
  private injector = inject(Injector);

  /** The last status fetched from `/keys/me`. */
  readonly status = signal<KeyStatus | null>(null);
  /** See {@link KeySessionState}. */
  readonly state = signal<KeySessionState>('loading');
  /** Fingerprint of the user's own public key, once known. */
  readonly ownFingerprint = signal<string | null>(null);
  /** Fingerprint of the current org data key, once unlocked. */
  readonly orgKeyFingerprint = signal<string | null>(null);
  /** Set when this browser sees a newer key version than last time, so the UI can say so. */
  readonly rotationNotice = signal<{ from: number; to: number } | null>(null);
  /** Why the state is `keyMismatch`. */
  readonly mismatchReason = signal<string | null>(null);
  /**
   * In `keyMismatch`: version and fingerprint of the key the server presents as current, for
   * comparing with a key manager before {@link acceptPresentedKey}.
   */
  readonly presentedKey = signal<{ keyVersion: number; fingerprint: string } | null>(null);
  /** Whether the private key is unlocked in this tab (independent of any grant). */
  readonly keyPairReady = signal(false);

  /**
   * Whether the server offers the org encryption at all (`ORG_ENCRYPTION_ENABLED`). If not, every
   * encryption feature stays hidden.
   */
  readonly encryptionEnabled = computed(() => !!this.status()?.enabled);

  /** True once the org encrypts its data, i.e. reads must decrypt and writes must encrypt. */
  readonly encryptionActive = computed(() => {
    const org = this.status()?.org;
    return this.encryptionEnabled() && !!org && org.keyState !== 'uninitialized';
  });

  private keyPair: CryptoKeyPair | null = null;
  private dataKeys = new Map<number, UnlockedDataKey>();
  private userId: string | null = null;
  private loading: Promise<void> | null = null;

  /** Fetches the status once; later calls wait for the same request. */
  ensureLoaded(): Promise<void> {
    this.loading ??= this.refresh().catch((e) => {
      this.loading = null;
      throw e;
    });
    return this.loading;
  }

  /**
   * Fetches the status again and opens grants that became available, e.g. after a coordinator
   * granted access or a rotation completed.
   */
  async refresh(): Promise<void> {
    const [status, me] = await Promise.all([
      this.api.getStatus(),
      firstValueFrom(this.injector.get(MeService).getMe()),
    ]);
    this.userId = me.id;
    this.status.set(status);
    if (this.keyPair && status.userKey) await this.openGrants();
    this.updateState();
  }

  /**
   * First enrolment, or a new key pair after a forgotten passphrase (`replace`, which drops all
   * grants). Generates the key pair, wraps the private key under the passphrase and uploads it.
   * Returns the fingerprint to compare with a coordinator.
   */
  async enrol(passphrase: string): Promise<string> {
    await this.ensureLoaded();
    const userId = this.requireUserId();
    const pair = await this.crypto.generateUserKeyPair();
    const params = newKdfParams();
    const kek = await this.kdf.deriveKek(passphrase, params);
    const wrappedPrivateKey = await this.crypto.wrapPrivateKey(pair.privateKey, kek, userId);
    const publicKey = await this.crypto.exportPublicKey(pair.publicKey);

    await this.api.enrol({
      publicKey,
      wrappedPrivateKey,
      kdfParams: params,
      replace: !!this.status()?.userKey,
    });

    this.keyPair = {
      privateKey: await this.crypto.unwrapPrivateKey(wrappedPrivateKey, kek, userId),
      publicKey: await this.crypto.importPublicKey(publicKey),
    };
    this.dataKeys.clear();
    const fingerprint = await this.crypto.publicKeyFingerprint(publicKey);
    this.ownFingerprint.set(fingerprint);
    await this.refresh();
    return fingerprint;
  }

  /**
   * Unlocks with the passphrase: derive the KEK, unwrap the private key, open the grants.
   * Throws `WrongPassphraseError` for a wrong passphrase.
   */
  async unlock(passphrase: string): Promise<void> {
    await this.ensureLoaded();
    const userKey = this.status()?.userKey;
    if (!userKey) throw new KeysLockedError('No key pair to unlock');
    const kek = await this.kdf.deriveKek(passphrase, userKey.kdfParams);
    const privateKey = await this.crypto.unwrapPrivateKey(
      userKey.wrappedPrivateKey,
      kek,
      this.requireUserId(),
    );
    this.keyPair = {
      privateKey,
      publicKey: await this.crypto.importPublicKey(userKey.publicKey),
    };
    this.ownFingerprint.set(await this.crypto.publicKeyFingerprint(userKey.publicKey));
    await this.openGrants();
    this.updateState();
  }

  /** Forgets all keys of this tab. */
  lock() {
    this.keyPair = null;
    this.dataKeys.clear();
    this.orgKeyFingerprint.set(null);
    this.updateState();
  }

  /**
   * Leaves `keyMismatch` by trusting the key the server presents now, after the user compared
   * its fingerprint with a key manager out of band. Without a presented key (the server claims
   * the org is unencrypted) the pin is just forgotten.
   */
  async acceptPresentedKey(): Promise<void> {
    const orgId = this.requireOrgId();
    const presented = this.presentedKey();
    if (presented) writeKeyPin(orgId, presented);
    else clearKeyPin(orgId);
    this.mismatchReason.set(null);
    this.presentedKey.set(null);
    this.dataKeys.clear();
    await this.refresh();
  }

  /** Re-wraps the private key under a new passphrase; the key pair and grants stay. */
  async changePassphrase(oldPassphrase: string, newPassphrase: string): Promise<void> {
    await this.ensureLoaded();
    const userKey = this.status()?.userKey;
    if (!userKey) throw new KeysLockedError('No key pair');
    const params = newKdfParams();
    const [oldKek, newKek] = await Promise.all([
      this.kdf.deriveKek(oldPassphrase, userKey.kdfParams),
      this.kdf.deriveKek(newPassphrase, params),
    ]);
    const wrappedPrivateKey = await this.crypto.rewrapPrivateKey(
      userKey.wrappedPrivateKey,
      oldKek,
      newKek,
      this.requireUserId(),
    );
    await this.api.changePassphrase({ wrappedPrivateKey, kdfParams: params });
    await this.refresh();
  }

  /**
   * First step of setting up an org's encryption: generates key version 1, the coordinator's
   * self-grant and the recovery code. Nothing is uploaded until `commit` runs, which the UI only
   * calls once the coordinator has typed the recovery code back.
   */
  async prepareOrgSetup(): Promise<{ recoveryCode: string; commit: () => Promise<void> }> {
    const orgId = this.requireOrgId();
    const me = this.requireKeyPair();
    const ctx = { orgId, keyVersion: 1 };
    const dek = await this.crypto.generateDataKey();
    const grant = await this.crypto.sealGrant(dek, me.publicKey, ctx);
    const recoveryCode = this.crypto.generateRecoveryCode();
    const recoveryWrappedKey = await this.crypto.sealRecovery(dek, recoveryCode, ctx);
    return {
      recoveryCode,
      commit: async () => {
        await this.api.setupOrg(orgId, { grant, recoveryWrappedKey });
        await this.refresh();
      },
    };
  }

  /**
   * A key manager without access (lost passphrase, new key manager) regains a key with one of
   * the org's recovery codes and grants it to their own key pair. During a rotation there are
   * two codes: the old one for the current key and the new one for the pending key, so a
   * rotation whose key manager lost access can be resumed; each call recovers the key the code
   * opens. Throws `WrongRecoveryCodeError` if it opens none. Returns the recovered version.
   */
  async recover(recoveryCode: string): Promise<number> {
    const orgId = this.requireOrgId();
    const me = this.requireKeyPair();
    const userKey = this.status()!.userKey!;
    for (const { keyVersion, recoveryWrappedKey } of await this.api.getRecovery(orgId)) {
      let grant: string;
      try {
        ({ grant } = await this.crypto.openRecovery(
          recoveryWrappedKey,
          recoveryCode,
          { orgId, keyVersion },
          me.publicKey,
        ));
      } catch (e) {
        if (e instanceof WrongRecoveryCodeError) continue;
        throw e;
      }
      await this.api.grant(orgId, {
        userId: this.requireUserId(),
        keyVersion,
        wrappedKey: grant,
        publicKey: userKey.publicKey,
      });
      await this.refresh();
      return keyVersion;
    }
    throw new WrongRecoveryCodeError();
  }

  /** Looks up an unlocked data key by version, for decryption. */
  readonly keyResolver: KeyResolver = (version) => this.dataKeys.get(version)?.key;

  /** The key new ciphertext is written with. Throws `KeysLockedError` if not unlocked. */
  currentKey(): UnlockedDataKey {
    const version = this.status()?.org?.keyVersion;
    const key = version ? this.dataKeys.get(version) : undefined;
    if (!key) throw new KeysLockedError();
    return key;
  }

  /** Whether personal data can be decrypted in this tab right now. */
  isUnlocked(): boolean {
    return this.state() === 'unlocked';
  }

  /** The unlocked key pair, for coordinators sealing grants. */
  requireKeyPair(): CryptoKeyPair {
    if (!this.keyPair) throw new KeysLockedError();
    return this.keyPair;
  }

  /** The user's own grant for `keyVersion`, for regranting it to others. */
  ownGrant(keyVersion: number): string {
    const grant = this.status()?.grants.find((g) => g.keyVersion === keyVersion);
    if (!grant) throw new KeysLockedError(`No grant for key version ${keyVersion}`);
    return grant.wrappedKey;
  }

  /** The id of the user's organisation. */
  requireOrgId(): string {
    const id = this.status()?.org?.id;
    if (!id) throw new Error('No organisation');
    return id;
  }

  /** The id of the logged-in user. */
  requireUserId(): string {
    if (!this.userId) throw new Error('User not loaded');
    return this.userId;
  }

  /**
   * Opens every grant sealed to the current key pair, verifies the continuity proofs between
   * consecutive versions and keeps only the versions {@link checkKeyChain} trusts. If the current
   * version isn't among them, the session holds no key at all and goes to `keyMismatch`.
   */
  private async openGrants() {
    const status = this.status();
    const org = status?.org;
    if (!status?.userKey || !org || !this.keyPair || this.mismatchReason()) return;

    const opened = new Map<number, UnlockedDataKey>();
    for (const grant of status.grants) {
      if (grant.publicKey !== status.userKey.publicKey) continue;
      try {
        opened.set(
          grant.keyVersion,
          await this.crypto.openGrant(grant.wrappedKey, this.keyPair, {
            orgId: org.id,
            keyVersion: grant.keyVersion,
          }),
        );
      } catch (e) {
        if (!(e instanceof InvalidGrantError)) throw e;
      }
    }

    const links = new Set<number>();
    for (const { keyVersion, proof } of status.keyProofs) {
      const previous = opened.get(keyVersion - 1);
      const next = opened.get(keyVersion);
      if (previous && next && (await this.crypto.verifyKeyProof(proof, previous, next, org.id)))
        links.add(keyVersion);
    }

    const result = checkKeyChain({
      pin: readKeyPin(org.id),
      held: [...opened.values()].map((k) => ({ keyVersion: k.version, fingerprint: k.fingerprint })),
      links,
      currentVersion: org.keyVersion,
    });
    this.dataKeys.clear();
    if (!result.ok) {
      const presented = opened.get(org.keyVersion);
      this.presentedKey.set(
        presented ? { keyVersion: presented.version, fingerprint: presented.fingerprint } : null,
      );
      this.orgKeyFingerprint.set(null);
      this.mismatchReason.set(result.reason);
      return;
    }

    for (const version of result.trusted) this.dataKeys.set(version, opened.get(version)!);
    if (result.pin) {
      writeKeyPin(org.id, result.pin);
      this.orgKeyFingerprint.set(result.pin.fingerprint);
    }
    if (result.rotatedFrom)
      this.rotationNotice.set({ from: result.rotatedFrom, to: org.keyVersion });
  }

  /** Derives {@link state} from the status and the keys held. */
  private updateState() {
    this.keyPairReady.set(!!this.keyPair);
    const status = this.status();
    const org = status?.org;
    if (!status) return this.state.set('loading');
    if (this.mismatchReason()) return this.state.set('keyMismatch');
    if (!status.enabled) {
      // a server that has seen this browser's org encrypted can't switch the encryption off
      if (org && hasSeenEncryption(org.id)) {
        this.mismatchReason.set(
          'Der Server meldet, dass die Verschlüsselung abgeschaltet ist, obwohl dieser Browser den Schlüssel der Organisation kennt.',
        );
        return this.state.set('keyMismatch');
      }
      return this.state.set('disabled');
    }
    if (!status.needsKeys || !org) return this.state.set('notNeeded');
    if (org.keyState === 'uninitialized') {
      if (hasSeenEncryption(org.id)) {
        this.mismatchReason.set(
          'Der Server meldet, dass die Organisation nicht verschlüsselt ist, obwohl dieser Browser ihren Schlüssel kennt.',
        );
        return this.state.set('keyMismatch');
      }
      return this.state.set('orgNotSetUp');
    }
    if (org.keyState !== 'active' && !status.canManageKeys) return this.state.set('frozen');
    if (!status.userKey) return this.state.set('needsEnrolment');
    if (!this.keyPair) return this.state.set('locked');
    if (!this.dataKeys.has(org.keyVersion)) return this.state.set('awaitingGrant');
    return this.state.set('unlocked');
  }
}
