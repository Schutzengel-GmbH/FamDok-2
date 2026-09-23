import { Component, inject, input } from '@angular/core';
import { FullCase } from '../../../../../../shared/types';
import { Router } from '@angular/router';
import { FamilyService } from 'src/app/services/family.service';
import { AsyncPipe } from '@angular/common';
import { map } from 'rxjs';
import { sortByStringProperty } from 'src/app/util/generalUtils';
import { CaseFormService } from 'src/app/services/case-form.service';

@Component({
  selector: 'app-tab-sonstige-formulare',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './tab-formulare.component.html',
  styleUrls: ['./tab-formulare.component.scss'],
})
export class TabSonstigeFormulareComponent {
  selectedCase = input.required<FullCase>();
  readOnly = input(false);

  private router = inject(Router);
  private caseFormService = inject(CaseFormService);

  forms$ = this.caseFormService
    .getCaseForms({ type: 'multiple' })
    .pipe(map((forms) => forms.sort(sortByStringProperty('name'))));

  gotoForm(id: string): void {
    if (!this.selectedCase || this.readOnly()) {
      return;
    }

    this.router.navigate(['responses', id], {
      queryParams: { caseId: this.selectedCase().id },
    });
  }
}
