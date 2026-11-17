import { Component, inject, input, output } from '@angular/core';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-temp-password',
  standalone: true,
  template: `
    <div class="temp-password-banner" role="alert">
      <div class="temp-password-banner__icon">
        <i class="bi bi-key-fill"></i>
      </div>
      <div class="temp-password-banner__body">
        <span class="temp-password-banner__label">
          Temporäres Passwort für {{ email() }}
        </span>
        <div class="temp-password-banner__value">
          <code>{{ password() }}</code>
          <button
            class="btn btn-sm btn-outline-secondary"
            type="button"
            (click)="copy()">
            <i class="bi bi-clipboard"></i>
            Kopieren
          </button>
        </div>
        <span class="temp-password-banner__hint">
          Wird nur jetzt angezeigt und muss beim ersten Login geändert werden.
        </span>
      </div>
      <button
        class="btn-close"
        type="button"
        aria-label="Schließen"
        (click)="dismiss.emit()"></button>
    </div>
  `,
  styleUrl: './temp-password.component.scss',
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
