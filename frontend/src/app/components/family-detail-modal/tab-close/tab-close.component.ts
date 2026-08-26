import { Component, computed, inject, input, model, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FamilyService } from 'src/app/services/family.service';
import { FullCase, Warning } from '../../../../../../shared/types';
import { FormType, WarningType } from '../../../../../../shared/consts';
import { Role } from '../../../../../../shared/generated/prisma/enums';
import { SettingsService } from 'src/app/services/settings.service';
import { WarningsService } from 'src/app/services/warnings.service';
import { MeService } from 'src/app/services/me.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { ToastService } from 'src/app/services/toast.service';
import { zip } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-tab-close',
  imports: [FormsModule, NgbDatepickerModule],
  templateUrl: './tab-close.component.html',
  standalone: true,
})
export class TabClose {
  selectedCase = input.required<FullCase>();
  readOnly = input(false);
  date = model<Date>(new Date());
  changed = output<void>();

  private router = inject(Router);
  private settingsService = inject(SettingsService);
  private familyService = inject(FamilyService);
  private warningsService = inject(WarningsService);
  private meService = inject(MeService);
  private dialogService = inject(ConfirmDialogService);
  private toast = inject(ToastService);

  private warnings = toSignal(this.warningsService.getWarnings(), {
    initialValue: [] as Warning[],
  });
  private settings = toSignal(this.settingsService.getSettings());
  private currentUser = toSignal(this.meService.getMe());

  protected closingDocWarningTooltip = computed(() => {
    const caseId = this.selectedCase().id;
    const closingDocId = this.settings()?.closing_doc;

    const closedWithoutDoc = this.warnings().find(
      (w): w is Extract<Warning, { type: WarningType.CLOSED_WITHOUT_DOC }> =>
        w.type === WarningType.CLOSED_WITHOUT_DOC && w.data.caseId === caseId,
    );
    if (closedWithoutDoc) {
      return `Fall seit ${this.formatDate(closedWithoutDoc.data.closedAt)} geschlossen, Abschlussdokumentation fehlt.`;
    }

    const unfinishedClosingDoc = this.warnings().find(
      (w): w is Extract<Warning, { type: WarningType.UNFINISHED_FORM }> =>
        w.type === WarningType.UNFINISHED_FORM &&
        w.data.caseId === caseId &&
        w.data.formType === FormType.CASE_FORM &&
        !!closingDocId &&
        w.data.caseFormId === closingDocId,
    );
    if (unfinishedClosingDoc) {
      return 'Dokumentation ist unvollständig.';
    }

    return undefined;
  });

  /** Admin any family; OrgCoordinator/SubOrgCoordinator only within their own org/suborg. */
  protected canPurge = computed(() => {
    const user = this.currentUser();
    const family = this.selectedCase().family;
    if (!user || !family) return false;
    if (user.role === Role.Admin) return true;
    if (user.role === Role.OrgCoordinator)
      return !!family.organisationId && user.organisationId === family.organisationId;
    if (user.role === Role.SubOrgCoordinator) {
      const subOrgId = this.selectedCase().subOrganisationId;
      return !!subOrgId && user.subOrganisations.some((so) => so.id === subOrgId);
    }
    return false;
  });

  private formatDate(d: Date): string {
    return new Date(d).toLocaleDateString('de-DE');
  }

  protected formatDateDisplay(d: Date | null | undefined): string {
    return d ? this.formatDate(d) : '';
  }

  onDateSelect(e: Event) {
    const d = new Date((e.target as HTMLInputElement).value);
    this.date.set(d);
  }

  close() {
    if (this.readOnly()) return;
    const isFirstClose = !this.selectedCase().closedAt;

    zip([
      this.settingsService.getSettings(),
      this.familyService.closeCase(this.selectedCase().id, this.date()),
    ]).subscribe(([settings, c]) => {
      const dueAt = c.personalDataDueAt;
      this.toast.show({
        title: isFirstClose ? 'Fall abgeschlossen' : 'Datum geändert',
        text: dueAt
          ? `Personenbezogene Daten dieser Familie werden am ${this.formatDate(dueAt)} automatisch gelöscht.`
          : 'Es ist noch keine Löschfrist konfiguriert - personenbezogene Daten werden vorerst nicht automatisch gelöscht.',
        severity: 'info',
      });

      if (isFirstClose) {
        this.router.navigate(['responses', settings.closing_doc], {
          queryParams: { caseId: c.id },
        });
      } else {
        this.changed.emit();
      }
    });
  }

  editClosingDoc() {
    this.settingsService.getSettings().subscribe((settings) =>
      this.router.navigate(['responses', settings.closing_doc], {
        queryParams: { caseId: this.selectedCase().id },
      }),
    );
  }

  reopen() {
    if (this.readOnly()) return;
    this.dialogService.open({
      title: 'Abschluss zurücknehmen?',
      text:
        'Die bereits erstellte Abschlussdokumentation wird dabei unwiderruflich gelöscht. ' +
        'Fortfahren?',
      style: 'warning',
      confirmAction: () => {
        this.familyService.reopenCase(this.selectedCase().id).subscribe({
          next: () => {
            this.toast.show({
              title: 'Zurückgenommen',
              text: 'Der Fallabschluss wurde zurückgenommen.',
              severity: 'success',
            });
            this.changed.emit();
          },
          error: () => {
            this.toast.show({
              title: 'Fehler',
              text: 'Beim Zurücknehmen ist ein Fehler aufgetreten.',
              severity: 'danger',
            });
          },
        });
      },
    });
  }

  purge() {
    if (!this.canPurge()) return;
    this.dialogService.open({
      title: 'Familie jetzt löschen?',
      text:
        'Alle personenbezogenen Daten dieser Familie werden sofort unwiderruflich gelöscht, ' +
        'auch wenn die Wartezeit noch nicht abgelaufen ist. Dies kann nicht rückgängig gemacht ' +
        'werden.',
      style: 'danger',
      confirmAction: () => {
        this.familyService.purgeFamily(this.selectedCase().id).subscribe({
          next: () => {
            this.toast.show({
              title: 'Gelöscht',
              text: 'Die personenbezogenen Daten wurden gelöscht.',
              severity: 'success',
            });
            this.changed.emit();
          },
          error: () => {
            this.toast.show({
              title: 'Fehler',
              text: 'Beim Löschen ist ein Fehler aufgetreten.',
              severity: 'danger',
            });
          },
        });
      },
    });
  }
}
