import { Component, model } from '@angular/core';
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

  change(child: Child) {
    this.child.set(child);
  }
}
