import { Component, inject, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EditContactDocumentation } from 'src/app/components/contact-documentation/edit-contact-documentation.component';
import { FullCase } from '../../../../../shared/types';
import { CaseService } from 'src/app/services/case.service';
import { HasUnsavedChanges } from 'src/app/auth/guards/unsavedChangesGuard';

@Component({
  selector: 'app-contact-documentation',
  standalone: true,
  templateUrl: './contact-documentation.page.html',
  imports: [EditContactDocumentation],
})
export class ContactDocumentation implements HasUnsavedChanges {
  private activatedRoute = inject(ActivatedRoute);
  private caseService = inject(CaseService);

  caseId = this.activatedRoute.snapshot.paramMap.get('caseId');
  initialCase!: FullCase | undefined;

  private editor = viewChild(EditContactDocumentation);

  hasUnsavedChanges() {
    return this.editor()?.hasUnsavedChanges() ?? false;
  }

  constructor() {
    if (this.caseId)
      this.caseService
        .getCase(this.caseId)
        .subscribe((c) => (this.initialCase = c));
  }
}
