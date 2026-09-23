import { Component, computed, inject, input } from '@angular/core';
import { FullCase, Warning } from '../../../../../../shared/types';
import { FormType, WarningType } from '../../../../../../shared/consts';
import { mergeMap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ContactBrief } from '../../contact-brief/contact-brief.component';
import { ContactDocumentationService } from 'src/app/services/contact-documentation.service';
import { WarningsService } from 'src/app/services/warnings.service';

@Component({
  selector: 'app-tab-freie-dokumentation',
  standalone: true,
  imports: [ContactBrief],
  templateUrl: './tab-freie-dokumentation.component.html',
  styleUrls: ['./tab-freie-dokumentation.component.scss'],
})
export class TabFreieDokumentationComponent {
  selectedCase = input.required<FullCase>();
  readOnly = input(false);

  private router = inject(Router);
  private documentationService = inject(ContactDocumentationService);
  private warningsService = inject(WarningsService);

  latestDocs = toSignal(
    toObservable(this.selectedCase).pipe(
      mergeMap((c) =>
        this.documentationService.getLatestDocumentationForCase(c.id, 5),
      ),
    ),
  );

  private warnings = toSignal(this.warningsService.getWarnings(), {
    initialValue: [] as Warning[],
  });

  private unfinishedContactDocIds = computed(() => {
    const caseId = this.selectedCase().id;
    return new Set(
      this.warnings()
        .filter(
          (w): w is Extract<Warning, { type: WarningType.UNFINISHED_FORM }> =>
            w.type === WarningType.UNFINISHED_FORM,
        )
        .filter(
          (w) =>
            w.data.caseId === caseId && w.data.formType === FormType.CONTACT_DOC,
        )
        .map((w) => w.data.responseId),
    );
  });

  hasWarning(docId: string): boolean {
    return this.unfinishedContactDocIds().has(docId);
  }

  addContact() {
    if (this.readOnly()) return;
    this.router.navigate(['contact-documentation', this.selectedCase().id]);
  }
}
