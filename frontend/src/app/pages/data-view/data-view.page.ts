import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FullCaseForm, FullGeneralForm } from '../../../../../shared/types';
import { GeneralFormService } from 'src/app/services/general-form.service';
import { zip } from 'rxjs';
import { CaseFormService } from 'src/app/services/case-form.service';

type FormType = 'caseForm' | 'generalForm';

type DataViewNavItem = {
  navId: string;
  name: string;
  type: FormType;
};

@Component({
  templateUrl: './data-view.page.html',
  styleUrl: './data-view.page.scss',
  standalone: true,
  imports: [FormsModule],
})
export class DataViewPage {
  private caseFormService = inject(CaseFormService);
  private generalFormsService = inject(GeneralFormService);
  private router = inject(Router);

  readonly caseForms = signal<FullCaseForm[]>([]);
  readonly generalForms = signal<FullGeneralForm[]>([]);
  readonly filter = signal<string>('');

  private readonly staticForms: DataViewNavItem[] = [
    {
      name: 'Fallkontaktdokumentation',
      navId: 'CONTACT_DOCUMENTATION',
      type: 'caseForm',
    },
  ];

  readonly filteredForms = computed<DataViewNavItem[]>(() => {
    const term = this.normalize(this.filter());

    const dynamicCaseForms = this.caseForms().map((form) => ({
      navId: form.id,
      name: form.name,
      type: 'caseForm' as FormType,
    }));

    const dynamicGeneralForms = this.generalForms().map((form) => ({
      navId: form.id,
      name: form.name,
      type: 'generalForm' as FormType,
    }));

    const allForms = [
      ...dynamicGeneralForms,
      ...dynamicCaseForms,
      ...this.staticForms,
    ];

    if (!term) {
      return allForms.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }

    return allForms
      .filter((form) => this.normalize(form.name).includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  });

  constructor() {
    // The backend already restricts which forms a given role may see (org scope,
    // containsPersonalData for Controller/OrgController) - no need to duplicate that here.
    zip(
      this.generalFormsService.getDefinitions(),
      this.caseFormService.getCaseForms(),
    ).subscribe(([generalForms, caseForms]) => {
      this.caseForms.set(caseForms);
      this.generalForms.set(generalForms);
    });
  }

  clearFilter(): void {
    this.filter.set('');
  }

  clickForm(navId: string, type: FormType): void {
    switch (navId) {
      case 'CONTACT_DOCUMENTATION':
        this.router.navigate(['contact-documentation-table']);
        break;
      default:
        this.router.navigate([
          type === 'caseForm' ? 'all-caseform-data' : 'all-form-data',
          navId,
        ]);
        break;
    }
  }

  private normalize(value: string): string {
    return (value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
