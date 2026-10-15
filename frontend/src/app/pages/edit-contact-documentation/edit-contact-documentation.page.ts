import { AsyncPipe } from '@angular/common';
import { Component, inject, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EditContactDocumentation } from 'src/app/components/contact-documentation/edit-contact-documentation.component';
import { HasUnsavedChanges } from 'src/app/auth/guards/unsavedChangesGuard';
import { CaseService } from 'src/app/services/case.service';
import { ContactDocumentationService } from 'src/app/services/contact-documentation.service';

@Component({
  templateUrl: './edit-contact-documentation.page.html',
  standalone: true,
  imports: [AsyncPipe, EditContactDocumentation],
})
export class EditContactDocumentationPage implements HasUnsavedChanges {
  private activatedRoute = inject(ActivatedRoute);
  private documentationService = inject(ContactDocumentationService);
  private caseService = inject(CaseService);

  caseId = this.activatedRoute.snapshot.paramMap.get('caseId')!;
  docId = this.activatedRoute.snapshot.paramMap.get('docId')!;
  readOnly =
    this.activatedRoute.snapshot.queryParamMap.get('readonly') === 'true';
  doc$ = this.documentationService.getDocumentation(this.caseId, this.docId);
  case$ = this.caseService.getCase(this.caseId);

  private editor = viewChild(EditContactDocumentation);

  hasUnsavedChanges() {
    return this.editor()?.hasUnsavedChanges() ?? false;
  }
}
