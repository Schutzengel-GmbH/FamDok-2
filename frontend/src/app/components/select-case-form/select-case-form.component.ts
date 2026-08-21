import { Component, input, model } from '@angular/core';
import {
  NgSelectComponent,
  NgLabelTemplateDirective,
} from '@ng-select/ng-select';
import { FullCaseForm } from '../../../../../shared/types';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-select-case-form',
  template: `<ng-select
    ariaLabel="Formular auswählen"
    placeholder="Formular auswählen"
    [items]="forms()"
    [multiple]="false"
    bindLabel="name"
    [(ngModel)]="form"
    clearAllText="Auswahl aufheben">
    <ng-template ng-label-tmp let-item="item">
      {{ item.name }}
    </ng-template>
  </ng-select>`,
  imports: [FormsModule, NgSelectComponent, NgLabelTemplateDirective],
  standalone: true,
})
export class SelectCaseFormComponent {
  forms = input.required<FullCaseForm[]>();
  form = model<FullCaseForm>();
}
