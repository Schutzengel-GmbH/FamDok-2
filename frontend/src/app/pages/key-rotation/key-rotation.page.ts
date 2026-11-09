import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { KeyApiService } from 'src/app/services/key-api.service';
import { KeySessionService } from 'src/app/services/key-session.service';
import { CryptoService } from 'src/app/services/crypto.service';
import { JobProgress, ReencryptJobService } from 'src/app/services/reencrypt-job.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { ToastService } from 'src/app/services/toast.service';

/**
 * Key rotation (P6), entirely in the coordinator's browser:
 * 1. the org is frozen (key management page)
 * 2. generate key version n+1 and upload the own grant for it (org state `rotating`)
 * 3. re-encrypt every value from version n to n+1 (resumable)
 * 4. grant n+1 to every member who held n, show and confirm a new recovery code
 * 5. the server checks nothing is left under n, drops the old grants and unfreezes
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
  private recoveryWrappedKey: string | null = null;

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
        'Der Schritt ist fehlgeschlagen. Sie können ihn erneut starten; Fortschritt bleibt erhalten.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Step 2: the new key, the key manager's own grant for it, and the continuity proof (the new
   * key's fingerprint encrypted under the current key) that other browsers check before they
   * accept the new version.
   */
  protected startRotation() {
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
          const grant = await this.crypto.sealGrant(dek, me.publicKey, ctx);
          const proof = await this.crypto.sealKeyProof(
            await this.crypto.fingerprintDataKey(dek),
            this.session.currentKey(),
            ctx,
          );
          await this.api.startRotation(org.id, { keyVersion, grant, proof });
          await this.session.refresh();
        }),
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

  /** Step 3: re-encrypt everything; resumes where an earlier run stopped. */
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

  /** Step 4a: the new recovery code, wrapped in the browser, not yet uploaded. */
  protected prepareRecovery() {
    return this.step(async () => {
      const org = this.org()!;
      const ctx = { orgId: org.id, keyVersion: org.pendingKeyVersion! };
      const code = this.crypto.generateRecoveryCode();
      this.recoveryWrappedKey = await this.crypto.sealRecoveryViaGrant(
        this.session.ownGrant(ctx.keyVersion),
        this.session.requireKeyPair(),
        code,
        ctx,
      );
      this.recoveryCode.set(code);
    });
  }

  /**
   * Step 4b + 5: grants the new key to every member who held the old one with the same key pair
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

      await this.api.completeRotation(org.id, {
        grants,
        recoveryWrappedKey: this.recoveryWrappedKey!,
      });
      this.recoveryCode.set(null);
      this.recoveryTyped.set('');
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
