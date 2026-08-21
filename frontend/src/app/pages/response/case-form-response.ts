import { Component, inject, model } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { SelectCaseComponent } from 'src/app/components/select-case/select-case';
import { FullCase, FullCaseFormResponse } from '../../../../../shared/types';
import { EditCaseFormResponse } from 'src/app/components/case-form-response/edit-case-form-response.component';
import { EditCaseFormSingleResponse } from 'src/app/components/case-form-single-response/edit-case-form-single-response.component';
import { CaseService } from 'src/app/services/case.service';
import { CaseFormService } from 'src/app/services/case-form.service';

@Component({
  selector: 'app-response',
  imports: [
    EditCaseFormResponse,
    SelectCaseComponent,
    EditCaseFormSingleResponse,
  ],
  standalone: true,
  templateUrl: './case-form-response.html',
  styleUrl: './case-form-response.css',
})
export class CaseFormResponsePage {
  private activatedRoute = inject(ActivatedRoute);
  private caseService = inject(CaseService);
  private caseFormService = inject(CaseFormService);

  responseId = this.activatedRoute.snapshot.queryParamMap.get('id');
  caseId = this.activatedRoute.snapshot.queryParamMap.get('caseId');
  caseFormId = this.activatedRoute.snapshot.paramMap.get('caseFormId')!;
  readOnly = this.activatedRoute.snapshot.queryParamMap.get('readonly') === 'true';

  case = model<FullCase>();
  response = model<FullCaseFormResponse>();

  caseForm = toSignal(this.caseFormService.getCaseForm(this.caseFormId));

  constructor() {
    if (this.caseId)
      this.caseService.getCase(this.caseId).subscribe((c) => this.case.set(c));

    if (this.responseId)
      this.caseFormService
        .getCaseFormResponse(this.responseId)
        .subscribe((r) => {
          this.response.set(r);
          this.case.set(r.case);
        });
  }
}
