import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FullGeneralForm } from '../../../../../shared/types';
import { AllDataGeneralComponent } from 'src/app/components/all-data-general/all-data-general.component';
import { GeneralFormService } from 'src/app/services/general-form.service';

@Component({
  host: { class: 'd-block h-100' },
  template: `@if (form) {
    <app-allgeneral-data [form]="form" />
  }`,
  standalone: true,
  imports: [AllDataGeneralComponent],
})
export class AllFormData {
  private activatedRoute = inject(ActivatedRoute);
  private formsService = inject(GeneralFormService);
  formId = this.activatedRoute.snapshot.paramMap.get('formId');
  form!: FullGeneralForm;

  constructor() {
    this.formsService
      .getDefinition(this.formId!)
      .subscribe((f) => (this.form = f));
  }
}
