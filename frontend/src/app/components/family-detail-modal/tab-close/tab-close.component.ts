import { Component, computed, inject, input, model } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FamilyService } from 'src/app/services/family.service';
import { FullCase, Warning } from '../../../../../../shared/types';
import { FormType, WarningType } from '../../../../../../shared/consts';
import { SettingsService } from 'src/app/services/settings.service';
import { WarningsService } from 'src/app/services/warnings.service';
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

  private router = inject(Router);
  private settingsService = inject(SettingsService);
  private familyService = inject(FamilyService);
  private warningsService = inject(WarningsService);

  private warnings = toSignal(this.warningsService.getWarnings(), {
    initialValue: [] as Warning[],
  });
  private settings = toSignal(this.settingsService.getSettings());

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

  private formatDate(d: Date): string {
    return new Date(d).toLocaleDateString('de-DE');
  }

  onDateSelect(e: Event) {
    const d = new Date((e.target as HTMLInputElement).value);
    this.date.set(d);
  }

  close() {
    if (this.readOnly()) return;
    if (!this.selectedCase().closedAt)
      zip([
        this.settingsService.getSettings(),
        this.familyService.closeCase(this.selectedCase().id, this.date()),
      ]).subscribe(([settings, c]) => {
        this.router.navigate(['responses', settings.closing_doc], {
          queryParams: { caseId: c.id },
        });
      });
    else
      this.settingsService.getSettings().subscribe((settings) =>
        this.router.navigate(['responses', settings.closing_doc], {
          queryParams: { caseId: this.selectedCase().id },
        }),
      );
  }
}
