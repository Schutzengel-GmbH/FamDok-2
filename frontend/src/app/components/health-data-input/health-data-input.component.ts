import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectCaseComponent } from '../select-case/select-case';
import { FullCase } from '../../../../../shared/types';
import { SelectChildComponent } from '../select-child/select-child';
import { DatePipe } from '@angular/common';
import { ageString } from 'src/app/util/healthDataUtils';
import {
  NgbDate,
  NgbDateStruct,
  NgbDatepickerModule,
} from '@ng-bootstrap/ng-bootstrap';
import { FamilyService } from 'src/app/services/family.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from 'src/app/services/toast.service';
import { ChildModel as Child } from '../../../../../shared/generated/prisma/models';
import { CaseService } from 'src/app/services/case.service';

@Component({
  selector: 'app-health-data-input.component',
  imports: [
    DatePipe,
    FormsModule,
    SelectCaseComponent,
    SelectChildComponent,
    NgbDatepickerModule,
  ],
  standalone: true,
  templateUrl: './health-data-input.component.html',
  styleUrl: './health-data-input.component.css',
})
export class HealthDataInputComponent {
  private caseService = inject(CaseService);
  private familyService = inject(FamilyService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private toastService = inject(ToastService);
  caseId = this.activatedRoute.snapshot.paramMap.get('caseId');

  case: FullCase | undefined = undefined;
  child: Child | undefined = undefined;

  dateInput: NgbDateStruct | undefined;
  weight: number = 0;

  constructor() {
    if (this.caseId)
      this.caseService.getCase(this.caseId).subscribe((c) => (this.case = c));
  }

  age(child: Child | undefined) {
    return child ? ageString(child) : 0;
  }

  onDateInput(date: NgbDate) {
    this.dateInput = date;
  }

  add() {
    if (!this.case?.family || !this.child || !this.weight || !this.dateInput)
      return;
    this.familyService
      .updateFamily(this.case?.family!.id, {
        children: {
          update: {
            where: { id: this.child.id },
            data: {
              healthData: [
                ...(this.child.healthData || []),
                {
                  date: new Date(
                    this.dateInput.year,
                    this.dateInput.month - 1,
                    this.dateInput.day,
                  ),
                  weightKg: this.weight,
                },
              ],
            },
          },
        },
      })
      .subscribe((res) => {
        this.toastService.show({
          title: 'Gespeichert',
          text: `Antwort für Familie ${res.name} gespeichert.`,
          severity: 'success',
        });
        this.router.navigate(['/']);
      });
  }
}
