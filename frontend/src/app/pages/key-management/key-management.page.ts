import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { OrgKeyEventView, OrgKeyMember } from '../../../../../shared/api';
import { KeyApiService } from 'src/app/services/key-api.service';
import { KeySessionService } from 'src/app/services/key-session.service';
import { CryptoService } from 'src/app/services/crypto.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { ToastService } from 'src/app/services/toast.service';

import { EncryptionOptInComponent } from 'src/app/components/encryption-opt-in/encryption-opt-in.component';
/** A member row with the fingerprint this browser computed from their public key. */
type MemberRow = OrgKeyMember & {
  fingerprint: string | null;
  status: 'notEnrolled' | 'awaiting' | 'granted' | 'keyChanged' | 'noKeysNeeded';
};

const EVENT_LABELS: Record<string, string> = {
  setup: 'Verschlüsselung eingerichtet',
  enrol: 'Schlüssel eingerichtet',
  reenrol: 'Neuen Schlüssel eingerichtet',
  passphraseChanged: 'Passphrase geändert',
  grant: 'Zugang freigegeben',
  revoke: 'Zugang entzogen',
  recovery: 'Mit Wiederherstellungscode freigeschaltet',
  freeze: 'Organisation eingefroren',
  unfreeze: 'Organisation aufgetaut',
  rotationStarted: 'Schlüsselerneuerung gestartet',
  rotationCompleted: 'Schlüsselerneuerung abgeschlossen',
};

/**
 * The key managers' (OrgCoordinator, OrgController) view of their org's keys: who has
 * enrolled, who is waiting for access (with the fingerprint to compare out of band), granting
 * and revoking, freezing, and the key log. Fingerprints are always computed here from the public keys, never taken from the server.
 */
@Component({
  selector: 'app-key-management-page',
  standalone: true,
  imports: [DatePipe, RouterLink, EncryptionOptInComponent],
  templateUrl: './key-management.page.html',
})
export class KeyManagementPage {
  protected session = inject(KeySessionService);
  private api = inject(KeyApiService);
  private crypto = inject(CryptoService);
  private dialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected members = signal<MemberRow[]>([]);
  protected events = signal<OrgKeyEventView[]>([]);
  protected busy = signal(false);

  protected org = computed(() => this.session.status()?.org ?? null);
  protected waiting = computed(() => this.members().filter((m) => m.status === 'awaiting' || m.status === 'keyChanged'));

  constructor() {
    this.load();
  }

  /** Loads members and log, and computes each member's fingerprint locally. */
  protected async load() {
    await this.session.ensureLoaded();
    if (!this.session.status()?.canManageKeys) {
      this.router.navigateByUrl('/verschluesselung');
      return;
    }
    const orgId = this.session.requireOrgId();
    const [members, events] = await Promise.all([
      this.api.getMembers(orgId),
      this.api.getEvents(orgId),
    ]);
    this.members.set(
      await Promise.all(
        members.map(async (m) => ({
          ...m,
          fingerprint: m.publicKey ? await this.crypto.publicKeyFingerprint(m.publicKey) : null,
          status: !m.needsKeys
            ? ('noKeysNeeded' as const)
            : !m.publicKey
              ? ('notEnrolled' as const)
              : !m.grant
                ? ('awaiting' as const)
                : m.grant.publicKey !== m.publicKey
                  ? ('keyChanged' as const)
                  : ('granted' as const),
        })),
      ),
    );
    this.events.set(events);
  }

  /** German label of a log entry type. */
  protected eventLabel(type: string): string {
    return EVENT_LABELS[type] ?? type;
  }

  /** Display name of a member or log participant. */
  protected nameOf(u: { firstName: string | null; lastName: string | null; email: string } | null) {
    if (!u) return '–';
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  }

  /**
   * Grants the current key to a member after the coordinator confirmed the fingerprint with
   * them in person or by phone.
   */
  protected grant(member: MemberRow) {
    this.dialog.open({
      title: 'Fingerabdruck vergleichen',
      text:
        `Vergleichen Sie persönlich oder telefonisch mit ${this.nameOf(member)}, ` +
        `dass ihr Fingerabdruck lautet: ${member.fingerprint}. ` +
        'Geben Sie den Zugang nur frei, wenn er genau übereinstimmt.',
      style: 'warning',
      confirmAction: () => this.doGrant(member),
    });
  }

  /** Seals the current key to the member's public key via the own grant and uploads it. */
  private async doGrant(member: MemberRow) {
    this.busy.set(true);
    try {
      const org = this.org()!;
      const keyVersion = org.keyState === 'rotating' ? org.pendingKeyVersion! : org.keyVersion;
      const wrappedKey = await this.crypto.regrant(
        this.session.ownGrant(keyVersion),
        this.session.requireKeyPair(),
        await this.crypto.importPublicKey(member.publicKey!),
        { orgId: org.id, keyVersion },
      );
      await this.api.grant(org.id, {
        userId: member.id,
        keyVersion,
        wrappedKey,
        publicKey: member.publicKey!,
      });
      this.toast.show({
        title: 'Zugang freigegeben',
        text: `${this.nameOf(member)} kann jetzt entsperren.`,
        severity: 'success',
      });
      await this.load();
    } catch {
      this.toast.show({
        title: 'Freigabe fehlgeschlagen',
        text: 'Sind Sie entsperrt? Versuchen Sie es nach dem Neuladen erneut.',
        severity: 'danger',
      });
    } finally {
      this.busy.set(false);
    }
  }

  /** Removes all of a member's grants. */
  protected revoke(member: MemberRow) {
    this.dialog.open({
      title: 'Zugang entziehen',
      text:
        `${this.nameOf(member)} kann danach keine Daten mehr entschlüsseln. ` +
        'Hatte die Person den Schlüssel bereits, schützt nur eine Schlüsselerneuerung vor einer Kopie.',
      style: 'danger',
      confirmAction: async () => {
        await this.api.revoke(this.org()!.id, member.id);
        await this.load();
      },
    });
  }

  /** Freezes the org, e.g. before a rotation after a leaked passphrase. */
  protected freeze() {
    this.dialog.open({
      title: 'Organisation einfrieren',
      text: 'Niemand in der Organisation kann danach Daten lesen oder speichern, bis sie wieder aufgetaut oder der Schlüssel erneuert ist.',
      style: 'danger',
      confirmAction: async () => {
        await this.api.freeze(this.org()!.id);
        await this.session.refresh();
        await this.load();
      },
    });
  }

  /** Unfreezes the org. */
  protected async unfreeze() {
    await this.api.unfreeze(this.org()!.id);
    await this.session.refresh();
    await this.load();
  }
}
