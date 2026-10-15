import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';

import { unsavedChangesGuard } from './unsavedChangesGuard';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

describe('unsavedChangesGuard', () => {
  let confirmDialog: ConfirmDialogService;

  const run = (dirty: boolean) =>
    TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(
        { hasUnsavedChanges: () => dirty },
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({});
    confirmDialog = TestBed.inject(ConfirmDialogService);
  });

  it('lets the navigation through when there are no unsaved changes', () => {
    expect(run(false)).toBeTrue();
    expect(confirmDialog.openDialogs().length).toBe(0);
  });

  it('resolves to true when leaving is confirmed', async () => {
    const result = run(true) as Promise<boolean>;
    confirmDialog.openDialogs()[0].confirmAction();

    expect(await result).toBeTrue();
    expect(confirmDialog.openDialogs().length).toBe(0);
  });

  it('resolves to false when leaving is cancelled', async () => {
    const result = run(true) as Promise<boolean>;
    confirmDialog.openDialogs()[0].cancelAction();

    expect(await result).toBeFalse();
  });
});
