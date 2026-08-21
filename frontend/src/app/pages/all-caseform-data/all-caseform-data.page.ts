import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AllDataComponent } from 'src/app/components/all-data/all-data.component';
import { FullCaseForm } from '../../../../../shared/types';
import { CaseFormService } from 'src/app/services/case-form.service';

@Component({
  template: `@if (form) {
    <app-all-data [form]="form" />
  }`,
  standalone: true,
  imports: [AllDataComponent],
})
export class AllCaseFormData {
  private activatedRoute = inject(ActivatedRoute);
  private caseFormService = inject(CaseFormService);
  formId = this.activatedRoute.snapshot.paramMap.get('formId');
  form!: FullCaseForm;

  constructor() {
    this.caseFormService
      .getCaseForm(this.formId!)
      .subscribe((f) => (this.form = f));
  }
}
