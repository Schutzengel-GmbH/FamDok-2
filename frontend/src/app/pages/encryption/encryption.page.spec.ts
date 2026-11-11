import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import type { KeyStatus } from '../../../../../shared/api';
import { EncryptionPage } from './encryption.page';
import { KeySessionService } from 'src/app/services/key-session.service';
import { MeService } from 'src/app/services/me.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

/** Just the parts of the key session the page reads, for a key manager of an unencrypted org. */
function fakeSession(canManageKeys: boolean) {
  const status: KeyStatus = {
    enabled: true,
    org: { id: 'o', name: 'Muster e.V.', keyState: 'uninitialized', keyVersion: 0, pendingKeyVersion: null, frozenAt: null },
    userKey: { publicKey: 'pk', wrappedPrivateKey: 'k1', kdfParams: {} as any },
    grants: [],
    keyProofs: [],
    canManageKeys,
    needsKeys: true,
  };
  return {
    status: signal(status),
    state: signal('orgNotSetUp'),
    keyPairReady: signal(true),
    ownFingerprint: signal(null),
    orgKeyFingerprint: signal(null),
    rotationNotice: signal(null),
    mismatchReason: signal(null),
    presentedKey: signal(null),
    ensureLoaded: jasmine.createSpy('ensureLoaded').and.resolveTo(),
    prepareOrgSetup: jasmine.createSpy('prepareOrgSetup').and.resolveTo({
      recoveryCode: 'ABCD-EFGH',
      commit: jasmine.createSpy('commit').and.resolveTo(),
    }),
  };
}

describe('EncryptionPage, org without encryption', () => {
  let fixture: ComponentFixture<EncryptionPage>;
  let session: ReturnType<typeof fakeSession>;

  function setup(canManageKeys: boolean) {
    session = fakeSession(canManageKeys);
    TestBed.configureTestingModule({
      imports: [EncryptionPage],
      providers: [
        provideRouter([]),
        { provide: KeySessionService, useValue: session },
        { provide: MeService, useValue: { getMe: () => of({ firstName: 'A', lastName: 'B', email: 'a@b.de' }) } },
      ],
    });
    fixture = TestBed.createComponent(EncryptionPage);
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent!;
  const button = (label: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent!.includes(label),
    ) as HTMLButtonElement | undefined;

  it('presents activation as optional and irreversible, and offers it only after the acknowledgement', () => {
    setup(true);
    expect(text()).toContain('Die Verschlüsselung ist optional.');
    expect(text()).toContain('Die Aktivierung lässt sich nicht rückgängig machen.');
    expect(button('Schlüssel der Organisation erzeugen')).toBeUndefined();

    const checkbox = fixture.nativeElement.querySelector('#opt-in-understood') as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();
    expect(button('Schlüssel der Organisation erzeugen')).toBeDefined();
  });

  it('asks once more before the setup is uploaded', async () => {
    setup(true);
    (fixture.nativeElement.querySelector('#opt-in-understood') as HTMLInputElement).click();
    fixture.detectChanges();
    button('Schlüssel der Organisation erzeugen')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#recovery-confirm') as HTMLInputElement;
    input.value = 'abcdefgh';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('Verschlüsselung endgültig aktivieren')!.click();

    const dialogs = TestBed.inject(ConfirmDialogService).openDialogs();
    expect(dialogs.length).toBe(1);
    expect(dialogs[0].text).toContain('nicht rückgängig');
    const { commit } = await session.prepareOrgSetup.calls.mostRecent().returnValue;
    expect(commit).not.toHaveBeenCalled();

    dialogs[0].confirmAction();
    await fixture.whenStable();
    expect(commit).toHaveBeenCalled();
  });

  it('tells other members that there is nothing to do', () => {
    setup(false);
    expect(text()).toContain('nutzt die optionale Verschlüsselung nicht');
    expect(text()).not.toContain('Die Aktivierung lässt sich nicht rückgängig machen.');
  });
});
