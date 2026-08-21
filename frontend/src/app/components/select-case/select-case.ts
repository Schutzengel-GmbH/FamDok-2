import { Component, inject, model } from '@angular/core';
import { FullCase } from '../../../../../shared/types';
import { FamilyService } from 'src/app/services/family.service';
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
  styleUrl: './select-case.scss',
})
export class SelectCaseComponent {
  private caseService = inject(CaseService);

  case = model<FullCase | undefined>(undefined);

  protected cases!: FullCase[];

  constructor() {
    this.caseService.getMyCases({}).subscribe((cases) => (this.cases = cases));
  }

  handleChange(c: FullCase) {
    this.case.set(c);
  }
}
