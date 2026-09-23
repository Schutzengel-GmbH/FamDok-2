import { Component, computed, inject, model } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FullCase } from '../../../../../shared/types';
import { ChildModel as Child } from '../../../../../shared/generated/prisma/models';
import { CaseService } from 'src/app/services/case.service';
import { FamilyService } from 'src/app/services/family.service';
import { ToastService } from 'src/app/services/toast.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { ageString } from 'src/app/util/healthDataUtils';
import { SelectCaseComponent } from 'src/app/components/select-case/select-case';
import { SelectChildComponent } from 'src/app/components/select-child/select-child';
import { GrowthChartComponent } from 'src/app/components/growth-chart/growth-chart.component';
import { HealthDataModalComponent } from 'src/app/components/health-data-modal/health-data-modal.component';

@Component({
  selector: 'app-health-data-page',
  standalone: true,
  imports: [
    DatePipe,
    SelectCaseComponent,
    SelectChildComponent,
    GrowthChartComponent,
  ],
  templateUrl: './health-data.page.html',
  styleUrl: './health-data.page.scss',
})
export class HealthDataPage {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private caseService = inject(CaseService);
  private familyService = inject(FamilyService);
  private toastService = inject(ToastService);
  private dialogService = inject(ConfirmDialogService);
  private modalService = inject(NgbModal);

  caseId = this.activatedRoute.snapshot.paramMap.get('caseId');
  childId = this.activatedRoute.snapshot.paramMap.get('childId');
  readOnly =
    this.activatedRoute.snapshot.queryParamMap.get('readonly') === 'true';

  case = model<FullCase | undefined>(undefined);
  child = model<Child | undefined>(undefined);

  historyEntries = computed(() => {
    const healthData = this.child()?.healthData;
    if (!healthData) return [];
    return healthData
      .map((point, index) => ({ point, index }))
      .sort(
        (a, b) => new Date(b.point.date).getTime() - new Date(a.point.date).getTime(),
      );
  });

  constructor() {
    if (this.caseId) {
      this.caseService.getCase(this.caseId).subscribe((c) => {
        this.case.set(c);
        if (this.childId) {
          this.child.set(
            c.family?.children?.find((ch) => ch.id === this.childId),
          );
        }
      });
    }
  }

  age(child: Child | undefined) {
    return child ? ageString(child) : '';
  }

  onChildChange(child: Child | undefined) {
    this.child.set(child);
    const caseId = this.case()?.id;
    if (child && caseId) {
      this.router.navigate(['gesundheit', caseId, child.id], {
        queryParams: this.readOnly ? { readonly: true } : {},
        replaceUrl: true,
      });
    }
  }

  openAddModal() {
    const child = this.child();
    if (!child) return;
    const modalRef = this.modalService.open(HealthDataModalComponent);
    modalRef.closed.subscribe(
      (
        result: { reason: 'cancel' } | { reason: 'save'; value: PrismaJson.HealthDataPointChild },
      ) => {
        if (result.reason !== 'save') return;
        this.persist([...(child.healthData || []), result.value]);
      },
    );
  }

  openEditModal(index: number) {
    const child = this.child();
    if (!child?.healthData) return;
    const modalRef = this.modalService.open(HealthDataModalComponent);
    modalRef.componentInstance.dataPoint = child.healthData[index];
    modalRef.closed.subscribe(
      (
        result: { reason: 'cancel' } | { reason: 'save'; value: PrismaJson.HealthDataPointChild },
      ) => {
        if (result.reason !== 'save') return;
        const updated = [...child.healthData!];
        updated[index] = result.value;
        this.persist(updated);
      },
    );
  }

  deleteEntry(index: number) {
    const child = this.child();
    if (!child?.healthData) return;
    this.dialogService.open({
      title: 'Messung löschen?',
      text: 'Soll dieser Eintrag wirklich gelöscht werden?',
      style: 'danger',
      confirmAction: () => {
        this.persist(child.healthData!.filter((_, i) => i !== index));
      },
    });
  }

  private persist(healthData: PrismaJson.HealthDataPointChild[]) {
    const familyId = this.case()?.family?.id;
    const child = this.child();
    if (!familyId || !child) return;

    this.familyService
      .updateHealthData(familyId, child.id, healthData)
      .subscribe((family) => {
        this.child.set(family.children?.find((c) => c.id === child.id));
        this.toastService.show({
          title: 'Gespeichert',
          text: 'Gesundheitsdaten aktualisiert.',
          severity: 'success',
        });
      });
  }
}
