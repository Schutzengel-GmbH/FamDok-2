import { Component, inject, input } from '@angular/core';
import { FullCase, FullCaseForm, Warning } from '../../../../../../shared/types';
import { WarningType } from '../../../../../../shared/consts';
import { Router } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { map, zip } from 'rxjs';
import { sortByStringProperty } from 'src/app/util/generalUtils';
import { CaseFormService } from 'src/app/services/case-form.service';
import { SettingsService } from 'src/app/services/settings.service';
import { WarningsService } from 'src/app/services/warnings.service';

interface CaseFormWithWarning extends FullCaseForm {
  hasWarning: boolean;
}

@Component({
  selector: 'app-tab-datenblaetter',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './tab-datenblaetter.component.html',
  styleUrls: ['./tab-datenblaetter.component.scss'],
})
export class TabDatenblaetterComponent {
  selectedCase = input.required<FullCase>();
  readOnly = input(false);

  private router = inject(Router);
  private caseForms$ = inject(CaseFormService).getCaseForms({ type: 'single' });
  private settings$ = inject(SettingsService).getSettings();
  private warnings$ = inject(WarningsService).getWarnings();

  forms$ = zip(this.settings$, this.caseForms$, this.warnings$).pipe(
    map(([settings, forms, warnings]): CaseFormWithWarning[] => {
      const caseId = this.selectedCase().id;
      const unfinishedFormIds = new Set(
        warnings
          .filter(
            (w): w is Extract<Warning, { type: WarningType.UNFINISHED_FORM }> =>
              w.type === WarningType.UNFINISHED_FORM,
          )
          .filter((w) => w.data.caseId === caseId && !!w.data.caseFormId)
          .map((w) => w.data.caseFormId as string),
      );

      return forms
        .filter((f) => f.id !== settings.closing_doc)
        .sort(sortByStringProperty('name'))
        .map((f) => ({ ...f, hasWarning: unfinishedFormIds.has(f.id) }));
    }),
  );

  gotoForm(id: string): void {
    if (!this.selectedCase) {
      return;
    }

    this.router.navigate(['responses', id], {
      queryParams: {
        caseId: this.selectedCase().id,
        ...(this.readOnly() ? { readonly: true } : {}),
      },
    });
  }
}
