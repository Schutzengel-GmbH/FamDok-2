import { Component, inject, input, output } from '@angular/core';
import { ToastService } from 'src/app/services/toast.service';

/** Shows a temporary password once, so the admin can pass it on. It is not stored anywhere. */
@Component({
  selector: 'app-temp-password',
  standalone: true,
  template: `
    <div class="alert alert-warning d-flex flex-wrap align-items-center gap-2 mb-0" role="alert">
      <span>Temporäres Passwort für {{ email() }}:</span>
      <code class="fs-5 user-select-all">{{ password() }}</code>
      <button class="btn btn-sm btn-outline-secondary" type="button" (click)="copy()">
        <i class="bi bi-clipboard"></i> Kopieren
      </button>
      <span class="small">
        Wird nur jetzt angezeigt und muss beim ersten Login geändert werden.
      </span>
      <button class="btn-close ms-auto" type="button" aria-label="Schließen" (click)="dismiss.emit()"></button>
    </div>
  `,
})
export class TempPasswordComponent {
  email = input.required<string>();
  password = input.required<string>();
  dismiss = output<void>();

  private toastService = inject(ToastService);

  copy() {
    navigator.clipboard.writeText(this.password()).then(() =>
      this.toastService.show({
        title: 'Kopiert',
        text: 'Das Passwort wurde in die Zwischenablage kopiert.',
        severity: 'info',
      }),
    );
  }
}
