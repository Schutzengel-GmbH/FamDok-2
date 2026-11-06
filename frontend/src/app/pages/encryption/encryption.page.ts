import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { KeySessionService } from 'src/app/services/key-session.service';
import { MeService } from 'src/app/services/me.service';
import { ToastService } from 'src/app/services/toast.service';
import { PassphraseInputComponent } from 'src/app/components/passphrase-input/passphrase-input.component';
import {
  InvalidKdfParamsError,
  WrongPassphraseError,
  WrongRecoveryCodeError,
} from 'src/app/util/crypto/errors';
import { clearKeyPin } from 'src/app/util/crypto/keyPins';
import { InvalidRecoveryCodeError } from '../../../../../shared/utils/recoveryCode';

/**
 * Everything a user does with their own keys, depending on where they stand (see
 * `KeySessionState`): set up a key pair, unlock it, wait for a coordinator's grant, change the
 * passphrase. OrgCoordinators also set up their organisation's encryption here and recover
 * access with the recovery code.
 */
@Component({
  selector: 'app-encryption-page',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, RouterLink, PassphraseInputComponent],
  templateUrl: './encryption.page.html',
})
export class EncryptionPage {
  protected session = inject(KeySessionService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private meService = inject(MeService);

  protected busy = signal(false);
  protected error = signal<string | null>(null);

  protected passphrase = signal('');
  protected newPassphrase = signal('');
  protected newPassphraseValid = signal(false);
  protected changeOld = signal('');
  protected showChange = signal(false);
  protected showReenrol = signal(false);
  protected userInputs = signal<string[]>([]);

  protected recoveryCode = signal<string | null>(null);
  protected recoveryTyped = signal('');
  private commitSetup: (() => Promise<void>) | null = null;
  protected showRecover = signal(false);
  protected recoverInput = signal('');

  protected canManage = computed(() => !!this.session.status()?.canManageKeys);
  protected orgName = computed(() => this.session.status()?.org?.name ?? '');
  protected hasKeyPair = computed(() => !!this.session.status()?.userKey);

  private returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  constructor() {
    this.session.ensureLoaded().catch(() =>
      this.error.set('Der Verschlüsselungsstatus konnte nicht geladen werden.'),
    );
    firstValueFrom(this.meService.getMe()).then((me) =>
      this.userInputs.set(
        [me.firstName, me.lastName, me.email, 'famdok', 'flensburg'].filter(
          (s): s is string => !!s,
        ),
      ),
    );
  }

  /** Runs one step of a key flow, with the busy flag and error messages. */
  private async run(step: () => Promise<void>) {
    this.busy.set(true);
    this.error.set(null);
    try {
      await step();
    } catch (e) {
      this.error.set(this.describe(e));
    } finally {
      this.busy.set(false);
    }
  }

  /** A message for the errors the key flows can raise. */
  private describe(e: unknown): string {
    if (e instanceof WrongPassphraseError) return 'Die Passphrase ist nicht korrekt.';
    if (e instanceof WrongRecoveryCodeError || e instanceof InvalidRecoveryCodeError)
      return 'Der Wiederherstellungscode ist nicht korrekt.';
    if (e instanceof InvalidKdfParamsError)
      return 'Die gespeicherten Schlüsselparameter sind ungültig. Bitte wenden Sie sich an die Koordination.';
    return 'Der Vorgang ist fehlgeschlagen. Bitte versuchen Sie es erneut.';
  }

  /** Back to the page the guard sent the user away from, once the keys are ready. */
  private continue() {
    if (this.session.isUnlocked() && this.returnUrl)
      this.router.navigateByUrl(this.returnUrl);
  }

  /** Creates the user's key pair (first time, or `replace` after a forgotten passphrase). */
  protected enrol() {
    return this.run(async () => {
      await this.session.enrol(this.newPassphrase());
      this.newPassphrase.set('');
      this.showReenrol.set(false);
      this.toast.show({
        title: 'Schlüssel eingerichtet',
        text: 'Vergleichen Sie jetzt den Fingerabdruck mit Ihrer Koordination.',
        severity: 'success',
      });
    });
  }

  /** Unlocks with the passphrase. */
  protected unlock() {
    return this.run(async () => {
      await this.session.unlock(this.passphrase());
      this.passphrase.set('');
      this.continue();
    });
  }

  /** Locks this tab's keys. */
  protected lock() {
    this.session.lock();
  }

  /** Asks the server again, e.g. after the coordinator granted access. */
  protected checkAgain() {
    return this.run(async () => {
      await this.session.refresh();
      this.continue();
    });
  }

  /** Re-wraps the private key under a new passphrase. */
  protected changePassphrase() {
    return this.run(async () => {
      await this.session.changePassphrase(this.changeOld(), this.newPassphrase());
      this.changeOld.set('');
      this.newPassphrase.set('');
      this.showChange.set(false);
      this.toast.show({
        title: 'Passphrase geändert',
        text: 'Ab jetzt gilt die neue Passphrase.',
        severity: 'success',
      });
    });
  }

  /** Generates the org's first key and shows the recovery code; nothing is uploaded yet. */
  protected startOrgSetup() {
    return this.run(async () => {
      const { recoveryCode, commit } = await this.session.prepareOrgSetup();
      this.recoveryCode.set(recoveryCode);
      this.commitSetup = commit;
    });
  }

  /** Whether the typed recovery code matches the shown one (case and dashes don't matter). */
  protected recoveryConfirmed = computed(() => {
    const norm = (s: string) => s.toUpperCase().replace(/[\s-]/g, '');
    const code = this.recoveryCode();
    return !!code && norm(code) === norm(this.recoveryTyped());
  });

  /** Uploads the org setup once the recovery code was typed back. */
  protected finishOrgSetup() {
    return this.run(async () => {
      await this.commitSetup!();
      this.recoveryCode.set(null);
      this.recoveryTyped.set('');
      this.commitSetup = null;
      this.toast.show({
        title: 'Verschlüsselung eingerichtet',
        text: 'Personenbezogene Daten werden ab jetzt verschlüsselt gespeichert.',
        severity: 'success',
      });
    });
  }

  /** Regains the current key with the recovery code. */
  protected recover() {
    return this.run(async () => {
      await this.session.recover(this.recoverInput());
      this.recoverInput.set('');
      this.showRecover.set(false);
      this.continue();
    });
  }

  /**
   * Accepts a key that contradicts this browser's memory, after the user confirmed it with the
   * coordinator out of band.
   */
  protected acceptNewKey() {
    return this.run(async () => {
      clearKeyPin(this.session.requireOrgId());
      this.session.mismatchReason.set(null);
      this.session.lock();
      await this.session.refresh();
    });
  }
}
