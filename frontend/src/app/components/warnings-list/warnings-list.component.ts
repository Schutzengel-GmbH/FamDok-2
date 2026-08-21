import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WarningsService } from 'src/app/services/warnings.service';
import { SettingsService } from 'src/app/services/settings.service';
import { FullCase, Warning } from '../../../../../shared/types';
import { FormType, WarningLevel, WarningType } from '../../../../../shared/consts';

@Component({
  selector: 'app-warnings-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './warnings-list.component.html',
  styleUrls: ['./warnings-list.component.scss'],
})
export class WarningsListComponent implements OnInit {
  /** Cases already loaded by the parent, used only to show the family name next to a warning. */
  cases = input<FullCase[]>([]);

  /** Emitted when the user wants to jump to a case's Zielvereinbarungen tab. */
  openZielvereinbarung = output<string>();

  private warningsService = inject(WarningsService);
  private settingsService = inject(SettingsService);
  private router = inject(Router);

  protected readonly WarningLevel = WarningLevel;

  protected warnings = signal<Warning[]>([]);
  protected isLoading = signal(true);
  protected expanded = signal(true);

  ngOnInit(): void {
    this.refresh();
  }

  /** Re-fetches warnings, e.g. after the user edits something from a warning link. */
  refresh(): void {
    this.isLoading.set(true);
    this.warningsService.refresh().subscribe({
      next: (warnings) => {
        this.warnings.set(
          [...warnings].sort((a, b) => b.level - a.level),
        );
        this.isLoading.set(false);
      },
      error: () => {
        this.warnings.set([]);
        this.isLoading.set(false);
      },
    });
  }

  toggle(): void {
    this.expanded.set(!this.expanded());
  }

  protected familyName(w: Warning): string | undefined {
    return this.cases().find((c) => c.id === w.data.caseId)?.family?.name;
  }

  protected icon(w: Warning): string {
    return w.level === WarningLevel.WARNING
      ? 'bi-exclamation-triangle-fill'
      : 'bi-info-circle-fill';
  }

  protected message(w: Warning): string {
    switch (w.type) {
      case WarningType.ZV_EXPIRED:
        return `Zielvereinbarung abgelaufen seit ${this.formatDate(w.data.finishBy)}.`;
      case WarningType.ZV_EXPIRING_SOON:
        return `Zielvereinbarung läuft bald ab (${this.formatDate(w.data.finishBy)}).`;
      case WarningType.CASE_NO_CONTACT:
        return w.data.lastContact
          ? `Kein Kontakt seit ${this.formatDate(w.data.lastContact)}.`
          : 'Noch kein Kontakt dokumentiert.';
      case WarningType.UNFINISHED_FORM:
        return 'Dokumentation ist unvollständig.';
      case WarningType.CLOSED_WITHOUT_DOC:
        return `Fall seit ${this.formatDate(w.data.closedAt)} geschlossen, Abschlussdokumentation fehlt.`;
      default:
        return 'Hinweis.';
    }
  }

  protected hasAction(w: Warning): boolean {
    if (w.type !== WarningType.UNFINISHED_FORM) return true;
    return w.data.formType === FormType.CONTACT_DOC || !!w.data.caseFormId;
  }

  protected actionLabel(w: Warning): string {
    switch (w.type) {
      case WarningType.ZV_EXPIRED:
      case WarningType.ZV_EXPIRING_SOON:
        return 'Zielvereinbarung öffnen';
      case WarningType.CASE_NO_CONTACT:
        return 'Kontakt dokumentieren';
      case WarningType.UNFINISHED_FORM:
        return 'Dokumentation fertigstellen';
      case WarningType.CLOSED_WITHOUT_DOC:
        return 'Abschlussdokumentation öffnen';
      default:
        return 'Öffnen';
    }
  }

  protected takeAction(w: Warning): void {
    switch (w.type) {
      case WarningType.ZV_EXPIRED:
      case WarningType.ZV_EXPIRING_SOON:
        this.openZielvereinbarung.emit(w.data.caseId);
        return;
      case WarningType.CASE_NO_CONTACT:
        this.router.navigate(['contact-documentation', w.data.caseId]);
        return;
      case WarningType.UNFINISHED_FORM:
        if (w.data.formType === FormType.CONTACT_DOC) {
          this.router.navigate([
            'contact-documentation',
            w.data.caseId,
            w.data.responseId,
          ]);
        } else if (w.data.caseFormId) {
          this.router.navigate(['responses', w.data.caseFormId], {
            queryParams: { id: w.data.responseId, caseId: w.data.caseId },
          });
        }
        return;
      case WarningType.CLOSED_WITHOUT_DOC:
        this.settingsService.getSettings().subscribe((settings) => {
          if (!settings.closing_doc) return;
          this.router.navigate(['responses', settings.closing_doc], {
            queryParams: { caseId: w.data.caseId },
          });
        });
        return;
    }
  }

  private formatDate(d: Date): string {
    return new Date(d).toLocaleDateString('de-DE');
  }
}
