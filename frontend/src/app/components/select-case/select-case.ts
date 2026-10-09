import { Component, inject, model } from '@angular/core';
import { FullCase } from '../../../../../shared/types';
import {
  NgSelectComponent,
  NgLabelTemplateDirective,
} from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { CaseService } from 'src/app/services/case.service';

@Component({
  selector: 'app-select-case',
  standalone: true,
  imports: [NgSelectComponent, NgLabelTemplateDirective, FormsModule],
  templateUrl: './select-case.html',
})
export class SelectCaseComponent {
  private caseService = inject(CaseService);

  case = model<FullCase | undefined>(undefined);

  protected cases!: FullCase[];

  constructor() {
    this.caseService.getMyCases({}).subscribe({
      next: (cases) => (this.cases = cases),
      error: (err) => {
        console.error(err);
        this.cases = [];
      },
    });
  }

  compareCases = (a: FullCase, b: FullCase) => a?.id === b?.id;
}
