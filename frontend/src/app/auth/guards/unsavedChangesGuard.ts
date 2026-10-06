import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Asks for confirmation before leaving a page that still has unsaved changes. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (
  component,
) => {
  if (!component.hasUnsavedChanges()) return true;

  const dialogService = inject(ConfirmDialogService);
  return new Promise<boolean>((resolve) =>
    dialogService.open({
      title: 'Ungespeicherte Änderungen',
      text: 'Es gibt ungespeicherte Änderungen. Soll die Seite trotzdem verlassen werden?',
      style: 'warning',
      confirmAction: () => resolve(true),
      cancelAction: () => resolve(false),
    }),
  );
};
