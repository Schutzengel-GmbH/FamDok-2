import { Component, effect, model } from '@angular/core';
import { FullCase } from '../../../../../shared/types';
import { FormsModule } from '@angular/forms';
import {
  NgSelectComponent,
  NgLabelTemplateDirective,
} from '@ng-select/ng-select';
import { ChildModel as Child } from '../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-select-child',
  imports: [NgSelectComponent, NgLabelTemplateDirective, FormsModule],
  standalone: true,
  templateUrl: './select-child.html',
  styleUrl: './select-child.css',
})
export class SelectChildComponent {
  case = model<FullCase | undefined>(undefined);
  child = model<Child | undefined>(undefined);

  // hold a reference to the last case, so we can clear the child on
  // a change here, rather than remember it for the consumers
  prevCaseId: string | undefined;

  constructor() {
    effect(() => {
      const caseId = this.case()?.id;
      if (this.prevCaseId !== undefined && this.prevCaseId !== caseId) {
        this.child.set(undefined);
      }
      this.prevCaseId = caseId;
    });
  }

  change(child: Child) {
    this.child.set(child);
  }

  compareChildren = (a: Child, b: Child) => a?.id === b?.id;
}
