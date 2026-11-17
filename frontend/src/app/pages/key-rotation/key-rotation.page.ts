import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { RotationStartRequest } from '../../../../../shared/api';
import { InvalidRecoveryCodeError } from '../../../../../shared/utils/recoveryCode';
import { KeyApiService } from 'src/app/services/key-api.service';
import { KeySessionService } from 'src/app/services/key-session.service';
import { CryptoService } from 'src/app/services/crypto.service';
import { JobProgress, ReencryptJobService } from 'src/app/services/reencrypt-job.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { ToastService } from 'src/app/services/toast.service';
import { WrongRecoveryCodeError } from 'src/app/util/crypto/errors';

/**
 * Key rotation (P6), entirely in the key manager's browser:
 * 1. the org is frozen (key management page)
 * 2. generate key version n+1 and its recovery code, which the key manager types back
 * 3. upload the own grant, the continuity proof and the new recovery key (org state `rotating`)
 * 4. re-encrypt every value from version n to n+1 (resumable)
 * 5. grant n+1 to every member who held n; the server checks nothing is left under n, drops the
 *    old grants, makes the new recovery key the current one and unfreezes
 *
 * Because the new recovery key is stored in step 3, losing the own grant (re-enrolment, lost
 * passphrase, revoked or disabled account) doesn't strand the rotation: any key manager can
 * recover the new key with the new code (and the old key with the old code) and resume.
 */
@Component({
  selector: 'app-key-rotation-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './key-rotation.page.html',
})
export class KeyRotationPage {
  protected session = inject(KeySessionService);
  private api = inject(KeyApiService);
  private crypto = inject(CryptoService);
  private job = inject(ReencryptJobService);
  private dialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);

  protected busy = signal(false);
  protected error = signal<string | null>(null);
  protected progress = signal<JobProgress | null>(null);
  protected reencrypted = signal(false);
  protected recoveryCode = signal<string | null>(null);
  protected recoveryTyped = signal('');
  protected recoverInput = signal('');
  /** The start request prepared in step 2, uploaded once the recovery code was typed back. */
  private prepared: RotationStartRequest | null = null;

  protected org = computed(() => this.session.status()?.org ?? null);
  protected recoveryConfirmed = computed(() => {
    const norm = (s: string) => s.toUpperCase().replace(/[\s-]/g, '');
    const code = this.recoveryCode();
    return !!code && norm(code) === norm(this.recoveryTyped());
  });

  constructor() {
    this.session.ensureLoaded();
  }

  /** Runs one step with busy flag and error message. */
  private async step(run: () => Promise<void>) {
    this.busy.set(true);
    this.error.set(null);
    try {
      await run();
    } catch (e) {
      console.error(e);
      this.error.set(
        e instanceof WrongRecoveryCodeError || e instanceof InvalidRecoveryCodeError
          ? 'Der Wiederherstellungscode ist nicht korrekt.'
          : 'Der Schritt ist fehlgeschlagen. Sie können ihn erneut starten; Fortschritt bleibt erhalten.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Step 2: the new key, the key manager's own grant for it, the continuity proof (the new key's
   * fingerprint encrypted under the current key) that other browsers check before they accept
   * the new version, and the new recovery code. Nothing is uploaded until the code is typed back.
   */
  protected prepareRotation() {
    this.dialog.open({
      title: 'Schlüssel erneuern',
      text: 'Die Organisation bleibt eingefroren, bis alle Daten mit dem neuen Schlüssel verschlüsselt sind. Lassen Sie diesen Tab dabei geöffnet.',
      style: 'warning',
      confirmAction: () =>
        this.step(async () => {
          const org = this.org()!;
          const keyVersion = org.keyVersion + 1;
          const me = this.session.requireKeyPair();
          const dek = await this.crypto.generateDataKey();
          const ctx = { orgId: org.id, keyVersion };
          const code = this.crypto.generateRecoveryCode();
          this.prepared = {
            keyVersion,
            grant: await this.crypto.sealGrant(dek, me.publicKey, ctx),
            proof: await this.crypto.sealKeyProof(
              await this.crypto.fingerprintDataKey(dek),
              this.session.currentKey(),
              ctx,
            ),
            recoveryWrappedKey: await this.crypto.sealRecovery(dek, code, ctx),
          };
          this.recoveryTyped.set('');
          this.recoveryCode.set(code);
        }),
    });
  }

  /** Step 3: uploads what step 2 prepared; the org is `rotating` from now on. */
  protected startRotation() {
    return this.step(async () => {
      await this.api.startRotation(this.org()!.id, this.prepared!);
      this.prepared = null;
      this.recoveryCode.set(null);
      this.recoveryTyped.set('');
      await this.session.refresh();
    });
  }

  /** Whether this tab holds the key of `version`. */
  private holds(version: number | null | undefined): boolean {
    return !!version && !!this.session.keyResolver(version);
  }

  /** Whether this tab holds both keys the re-encryption needs, the current and the pending one. */
  protected keysAvailable(): boolean {
    const org = this.org();
    return !!org && this.holds(org.keyVersion) && this.holds(org.pendingKeyVersion);
  }

  /** Whether this tab holds the pending key; if not, it has to be recovered with the new code. */
  protected pendingKeyAvailable(): boolean {
    return this.holds(this.org()?.pendingKeyVersion);
  }

  /** Whether this tab holds the current key; if not, it has to be recovered with the old code. */
  protected currentKeyAvailable(): boolean {
    return this.holds(this.org()?.keyVersion);
  }

  /**
   * Resumes a rotation this tab lacks a key for: recovers the current key with the old recovery
   * code or the pending key with the new one, whichever the typed code opens.
   */
  protected recover() {
    return this.step(async () => {
      const version = await this.session.recover(this.recoverInput());
      this.recoverInput.set('');
      this.toast.show({
        title: 'Schlüssel wiederhergestellt',
        text: `Schlüsselversion ${version} ist in diesem Tab entsperrt.`,
        severity: 'success',
      });
    });
  }

  /** The new key, opened from the own grant for the pending version. */
  private pendingKey() {
    const org = this.org()!;
    const version = org.pendingKeyVersion!;
    const key = this.session.keyResolver(version);
    if (!key) throw new Error('Der neue Schlüssel ist in diesem Tab nicht entsperrt.');
    return { version, key };
  }

  /** Step 4: re-encrypt everything; resumes where an earlier run stopped. */
  protected reencrypt() {
    return this.step(async () => {
      const org = this.org()!;
      await this.job.run(
        org.id,
        'rotation',
        this.pendingKey(),
        this.session.keyResolver,
        (p) => this.progress.set(p),
      );
      this.reencrypted.set(true);
    });
  }

  /**
   * Step 5: grants the new key to every member who held the old one with the same key pair
   * (their fingerprints were checked then), and completes the rotation.
   */
  protected complete() {
    return this.step(async () => {
      const org = this.org()!;
      const keyVersion = org.pendingKeyVersion!;
      const ctx = { orgId: org.id, keyVersion };
      const myGrant = this.session.ownGrant(keyVersion);
      const me = this.session.requireKeyPair();
      const members = await this.api.getMembers(org.id);

      const grants = await Promise.all(
        members
          .filter((m) => m.needsKeys && m.publicKey && m.grant?.publicKey === m.publicKey)
          .map(async (m) => ({
            userId: m.id,
            publicKey: m.publicKey!,
            wrappedKey: await this.crypto.regrant(
              myGrant,
              me,
              await this.crypto.importPublicKey(m.publicKey!),
              ctx,
            ),
          })),
      );

      await this.api.completeRotation(org.id, { grants });
      this.session.lock();
      await this.session.refresh();
      this.toast.show({
        title: 'Schlüssel erneuert',
        text: `Die Organisation nutzt jetzt Schlüsselversion ${keyVersion} und ist wieder aufgetaut. Bitte entsperren Sie erneut.`,
        severity: 'success',
      });
    });
  }
}
