import { Component, linkedSignal, model } from '@angular/core';
import { FullCase } from '../../../../../shared/types';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import {
  CaregiverModel as Caregiver,
  ChildModel as Child,
} from '../../../../../shared/generated/prisma/models';

type Person = {
  id: string;
  name: string;
  type: string;
};

@Component({
  selector: 'app-select-person-component',
  imports: [
    NgSelectComponent,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
    FormsModule,
  ],
  standalone: true,
  templateUrl: './select-person-component.html',
  styleUrl: './select-person-component.css',
})
export class SelectPersonComponent {
  case = model<FullCase | undefined>();

  persons = linkedSignal<Person[]>(() => this.linkPersons());
  person = model<Child | Caregiver | undefined>();

  select(p: Person) {
    const person =
      this.case()?.family?.caregiver.find((c) => c.id === p?.id) ||
      this.case()?.family?.children.find((c) => c.id === p?.id);
    this.person.set(person);
  }

  linkPersons(): Person[] {
    if (!this.case) return [];

    const children: Person[] =
      this.case()?.family?.children.map((c) => ({
        id: c.id,
        name: c.name + ' ' + c.lastName,
        type: 'Kind',
      })) || [];

    const caregivers: Person[] =
      this.case()?.family?.caregiver.map((c) => ({
        id: c.id,
        name: c.name + ' ' + c.lastName,
        type:
          c.relation === 'mother' || c.relation === 'father'
            ? 'Eltern'
            : 'Sonstige Bezugsperson',
      })) || [];

    return children.concat(caregivers);
  }
}
