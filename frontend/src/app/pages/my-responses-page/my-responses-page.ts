import { Component, inject } from '@angular/core';
import { mergeMap } from 'rxjs';
import { MeService } from 'src/app/services/me.service';
import { FullCaseFormResponse } from '../../../../../shared/types';
import { Router } from '@angular/router';
import { CaseFormService } from 'src/app/services/case-form.service';

@Component({
  selector: 'app-my-responses-page',
  imports: [],
  standalone: true,
  templateUrl: './my-responses-page.html',
  styleUrl: './my-responses-page.css',
})
export class MyResponsesPage {
  private meService = inject(MeService);
  private caseFormService = inject(CaseFormService);
  private router = inject(Router);

  protected responses!: FullCaseFormResponse[];

  constructor() {
    this.meService
      .getMe()
      .pipe(
        mergeMap((me) =>
          this.caseFormService.getCaseFormResponses({
            createdBy: { id: me.id },
          }),
        ),
      )
      .subscribe((responses) => (this.responses = responses));
  }

  nav(id: string, caseFormId: string) {
    this.router.navigate(['responses', caseFormId], { queryParams: { id } });
  }
}
