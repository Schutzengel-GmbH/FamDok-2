import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GeneralFormService } from 'src/app/services/general-form.service';
import { CaseFormModel as CaseForm } from '../../../../../shared/generated/prisma/models';
import { FullGeneralForm } from '../../../../../shared/types';
import { CaseFormService } from 'src/app/services/case-form.service';
import { SettingsService } from 'src/app/services/settings.service';
import { map, mergeMap } from 'rxjs';

type FormFilter = 'all' | 'case' | 'general';

type SpecialCaseForm = {
  id: string;
  name: string;
};

@Component({
  selector: 'app-surveys',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './caseForms.html',
  styleUrl: './caseForms.scss',
})
export class CaseFormsPage implements OnInit {
  private caseFormService = inject(CaseFormService);
  private generalFormsService = inject(GeneralFormService);
  private settingsService = inject(SettingsService);
  private router = inject(Router);

  protected caseForms: CaseForm[] = [];
  protected generalForms: FullGeneralForm[] = [];

  protected searchTerm = '';
  protected activeFilter: FormFilter = 'all';

  private readonly specialCaseForms: SpecialCaseForm[] = [
    {
      id: 'CONTACT_DOCUMENTATION',
      name: 'Fallkontaktdokumentation',
    },
    {
      id: 'HEALTH_DATA',
      name: 'Gesundheitsdaten Kinder',
    },
  ];

  ngOnInit(): void {
    this.settingsService
      .getSettings()
      .pipe(
        mergeMap((settings) =>
          this.caseFormService.getCaseForms({
            id: { not: settings.closing_doc },
          }),
        ),
      )
      .subscribe((forms) => {
        this.caseForms = forms ?? [];
      });

    this.generalFormsService.getDefinitions().subscribe((forms) => {
      this.generalForms = forms ?? [];
    });
  }

  protected get filteredCaseForms(): CaseForm[] {
    const term = this.normalizedSearchTerm;

    if (!term) {
      return this.caseForms;
    }

    return this.caseForms.filter((form) => this.matchesSearch(form.name, term));
  }

  protected get filteredGeneralForms(): FullGeneralForm[] {
    const term = this.normalizedSearchTerm;

    if (!term) {
      return this.generalForms;
    }

    return this.generalForms.filter((form) =>
      this.matchesSearch(form.name, term),
    );
  }

  protected get filteredCaseSpecialForms(): SpecialCaseForm[] {
    const term = this.normalizedSearchTerm;

    if (!term) {
      return this.specialCaseForms;
    }

    return this.specialCaseForms.filter((form) =>
      this.matchesSearch(form.name, term),
    );
  }

  protected setFilter(filter: FormFilter): void {
    this.activeFilter = filter;
  }

  protected clearSearch(): void {
    this.searchTerm = '';
  }

  selectFamForm(caseFormId: string): void {
    if (caseFormId === 'HEALTH_DATA') {
      this.router.navigate(['gesundheits-daten']);
      return;
    }

    if (caseFormId === 'CONTACT_DOCUMENTATION') {
      this.router.navigate(['contact-documentation']);
      return;
    }

    this.router.navigate(['responses', caseFormId]);
  }

  selectGenForm(definitionId: string): void {
    this.router.navigate(['general-responses'], {
      queryParams: { definitionId },
    });
  }

  private get normalizedSearchTerm(): string {
    return this.normalize(this.searchTerm);
  }

  private matchesSearch(value: string, term: string): boolean {
    return this.normalize(value).includes(term);
  }

  private normalize(value: string): string {
    return (value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
