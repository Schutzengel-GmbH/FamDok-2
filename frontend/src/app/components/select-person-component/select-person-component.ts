import { Component, effect, linkedSignal, model } from '@angular/core';
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

  // hold a reference to the last case, so we can clear the child on
  // a change here, rather than remember it for the consumers
  prevCaseId: string | undefined;

  constructor() {
    effect(() => {
      const caseId = this.case()?.id;
      if (this.prevCaseId !== undefined && this.prevCaseId !== caseId) {
        this.person.set(undefined);
      }
      this.prevCaseId = caseId;
    });
  }

  select(p: Person) {
    const person =
      this.case()?.family?.caregiver.find((c) => c.id === p?.id) ||
      this.case()?.family?.children.find((c) => c.id === p?.id);
    this.person.set(person);
  }

  linkPersons(): Person[] {
    if (!this.case()) return [];

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

  comparePersons = (a: Person, b: Child | Caregiver) => a?.id === b?.id;
}
